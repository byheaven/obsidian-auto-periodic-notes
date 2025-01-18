import { Moment, unitOfTime } from 'moment';
import { moment, type TFile } from 'obsidian';
import { createDailyNote, getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';
import Note from '.';

const UNIT: unitOfTime.StartOf = 'day';

export default class DailyNote extends Note {

  private date: Moment = moment();

  getAllPaths(): string[] {
    const allNotes: Record<string, TFile> = getAllDailyNotes();

    return Object.entries(allNotes).map(([_, file]) => file.path);
  }
  
  isPresent(): boolean {
    const start: Moment = this.date.clone().startOf(UNIT);
    const allNotes: Record<string, TFile> = getAllDailyNotes();
    const note: TFile = getDailyNote(start, allNotes);
    
    return !!note;
  }
  
  async create(): Promise<TFile> {
    const start: Moment = this.date.clone().startOf(UNIT);
    return createDailyNote(start);
  }

  getCurrent(): TFile {
    return getDailyNote(this.date, getAllDailyNotes());
  }
}
