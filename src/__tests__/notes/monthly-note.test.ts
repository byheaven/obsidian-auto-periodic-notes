import { moment, TFile } from 'obsidian';
import * as dailyNotesInterface from 'obsidian-daily-notes-interface';
import MonthlyNote from '../../notes/monthly-note';

jest.mock('obsidian-daily-notes-interface');

describe('Monthly Note', () => {

  let mockGetAllNotes: jest.MockedFunction<typeof dailyNotesInterface.getAllMonthlyNotes>;

  beforeEach(() => {
    const emptyRecord: Record<string, TFile> = {};
    mockGetAllNotes = dailyNotesInterface.getAllMonthlyNotes as jest.MockedFunction<typeof dailyNotesInterface.getAllMonthlyNotes>;
    mockGetAllNotes.mockReturnValue(emptyRecord);
  });

  afterEach(() => {
    mockGetAllNotes.mockReset();
  });

  it('gets the paths of all notes', () => {
    const files: Record<string, TFile> = {
      example1: new TFile(),
      example2: new TFile(),
    };
    files.example1.path = 'example/example-1.md';
    files.example2.path = 'example/example-2.md';
    mockGetAllNotes.mockReturnValue(files);

    const sut = new MonthlyNote();
    const result = sut.getAllPaths();

    expect(result.length).toEqual(2);
    expect(result[0]).toEqual('example/example-1.md');
    expect(result[1]).toEqual('example/example-2.md');
  });
  
  it('returns if present', () => {
    const mock = dailyNotesInterface.getMonthlyNote as jest.MockedFunction<typeof dailyNotesInterface.getMonthlyNote>;
    mock.mockImplementation(() => {
      const file = new TFile();
      file.basename = 'example';
      return file;
    });

    const sut = new MonthlyNote();
    const result = sut.isPresent();

    expect(result).toEqual(true);

    mock.mockReset();
  });

  it('creates a new note', async () => {
    const mock = dailyNotesInterface.createMonthlyNote as jest.MockedFunction<typeof dailyNotesInterface.createMonthlyNote>;
    mock.mockImplementation(async () => {
      const file = new TFile();
      file.basename = 'example';
      return file;
    });

    const sut = new MonthlyNote();
    const result = await sut.create();

    expect(result.basename).toEqual('example');

    mock.mockReset();
  });

  it('returns current note', () => {
    const mock = dailyNotesInterface.getMonthlyNote as jest.MockedFunction<typeof dailyNotesInterface.getMonthlyNote>;
    const fileName = moment().format('YYYY-MM-DD');
    mock.mockImplementation(() => {
      const file = new TFile();
      file.basename = fileName;
      return file;
    });

    const sut = new MonthlyNote();
    const result = sut.getCurrent();
    
    expect(result.basename).toEqual(fileName);
  });

});
