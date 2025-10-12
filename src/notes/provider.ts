import { moment, Notice, TFile, WorkspaceLeaf, App } from 'obsidian';
import { IDailySettings, IPeriodicitySettings, ISettings } from 'src/settings';
import { ObsidianWorkspace } from 'src/types';
import debug from '../log';
import { DailyNote, MonthlyNote, Note, QuarterlyNote, WeeklyNote, YearlyNote } from 'obsidian-periodic-notes-provider';
import { processTemplaterInFile } from '../templater';
import type AutoPeriodicNotes from '../index';

const DEFAULT_WAIT_TIMEOUT: number = 1000;

export default class NotesProvider {
  private waitTimeout: number;
  private workspace: ObsidianWorkspace;
  private workspaceLeaves: Record<string, WorkspaceLeaf>;
  private app: App;
  private plugin: AutoPeriodicNotes;

  constructor(workspace: ObsidianWorkspace, app: App, plugin: AutoPeriodicNotes, waitTimeout?: number) {
    this.workspace = workspace;
    this.app = app;
    this.plugin = plugin;
    this.waitTimeout = waitTimeout || DEFAULT_WAIT_TIMEOUT;
  }

  async checkAndCreateNotes(settings: ISettings): Promise<void> {
    debug('Checking if any new notes need to be created');

    await this.checkAndCreateSingleNote(settings.yearly, new YearlyNote(), 'yearly', settings.alwaysOpen, settings.processTemplater);
    await this.checkAndCreateSingleNote(settings.quarterly, new QuarterlyNote(), 'quarterly', settings.alwaysOpen, settings.processTemplater);
    await this.checkAndCreateSingleNote(settings.monthly, new MonthlyNote(), 'monthly', settings.alwaysOpen, settings.processTemplater);
    await this.checkAndCreateSingleNote(settings.weekly, new WeeklyNote(), 'weekly', settings.alwaysOpen, settings.processTemplater);
    await this.checkAndCreateSingleNote(settings.daily, new DailyNote(), 'daily', settings.alwaysOpen, settings.processTemplater);
  }

  private async checkAndCreateSingleNote(setting: IPeriodicitySettings, cls: Note, term: string, alwaysOpen: boolean, processTemplater: boolean): Promise<void> {
    if (setting.available && setting.enabled) {
      // Clear workspace leaves cache to get fresh state for this note check
      // This prevents stale "ghost" leaves from affecting our checks
      this.workspaceLeaves = {};

      debug(`Checking if ${term} note needs to be created`);
      if (!cls.isPresent()) {

        if (term === 'daily' && (setting as IDailySettings).excludeWeekends) {
          const today = moment();
          if (today.format('dd') === 'Sa' || today.format('dd') === 'Su') {
            debug('Not creating new note as it is a weekend');
            return;
          }
        }

        debug(`Creating new ${term} note`);
        const newNote: TFile = await cls.create();
        new Notice(
          `Today's ${term} note has been created.`,
          5000
        );

        await this.handleClose(setting, cls, newNote);
        await this.handleOpen(setting, newNote, term);

        // Process Templater commands after the note is opened if enabled
        // This ensures the file is active in the editor when Templater processes it
        if (processTemplater) {
          await processTemplaterInFile(this.app, newNote, true);
        }

      } else if (alwaysOpen) {

        debug(`Set to always open notes, getting current ${term} note and checking if it needs to be opened`);
        const existingNote: TFile = cls.getCurrent();

        await this.handleClose(setting, cls, existingNote);
        await this.handleOpen(setting, existingNote, term);
      }

    }
  }

  private getOpenWorkspaceLeaves(): Record<string, WorkspaceLeaf> {
    // Use cache within a single note check, but cache is cleared between notes
    if (!Object.keys(this.workspaceLeaves).length) {
      this.workspace.iterateAllLeaves((leaf) => {
        const viewType = leaf.view?.getViewType?.();
        const state = leaf.view?.getState?.();

        debug(`Leaf found - viewType: ${viewType}, state.file: ${state?.file}`);

        // Only count markdown views (actual file tabs), not sidebar views like backlinks/outgoing-links
        // Sidebar views (backlink, outgoing-link, search, etc.) can have state.file but they're not actual open file tabs
        // undefined viewType is for test compatibility
        if ((viewType === 'markdown' || viewType === undefined) && state && typeof state.file !== 'undefined') {
          this.workspaceLeaves[state.file] = leaf;
        }
      });
      debug(`Found ${Object.keys(this.workspaceLeaves).length} actual file tabs open: ${Object.keys(this.workspaceLeaves).join(', ')}`);
    }

    return this.workspaceLeaves;
  }

