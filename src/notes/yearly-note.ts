import { Moment, unitOfTime } from 'moment';
import { moment, type TFile } from 'obsidian';
import { createYearlyNote, getAllYearlyNotes, getYearlyNote } from 'obsidian-daily-notes-interface';
import Note from '.';

const UNIT: unitOfTime.StartOf = 'year';

export default class YearlyNote extends Note {

  private date: Moment = moment();
  
  getAllPaths(): string[] {
    const allNotes: Record<string, TFile> = getAllYearlyNotes();

    return Object.entries(allNotes).map(([_, file]) => file.path);
  }
  
  isPresent(): boolean {
    const start: Moment = this.date.clone().startOf(UNIT);
    const allNotes: Record<string, TFile> = getAllYearlyNotes();
    const note: TFile = getYearlyNote(start, allNotes);
    
    return !!note;
  }
  
  async create(): Promise<TFile> {
    const start: Moment = this.date.clone().startOf(UNIT);
    return createYearlyNote(start);
  }
}
