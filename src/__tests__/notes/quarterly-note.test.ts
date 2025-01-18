import { moment, TFile } from 'obsidian';
import * as dailyNotesInterface from 'obsidian-daily-notes-interface';
import QuarterlyNote from '../../notes/quarterly-note';

jest.mock('obsidian-daily-notes-interface');

describe('Quarterly Note', () => {

  let mockGetAllNotes: jest.MockedFunction<typeof dailyNotesInterface.getAllQuarterlyNotes>;

  beforeEach(() => {
    const emptyRecord: Record<string, TFile> = {};
    mockGetAllNotes = dailyNotesInterface.getAllQuarterlyNotes as jest.MockedFunction<typeof dailyNotesInterface.getAllQuarterlyNotes>;
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

    const sut = new QuarterlyNote();
    const result = sut.getAllPaths();

    expect(result.length).toEqual(2);
    expect(result[0]).toEqual('example/example-1.md');
    expect(result[1]).toEqual('example/example-2.md');
  });
  
  it('returns if present', () => {
    const mock = dailyNotesInterface.getQuarterlyNote as jest.MockedFunction<typeof dailyNotesInterface.getQuarterlyNote>;
    mock.mockImplementation(() => {
      const file = new TFile();
      file.basename = 'example';
      return file;
    });

    const sut = new QuarterlyNote();
    const result = sut.isPresent();

    expect(result).toEqual(true);

    mock.mockReset();
  });

  it('creates a new note', async () => {
    const mock = dailyNotesInterface.createQuarterlyNote as jest.MockedFunction<typeof dailyNotesInterface.createQuarterlyNote>;
    mock.mockImplementation(async () => {
      const file = new TFile();
      file.basename = 'example';
      return file;
    });

    const sut = new QuarterlyNote();
    const result = await sut.create();

    expect(result.basename).toEqual('example');

    mock.mockReset();
  });

  it('returns current note', () => {
    const mock = dailyNotesInterface.getQuarterlyNote as jest.MockedFunction<typeof dailyNotesInterface.getQuarterlyNote>;
    const fileName = moment().format('YYYY-MM-DD');
    mock.mockImplementation(() => {
      const file = new TFile();
      file.basename = fileName;
      return file;
    });

    const sut = new QuarterlyNote();
    const result = sut.getCurrent();
    
    expect(result.basename).toEqual(fileName);
  });

});
