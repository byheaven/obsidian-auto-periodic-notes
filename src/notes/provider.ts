import { moment, Notice, TFile, WorkspaceLeaf, App } from 'obsidian';
import { IDailySettings, IPeriodicitySettings, ISettings } from 'src/settings';
import { ObsidianWorkspace } from 'src/types';
import debug from '../log';
import { DailyNote, MonthlyNote, Note, QuarterlyNote, WeeklyNote, YearlyNote } from 'obsidian-periodic-notes-provider';
import {
  // Daily
  createDailyNote, getDailyNote, getAllDailyNotes, getDailyNoteSettings, DEFAULT_DAILY_NOTE_FORMAT,
  // Weekly
  createWeeklyNote, getWeeklyNote, getAllWeeklyNotes, getWeeklyNoteSettings, DEFAULT_WEEKLY_NOTE_FORMAT,
  // Monthly
  createMonthlyNote, getMonthlyNote, getAllMonthlyNotes, getMonthlyNoteSettings, DEFAULT_MONTHLY_NOTE_FORMAT,
  // Quarterly
  createQuarterlyNote, getQuarterlyNote, getAllQuarterlyNotes, getQuarterlyNoteSettings, DEFAULT_QUARTERLY_NOTE_FORMAT,
  // Yearly
  createYearlyNote, getYearlyNote, getAllYearlyNotes, getYearlyNoteSettings, DEFAULT_YEARLY_NOTE_FORMAT,
} from 'obsidian-daily-notes-interface';
import { processTemplaterInFile } from '../templater';
import type AutoPeriodicNotes from '../index';

const DEFAULT_WAIT_TIMEOUT: number = 1000;

