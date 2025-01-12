import { MarkdownView, Notice, TFile, Workspace, WorkspaceLeaf } from 'obsidian';
import DailyNote from '../../notes/daily-note';
import MonthlyNote from '../../notes/monthly-note';
import { NotesProvider } from '../../notes/provider';
import QuarterlyNote from '../../notes/quarterly-note';
import WeeklyNote from '../../notes/weekly-note';
import YearlyNote from '../../notes/yearly-note';
import type { ISettings } from '../../settings';

jest.mock('obsidian');
jest.mock('../../notes/daily-note');
jest.mock('../../notes/weekly-note');
jest.mock('../../notes/monthly-note');
jest.mock('../../notes/quarterly-note');
jest.mock('../../notes/yearly-note');

describe('Notes Provider', () => {

  let settings: ISettings;
  
  beforeEach(() => {
    settings = {
      daily: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false,
      },
      weekly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false,
      },
      monthly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false,
      },
      quarterly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false,
      },
      yearly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false,
      },
    };
  });

  afterEach(() => {
    jest.resetAllMocks();
  })

  it('does not create notes when nothing is available', async () => {
    const spyYearlyIsPresent = jest.spyOn(YearlyNote.prototype, 'isPresent');
    const spyQuarterlyIsPresent = jest.spyOn(QuarterlyNote.prototype, 'isPresent');
    const spyMonthlyIsPresent = jest.spyOn(MonthlyNote.prototype, 'isPresent');
    const spyWeeklyIsPresent = jest.spyOn(WeeklyNote.prototype, 'isPresent');
    const spyDailyIsPresent = jest.spyOn(DailyNote.prototype, 'isPresent');

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(YearlyNote).toHaveBeenCalled();
    expect(QuarterlyNote).toHaveBeenCalled();
    expect(MonthlyNote).toHaveBeenCalled();
    expect(WeeklyNote).toHaveBeenCalled();
    expect(DailyNote).toHaveBeenCalled();
    expect(spyYearlyIsPresent).not.toHaveBeenCalled();
    expect(spyQuarterlyIsPresent).not.toHaveBeenCalled();
    expect(spyMonthlyIsPresent).not.toHaveBeenCalled();
    expect(spyWeeklyIsPresent).not.toHaveBeenCalled();
    expect(spyDailyIsPresent).not.toHaveBeenCalled();
  });

  it('does not create notes when nothing is enabled', async () => {
    settings.daily.available = true;

    const spyYearlyIsPresent = jest.spyOn(YearlyNote.prototype, 'isPresent');
    const spyQuarterlyIsPresent = jest.spyOn(QuarterlyNote.prototype, 'isPresent');
    const spyMonthlyIsPresent = jest.spyOn(MonthlyNote.prototype, 'isPresent');
    const spyWeeklyIsPresent = jest.spyOn(WeeklyNote.prototype, 'isPresent');
    const spyDailyIsPresent = jest.spyOn(DailyNote.prototype, 'isPresent');

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(YearlyNote).toHaveBeenCalled();
    expect(QuarterlyNote).toHaveBeenCalled();
    expect(MonthlyNote).toHaveBeenCalled();
    expect(WeeklyNote).toHaveBeenCalled();
    expect(DailyNote).toHaveBeenCalled();
    expect(spyYearlyIsPresent).not.toHaveBeenCalled();
    expect(spyQuarterlyIsPresent).not.toHaveBeenCalled();
    expect(spyMonthlyIsPresent).not.toHaveBeenCalled();
    expect(spyWeeklyIsPresent).not.toHaveBeenCalled();
    expect(spyDailyIsPresent).not.toHaveBeenCalled();
  });

  it('does not create notes when they already exist', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => true);
    const spyDailyCreate = jest.spyOn(DailyNote.prototype, 'create');

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(spyDailyCreate).not.toHaveBeenCalled();
  });

  it('creates notes when missing', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(new TFile()));

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(mockDailyCreate).toHaveBeenCalled();
    expect(Notice).toHaveBeenCalledWith(`Today's daily note has been created.`, 5000);
  });

  it('closes existing notes, but does nothing when none are found', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.closeExisting = true;

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(new TFile()));
    const mockDailyGetAllPaths = DailyNote.prototype.getAllPaths as jest.MockedFunction<typeof DailyNote.prototype.getAllPaths>;
    mockDailyGetAllPaths.mockReturnValue([]);
    const mockIterateRootLeaves = Workspace.prototype.iterateRootLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateRootLeaves>;
    mockIterateRootLeaves.mockImplementation((cb) => {
      [].map(cb);
    });

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateRootLeaves).toHaveBeenCalled();
  });

  it('closes existing notes, only closing those that are matched', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.closeExisting = true;

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(new TFile()));
    const mockDailyGetAllPaths = DailyNote.prototype.getAllPaths as jest.MockedFunction<typeof DailyNote.prototype.getAllPaths>;
    mockDailyGetAllPaths.mockReturnValue(['daily/2025-01-01.md']);
    const mockIterateRootLeaves = Workspace.prototype.iterateRootLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateRootLeaves>;
    const mockWorkspaceLeafDetach = WorkspaceLeaf.prototype.detach as jest.MockedFunction<typeof WorkspaceLeaf.prototype.detach>;
    const mockViewGetState = MarkdownView.prototype.getState as jest.MockedFunction<typeof MarkdownView.prototype.getState>;
    mockViewGetState.mockReturnValueOnce(undefined)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({file: 'not-a-daily-file.md'})
      .mockReturnValueOnce({file: 'daily/2025-01-01.md'});
    const leaves: WorkspaceLeaf[] = [];
    leaves.push(new WorkspaceLeaf());
    leaves.push(new WorkspaceLeaf());
    leaves.push(new WorkspaceLeaf());
    leaves.push(new WorkspaceLeaf());
    leaves[0].view = new MarkdownView(leaves[0]);
    leaves[1].view = new MarkdownView(leaves[1]);
    leaves[2].view = new MarkdownView(leaves[2]);
    leaves[3].view = new MarkdownView(leaves[3]);
    mockIterateRootLeaves.mockImplementation((cb) => {
      leaves.map(cb);
    });

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateRootLeaves).toHaveBeenCalled();
    expect(mockWorkspaceLeafDetach).toHaveBeenCalledTimes(1);
  });

  it('pins new notes but ignores when most recent leaf call fails', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.openAndPin = true;

    const expectedFile = new TFile();
    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(expectedFile));
    const mockOpenFile = WorkspaceLeaf.prototype.openFile as jest.MockedFunction<typeof WorkspaceLeaf.prototype.openFile>;
    mockOpenFile.mockImplementation(() => Promise.resolve());
    const mockSetPinned = WorkspaceLeaf.prototype.setPinned as jest.MockedFunction<typeof WorkspaceLeaf.prototype.setPinned>;
    mockSetPinned.mockImplementation(() => {});
    const mockGetLeaf = Workspace.prototype.getLeaf as jest.MockedFunction<typeof Workspace.prototype.getLeaf>;
    mockGetLeaf.mockImplementation(() => new WorkspaceLeaf());
    const mockGetMostRecentLeaf = Workspace.prototype.getMostRecentLeaf as jest.MockedFunction<typeof Workspace.prototype.getMostRecentLeaf>;
    mockGetMostRecentLeaf.mockImplementation(() => null);

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(mockDailyCreate).toHaveBeenCalled();
    expect(mockOpenFile).toHaveBeenCalledWith(expectedFile);
    expect(mockSetPinned).not.toHaveBeenCalled();
  });

  it('pins new notes when enabled', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.openAndPin = true;

    const expectedFile = new TFile();
    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(expectedFile));
    const mockOpenFile = WorkspaceLeaf.prototype.openFile as jest.MockedFunction<typeof WorkspaceLeaf.prototype.openFile>;
    mockOpenFile.mockImplementation(() => Promise.resolve());
    const mockSetPinned = WorkspaceLeaf.prototype.setPinned as jest.MockedFunction<typeof WorkspaceLeaf.prototype.setPinned>;
    mockSetPinned.mockImplementation(() => {});
    const mockGetLeaf = Workspace.prototype.getLeaf as jest.MockedFunction<typeof Workspace.prototype.getLeaf>;
    mockGetLeaf.mockImplementation(() => new WorkspaceLeaf());
    const mockGetMostRecentLeaf = Workspace.prototype.getMostRecentLeaf as jest.MockedFunction<typeof Workspace.prototype.getMostRecentLeaf>;
    mockGetMostRecentLeaf.mockImplementation(() => new WorkspaceLeaf());

    const sut = new NotesProvider(new Workspace());
    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(mockDailyCreate).toHaveBeenCalled();
    expect(mockOpenFile).toHaveBeenCalledWith(expectedFile);
    expect(mockSetPinned).toHaveBeenCalled();
  });
  
});
