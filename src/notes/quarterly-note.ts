import { Moment, unitOfTime } from 'moment';
import { moment, type TFile } from 'obsidian';
import { createQuarterlyNote, getAllQuarterlyNotes, getQuarterlyNote } from 'obsidian-daily-notes-interface';
import Note from '.';

const UNIT: unitOfTime.StartOf = 'quarter';

export default class QuarterlyNote extends Note {

  private date: Moment = moment();
  
  getAllPaths(): string[] {
    const allNotes: Record<string, TFile> = getAllQuarterlyNotes();

    return Object.entries(allNotes).map(([_, file]) => file.path);
  }
  
  isPresent(): boolean {
    const start: Moment = this.date.clone().startOf(UNIT);
    const allNotes: Record<string, TFile> = getAllQuarterlyNotes();
    const note: TFile = getQuarterlyNote(start, allNotes);
    
    return !!note;
  }
  
  async create(): Promise<TFile> {
    const start: Moment = this.date.clone().startOf(UNIT);
    return createQuarterlyNote(start);
  }
  
  getCurrent(): TFile {
    return getQuarterlyNote(this.date, getAllQuarterlyNotes());
  }
}