  private async handleClose(setting: IPeriodicitySettings, cls: Note, newNote: TFile): Promise<void> {
    if (setting.closeExisting) {
      debug('Checking for any existing notes to close');
      const existingNotes = cls.getAllPaths();
      const toDetach: WorkspaceLeaf[] = [];
      Object.entries(this.getOpenWorkspaceLeaves()).forEach(([file, leaf]) => {
        if (existingNotes.indexOf(file) > -1) {
          toDetach.push(leaf);
        }
      });

      // Ensure that it won't close anything if the new note is already open - this is to protect against ongoing workspace management
      if (Object.keys(this.getOpenWorkspaceLeaves()).indexOf(newNote.path) === -1) {
        debug('Found ' + toDetach.length + ' tab(s) to close');
        for (const leaf of toDetach) {
          leaf.detach();
        }
      }

      // Ensure that it waits a second for the new tab to have been created if ALL existing leaves have been detached
      await new Promise(resolve => setTimeout(resolve, this.waitTimeout));
    }
  }

  private async handleOpen(setting: IPeriodicitySettings, newNote: TFile, term?: string): Promise<void> {
    const openLeaves = this.getOpenWorkspaceLeaves();
    const isAlreadyOpen = Object.keys(openLeaves).indexOf(newNote.path) !== -1;

    debug(`handleOpen called: openAndPin=${setting.openAndPin}, notePath=${newNote.path}, isAlreadyOpen=${isAlreadyOpen}, openLeavesCount=${Object.keys(openLeaves).length}`);

    if (setting.openAndPin && !isAlreadyOpen) {
      debug('Opening note in new tab');

      // Check if this is a daily note with openAtFirstPosition enabled
      const shouldOpenAtFirstPosition = term === 'daily' &&
        'openAtFirstPosition' in setting &&
        (setting as any).openAtFirstPosition;

      let leaf: WorkspaceLeaf;

      if (shouldOpenAtFirstPosition) {
        // Signal to the monkey patch that we're creating a daily note
        this.plugin.setDailyNoteCreation(true);

        try {
          // Use standard getLeaf - our monkey patch will intercept and create at first position
          leaf = this.workspace.getLeaf('tab');
          debug('Used monkey patch to create daily note leaf at first position');
        } finally {
          // Always clear the signal
          this.plugin.setDailyNoteCreation(false);
        }
      } else {
        leaf = this.workspace.getLeaf(true);
      }

      await leaf.openFile(newNote);

      debug(`Before setPinned - leaf parent has ${(leaf.parent as any)?.children?.length || 0} children`);

      leaf.setPinned(true);

      debug(`After setPinned - leaf parent has ${(leaf.parent as any)?.children?.length || 0} children`);

      // If this is a daily note that should be at first position, ensure it stays there after pinning
      if (shouldOpenAtFirstPosition) {
        const parent = leaf.parent as any;
        if (parent && parent.children) {
          const currentIndex = parent.children.indexOf(leaf);
          debug(`Daily note leaf is at index ${currentIndex} after pinning, moving to index 0`);

          if (currentIndex > 0) {
            // Move the leaf to first position
            parent.children.splice(currentIndex, 1);
            parent.children.unshift(leaf);
            parent.recomputeChildrenDimensions();
            debug(`Moved daily note leaf to first position`);
          }
        }
      }
    }
  }


  // Helper method to check if a leaf is empty and can be reused
  private isEmptyLeaf(leaf: WorkspaceLeaf): boolean {
    const viewType = leaf.view.getViewType();
    return ["empty", "home-tab-view"].includes(viewType);
  }
}