export interface CheckContext {
  scheduleName?: 'scheduledTime' | 'lateExecution' | 'startup';
}

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
    this.workspaceLeaves = {};
  }

  async checkAndCreateNotes(settings: ISettings, context?: CheckContext): Promise<void> {
    debug(`Checking if any new notes need to be created (context: ${context?.scheduleName || 'manual'})`);

    await this.checkAndCreateSingleNote(settings.yearly, new YearlyNote(), 'yearly', settings.alwaysOpen, settings.processTemplater, context);
    await this.checkAndCreateSingleNote(settings.quarterly, new QuarterlyNote(), 'quarterly', settings.alwaysOpen, settings.processTemplater, context);
    await this.checkAndCreateSingleNote(settings.monthly, new MonthlyNote(), 'monthly', settings.alwaysOpen, settings.processTemplater, context);
    await this.checkAndCreateSingleNote(settings.weekly, new WeeklyNote(), 'weekly', settings.alwaysOpen, settings.processTemplater, context);
    await this.checkAndCreateSingleNote(settings.daily, new DailyNote(), 'daily', settings.alwaysOpen, settings.processTemplater, context);
  }

  async checkAndCreateNextPeriodNotes(settings: ISettings, context?: CheckContext): Promise<void> {
    debug(`Creating next period notes (context: ${context?.scheduleName || 'manual'})`);

    await this.checkAndCreateSingleNote(settings.yearly, new YearlyNote(), 'yearly', settings.alwaysOpen, settings.processTemplater, context, true);
    await this.checkAndCreateSingleNote(settings.quarterly, new QuarterlyNote(), 'quarterly', settings.alwaysOpen, settings.processTemplater, context, true);
    await this.checkAndCreateSingleNote(settings.monthly, new MonthlyNote(), 'monthly', settings.alwaysOpen, settings.processTemplater, context, true);
    await this.checkAndCreateSingleNote(settings.weekly, new WeeklyNote(), 'weekly', settings.alwaysOpen, settings.processTemplater, context, true);
    await this.checkAndCreateSingleNote(settings.daily, new DailyNote(), 'daily', settings.alwaysOpen, settings.processTemplater, context, true);
  }

  private async checkAndCreateSingleNote(setting: IPeriodicitySettings, cls: Note, term: string, alwaysOpen: boolean, processTemplater: boolean, context?: CheckContext, nextPeriod: boolean = false): Promise<void> {
    if (setting.available && setting.enabled) {
      // Clear workspace leaves cache to get fresh state for this note check
      // This prevents stale "ghost" leaves from affecting our checks
      this.workspaceLeaves = {};

      debug(`Checking if ${term} note needs to be created`);

      // Special handling for daily notes with advanced features
      if (term === 'daily') {
        const dailySettings = setting as IDailySettings;

        // Determine which behavior to use based on context
        const isScheduledTime = context?.scheduleName === 'scheduledTime';
        const useAdvancedPath = isScheduledTime || nextPeriod || dailySettings.createTomorrowsNote || dailySettings.unpinOldDailyNotes;

        if (useAdvancedPath) {
          // Use obsidian-daily-notes-interface for date-specific operations
          let targetDate = moment();

          // Apply next period offset if requested
          if (nextPeriod) {
            targetDate = targetDate.add(1, 'day');

            // Skip weekends if excludeWeekends enabled
            if (dailySettings.excludeWeekends) {
              while (targetDate.format('dd') === 'Sa' || targetDate.format('dd') === 'Su') {
                targetDate = targetDate.add(1, 'day');
              }
            }

            debug(`Target date for next period: ${targetDate.format('YYYY-MM-DD')}`);
          } else if (isScheduledTime && dailySettings.createTomorrowsNote) {
            // Legacy: Only create tomorrow's note if this is the custom scheduled time AND createTomorrowsNote is enabled
            targetDate = targetDate.add(1, 'day');

            // Skip weekends if excludeWeekends enabled
            if (dailySettings.excludeWeekends) {
              while (targetDate.format('dd') === 'Sa' || targetDate.format('dd') === 'Su') {
                targetDate = targetDate.add(1, 'day');
              }
            }

            debug(`Target date for custom scheduled time: ${targetDate.format('YYYY-MM-DD')}`);
          } else if (dailySettings.excludeWeekends) {
            // Check weekends for today's note
            const dayOfWeek = targetDate.format('dd');
            if (dayOfWeek === 'Sa' || dayOfWeek === 'Su') {
              debug('Not creating new note as it is a weekend');
              return;
            }
          }

          // Check if note exists for target date
          const allDailyNotes = getAllDailyNotes();
          let existingNote = getDailyNote(targetDate, allDailyNotes);

          // Fallback: if cache doesn't have the note, check filesystem directly
          // This handles synced files that haven't been indexed yet
          if (!existingNote) {
            const noteSettings = getDailyNoteSettings();
            const format = noteSettings.format || DEFAULT_DAILY_NOTE_FORMAT;
            const folder = noteSettings.folder?.trim() || '';
            const filename = targetDate.format(format);
            const filepath = folder ? `${folder}/${filename}.md` : `${filename}.md`;

            const file = this.app.vault.getAbstractFileByPath(filepath);
            // Check if file exists and is a file (not a folder) - use duck typing for test compatibility
            if (file && 'path' in file && (file as TFile).path?.endsWith('.md')) {
              debug(`Note not in cache but exists in filesystem: ${filepath}`);
              existingNote = file as TFile;
            }
          }

          if (!existingNote) {
            // Create the note for target date
            debug(`Creating daily note for ${targetDate.format('YYYY-MM-DD')}`);
            const newNote = await createDailyNote(targetDate);

            // Determine if this is a future-dated note (tomorrow or later)
            // Check if targetDate is after today at the day level
            const today = moment();
            const isFutureNote = targetDate.isAfter(today, 'day');

            new Notice(
              isFutureNote
                ? `Tomorrow's daily note has been created.`
                : `Today's daily note has been created.`,
              5000
            );

            // Behavior differentiation: use unpin ONLY for custom scheduled time
            if (isScheduledTime && dailySettings.unpinOldDailyNotes) {
              await this.handleUnpin(setting, cls, newNote);
            } else {
              await this.handleClose(setting, cls, newNote);
            }

            await this.handleOpen(setting, newNote, term);

            if (processTemplater) {
              await processTemplaterInFile(this.app, newNote, true);
            }
          } else {
            // Note already exists - check if we need to handle existing tabs
            const isStartup = context?.scheduleName === 'startup';
            const shouldCloseOldNotes = isStartup && setting.closeExisting;
            const shouldUnpinOldNotes = isScheduledTime && dailySettings.unpinOldDailyNotes;
            // Always handle tabs for scheduledTime so that the note gets opened even if it already exists
            const shouldHandleTabs = alwaysOpen || shouldCloseOldNotes || shouldUnpinOldNotes || isScheduledTime;

            if (shouldHandleTabs) {
              debug(`Daily note exists for ${targetDate.format('YYYY-MM-DD')}, handling existing tabs`);

              if (shouldUnpinOldNotes) {
                await this.handleUnpin(setting, cls, existingNote);
              } else if (shouldCloseOldNotes) {
                await this.handleClose(setting, cls, existingNote);
              }

              // Open and pin today's note (for startup with closeExisting, or alwaysOpen)
              await this.handleOpen(setting, existingNote, term);
            }
          }
        } else {
          // Use original path for backward compatibility
          if (!cls.isPresent()) {
            if (dailySettings.excludeWeekends) {
              const today = moment();
              if (today.format('dd') === 'Sa' || today.format('dd') === 'Su') {
                debug('Not creating new note as it is a weekend');
                return;
              }
            }

            debug(`Creating new ${term} note`);
            const newNote: TFile = await cls.create();
            new Notice(`Today's ${term} note has been created.`, 5000);

            await this.handleClose(setting, cls, newNote);
            await this.handleOpen(setting, newNote, term);

            if (processTemplater) {
              await processTemplaterInFile(this.app, newNote, true);
            }
          } else if (alwaysOpen) {
            debug(`Set to always open notes, getting current ${term} note`);
            const existingNote: TFile = cls.getCurrent();
            await this.handleClose(setting, cls, existingNote);
            await this.handleOpen(setting, existingNote, term);
          }
        }
      } else {
        // Non-daily notes: weekly, monthly, quarterly, yearly
        const helpers = this.getPeriodicNoteHelpers(term);
        if (!helpers) {
          debug(`Unknown term: ${term}`);
          return;
        }

        // Determine which behavior to use based on context
        const isScheduledTime = context?.scheduleName === 'scheduledTime';
        const useAdvancedPath = isScheduledTime || nextPeriod;

        if (useAdvancedPath) {
          // Use obsidian-daily-notes-interface for date-specific operations
          let targetDate = moment();

          // Apply next period offset if requested
          if (nextPeriod) {
            targetDate = this.calculateNextPeriodDate(term, targetDate);
            debug(`Target date for next period ${term}: ${targetDate.format('YYYY-MM-DD')}`);
          }

          // Check if note exists for target date using library functions
          const allNotes = helpers.getAll();
          let existingNote = helpers.get(targetDate, allNotes);

          // Fallback: if cache doesn't have the note, check filesystem directly
          // This handles synced files that haven't been indexed yet
          if (!existingNote) {
            const noteSettings = helpers.getSettings();
            const format = noteSettings.format || helpers.defaultFormat;
            const folder = noteSettings.folder?.trim() || '';
            const filename = targetDate.format(format);
            const filepath = folder ? `${folder}/${filename}.md` : `${filename}.md`;

            const file = this.app.vault.getAbstractFileByPath(filepath);
            if (file && 'path' in file && (file as TFile).path?.endsWith('.md')) {
              debug(`${term} note not in cache but exists in filesystem: ${filepath}`);
              existingNote = file as TFile;
            }
          }

          if (!existingNote) {
            // Create the note for target date
            debug(`Creating ${term} note for ${targetDate.format('YYYY-MM-DD')}`);
            const newNote = await helpers.create(targetDate);

            const periodLabel = this.getPeriodLabel(term, nextPeriod);
            new Notice(`${periodLabel} note has been created.`, 5000);

            await this.handleClose(setting, cls, newNote);
            await this.handleOpen(setting, newNote, term);

            if (processTemplater) {
              await processTemplaterInFile(this.app, newNote, true);
            }
          } else {
            // Note already exists - check if we need to handle existing tabs
            const isStartup = context?.scheduleName === 'startup';
            const shouldCloseOldNotes = isStartup && setting.closeExisting;
            const shouldHandleTabs = alwaysOpen || shouldCloseOldNotes || isScheduledTime;

            if (shouldHandleTabs) {
              debug(`${term} note exists for ${targetDate.format('YYYY-MM-DD')}, handling existing tabs`);

              if (shouldCloseOldNotes) {
                await this.handleClose(setting, cls, existingNote);
              }

              await this.handleOpen(setting, existingNote, term);
            }
          }
        } else {
          // Use original path for backward compatibility (no advanced scheduling)
          if (!cls.isPresent()) {
            debug(`Creating new ${term} note`);
            const newNote: TFile = await cls.create();
            new Notice(`${this.getPeriodLabel(term, false)} note has been created.`, 5000);

            await this.handleClose(setting, cls, newNote);
            await this.handleOpen(setting, newNote, term);

            if (processTemplater) {
              await processTemplaterInFile(this.app, newNote, true);
            }
          } else if (alwaysOpen) {
            debug(`Set to always open notes, getting current ${term} note`);
            const existingNote: TFile = cls.getCurrent();
            await this.handleClose(setting, cls, existingNote);
            await this.handleOpen(setting, existingNote, term);
          }
        }
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

  private async handleClose(setting: IPeriodicitySettings, cls: Note, currentNote: TFile): Promise<void> {
    if (setting.closeExisting) {
      debug('Checking for any existing notes to close');
      const existingNotes = cls.getAllPaths();
      const toDetach: WorkspaceLeaf[] = [];
      Object.entries(this.getOpenWorkspaceLeaves()).forEach(([file, leaf]) => {
        // Close all periodic notes except the current one
        if (existingNotes.indexOf(file) > -1 && file !== currentNote.path) {
          toDetach.push(leaf);
        }
      });

      debug('Found ' + toDetach.length + ' tab(s) to close');
      for (const leaf of toDetach) {
        leaf.detach();
      }

      // Wait for workspace to settle
      await new Promise(resolve => setTimeout(resolve, this.waitTimeout));
    }
  }

  private async handleUnpin(setting: IPeriodicitySettings, cls: Note, newNote: TFile): Promise<void> {
    const dailySettings = setting as IDailySettings;
    if (dailySettings.unpinOldDailyNotes) {
      debug('Unpinning all old daily notes');

      const existingNotes = cls.getAllPaths();
      const toUnpin: WorkspaceLeaf[] = [];

      Object.entries(this.getOpenWorkspaceLeaves()).forEach(([file, leaf]) => {
        // Unpin all daily notes except the new one
        if (existingNotes.indexOf(file) > -1 && file !== newNote.path) {
          toUnpin.push(leaf);
        }
      });

      debug(`Found ${toUnpin.length} daily note tab(s) to unpin`);
      for (const leaf of toUnpin) {
        leaf.setPinned(false);
      }
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

  // Calculate next period date based on term
  private calculateNextPeriodDate(term: string, date: moment.Moment): moment.Moment {
    switch (term) {
      case 'daily':
        return date.clone().add(1, 'day');
      case 'weekly':
        return date.clone().add(1, 'week').startOf('week');
      case 'monthly':
        return date.clone().add(1, 'month').startOf('month');
      case 'quarterly':
        return date.clone().add(1, 'quarter').startOf('quarter');
      case 'yearly':
        return date.clone().add(1, 'year').startOf('year');
      default:
        return date;
    }
  }

  // Get user-friendly period label
  private getPeriodLabel(term: string, isFuture: boolean): string {
    const labels: Record<string, [string, string]> = {
      daily: ["Today's daily", "Tomorrow's daily"],
      weekly: ["This week's weekly", "Next week's weekly"],
      monthly: ["This month's monthly", "Next month's monthly"],
      quarterly: ["This quarter's quarterly", "Next quarter's quarterly"],
      yearly: ["This year's yearly", "Next year's yearly"],
    };
    return labels[term]?.[isFuture ? 1 : 0] || `${isFuture ? 'Next' : 'This'} ${term}`;
  }

  // Get helper functions for each note type
  private getPeriodicNoteHelpers(term: string) {
    const helpers = {
      daily: {
        create: createDailyNote,
        get: getDailyNote,
        getAll: getAllDailyNotes,
        getSettings: getDailyNoteSettings,
        defaultFormat: DEFAULT_DAILY_NOTE_FORMAT,
      },
      weekly: {
        create: createWeeklyNote,
        get: getWeeklyNote,
        getAll: getAllWeeklyNotes,
        getSettings: getWeeklyNoteSettings,
        defaultFormat: DEFAULT_WEEKLY_NOTE_FORMAT,
      },
      monthly: {
        create: createMonthlyNote,
        get: getMonthlyNote,
        getAll: getAllMonthlyNotes,
        getSettings: getMonthlyNoteSettings,
        defaultFormat: DEFAULT_MONTHLY_NOTE_FORMAT,
      },
      quarterly: {
        create: createQuarterlyNote,
        get: getQuarterlyNote,
        getAll: getAllQuarterlyNotes,
        getSettings: getQuarterlyNoteSettings,
        defaultFormat: DEFAULT_QUARTERLY_NOTE_FORMAT,
      },
      yearly: {
        create: createYearlyNote,
        get: getYearlyNote,
        getAll: getAllYearlyNotes,
        getSettings: getYearlyNoteSettings,
        defaultFormat: DEFAULT_YEARLY_NOTE_FORMAT,
      },
    };
    return helpers[term as keyof typeof helpers];
  }
}
