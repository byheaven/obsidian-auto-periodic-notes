import { moment, Notice, type TFile, type WorkspaceLeaf } from 'obsidian';
import { IDailySettings, IPeriodicitySettings, ISettings } from 'src/settings';
import { ObsidianWorkspace } from 'src/types';
import Note from '.';
import DailyNote from './daily-note';
import MonthlyNote from './monthly-note';
import QuarterlyNote from './quarterly-note';
import WeeklyNote from './weekly-note';
import YearlyNote from './yearly-note';

export class NotesProvider {
  private workspace: ObsidianWorkspace;
  private workspaceLeaves: Record<string, WorkspaceLeaf>;

  constructor(workspace: ObsidianWorkspace) {
    this.workspace = workspace;
  }

  async checkAndCreateNotes(settings: ISettings): Promise<void> {
    this.workspaceLeaves = {};

    await this.checkAndCreateSingleNote(settings.yearly, new YearlyNote(), 'yearly', settings.alwaysOpen);
    await this.checkAndCreateSingleNote(settings.quarterly, new QuarterlyNote(), 'quarterly', settings.alwaysOpen);
    await this.checkAndCreateSingleNote(settings.monthly, new MonthlyNote(), 'monthly', settings.alwaysOpen);
    await this.checkAndCreateSingleNote(settings.weekly, new WeeklyNote(), 'weekly', settings.alwaysOpen);
    await this.checkAndCreateSingleNote(settings.daily, new DailyNote(), 'daily', settings.alwaysOpen);
  }

  private async checkAndCreateSingleNote(setting: IPeriodicitySettings, cls: Note, term: string, alwaysOpen: boolean): Promise<void> {
    if (setting.available && setting.enabled) {
      
      if (!cls.isPresent()) {

        if (term === 'daily' && (setting as IDailySettings).excludeWeekends) {
          const today = moment();
          if (today.format('dd') === 'Sa' || today.format('dd') === 'Su') {
            return;
          }
        }

        const newNote: TFile = await cls.create();
        new Notice(
          `Today's ${term} note has been created.`,
          5000
        );

        await this.handleClose(setting, cls, newNote);
        await this.handleOpen(setting, newNote);

      } else if (alwaysOpen) {

        const existingNote: TFile = cls.getCurrent();

        await this.handleClose(setting, cls, existingNote);
        await this.handleOpen(setting, existingNote);
        
      }

    }
  }

  private getOpenWorkspaceLeaves(): Record<string, WorkspaceLeaf> {
    if (!Object.keys(this.workspaceLeaves).length) {
      this.workspace.iterateRootLeaves((leaf) => {
        if (leaf.view.getState() && typeof leaf.view.getState().file !== 'undefined') {
          this.workspaceLeaves[leaf.view.getState().file] = leaf;
        }
      });
    }

    return this.workspaceLeaves;
  }

  private async handleClose(setting: IPeriodicitySettings, cls: Note, newNote: TFile): Promise<void> {
    if (setting.closeExisting) {
      const existingNotes = cls.getAllPaths();
      const toDetach: WorkspaceLeaf[] = [];
      Object.entries(this.getOpenWorkspaceLeaves()).forEach(([file, leaf]) => {
        if (existingNotes.indexOf(file) > -1) {
          toDetach.push(leaf);
        }
      });

      // Ensure that it won't close anything if the new note is already open - this is to protect against ongoing workspace management
      if (Object.keys(this.getOpenWorkspaceLeaves()).indexOf(newNote.path) === -1) {
        for (const leaf of toDetach) {
          leaf.detach();
        }
      }

      // Ensure that it waits a second for the new tab to have been created if ALL existing leaves have been detached
      await Promise.all([setTimeout(() => {}, 1000)]);
    }
  }

  private async handleOpen(setting: IPeriodicitySettings, newNote: TFile): Promise<void> {
    if (setting.openAndPin && Object.keys(this.getOpenWorkspaceLeaves()).indexOf(newNote.path) === -1) {
      await this.workspace.getLeaf(true).openFile(newNote);
      this.workspace.getMostRecentLeaf()?.setPinned(true);
    }
  }
}
