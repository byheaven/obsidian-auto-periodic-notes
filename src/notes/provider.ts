import { Notice, type TFile, type WorkspaceLeaf } from 'obsidian';
import { IPeriodicitySettings, ISettings } from 'src/settings';
import { ObsidianWorkspace } from 'src/types';
import Note from '.';
import DailyNote from './daily-note';
import MonthlyNote from './monthly-note';
import QuarterlyNote from './quarterly-note';
import WeeklyNote from './weekly-note';
import YearlyNote from './yearly-note';

export class NotesProvider {
  private workspace: ObsidianWorkspace;

  constructor(workspace: ObsidianWorkspace) {
    this.workspace = workspace;
  }

  async checkAndCreateNotes(settings: ISettings): Promise<void> {
    await this.checkAndCreateSingleNote(settings.yearly, new YearlyNote(), 'yearly');
    await this.checkAndCreateSingleNote(settings.quarterly, new QuarterlyNote(), 'quarterly');
    await this.checkAndCreateSingleNote(settings.monthly, new MonthlyNote(), 'monthly');
    await this.checkAndCreateSingleNote(settings.weekly, new WeeklyNote(), 'weekly');
    await this.checkAndCreateSingleNote(settings.daily, new DailyNote(), 'daily');
  }

  private async checkAndCreateSingleNote(setting: IPeriodicitySettings, cls: Note, term: string): Promise<void> {
    if (setting.available && setting.enabled) {
      if (!cls.isPresent()) {

        const newNote: TFile = await cls.create();
        new Notice(
          `Today's ${term} note has been created.`,
          5000
        );

        if (setting.closeExisting) {
          const existingNotes = cls.getAllPaths();
          const toDetach: WorkspaceLeaf[] = [];
          this.workspace.iterateRootLeaves((leaf) => {
            if (leaf.view.getState() && typeof leaf.view.getState().file !== 'undefined' && existingNotes.indexOf(leaf.view.getState().file) > -1) {
              toDetach.push(leaf);
            }
          });

          for (const leaf of toDetach) {
            leaf.detach();
          }

          // Ensure that it waits a second for the new tab to have been created if ALL existing leaves have been detached
          await Promise.all([setTimeout(() => {}, 1000)]);
        }

        if (setting.openAndPin) {
          await this.workspace.getLeaf(true).openFile(newNote);
          this.workspace.getMostRecentLeaf()?.setPinned(true);
        }
      }
    }
  }
}
