import { TFile } from 'obsidian';
import * as dailyNotesInterface from 'obsidian-daily-notes-interface';
import YearlyNote from '../../notes/yearly-note';

jest.mock('obsidian-daily-notes-interface');

describe('Yearly Note', () => {

  let mockGetAllNotes: jest.MockedFunction<typeof dailyNotesInterface.getAllYearlyNotes>;

  beforeEach(() => {
    const emptyRecord: Record<string, TFile> = {};
    mockGetAllNotes = dailyNotesInterface.getAllYearlyNotes as jest.MockedFunction<typeof dailyNotesInterface.getAllYearlyNotes>;
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

    const sut = new YearlyNote();
    const result = sut.getAllPaths();

    expect(result.length).toEqual(2);
    expect(result[0]).toEqual('example/example-1.md');
    expect(result[1]).toEqual('example/example-2.md');
  });
  
  it('returns if present', () => {
    const mock = dailyNotesInterface.getYearlyNote as jest.MockedFunction<typeof dailyNotesInterface.getYearlyNote>;
    mock.mockImplementation(() => {
      const file = new TFile();
      file.basename = 'example';
      return file;
    });

    const sut = new YearlyNote();
    const result = sut.isPresent();

    expect(result).toEqual(true);

    mock.mockReset();
  });

  it('creates a new note', async () => {
    const mock = dailyNotesInterface.createYearlyNote as jest.MockedFunction<typeof dailyNotesInterface.createYearlyNote>;
    mock.mockImplementation(async () => {
      const file = new TFile();
      file.basename = 'example';
      return file;
    });

    const sut = new YearlyNote();
    const result = await sut.create();

    expect(result.basename).toEqual('example');

    mock.mockReset();
  });

});
