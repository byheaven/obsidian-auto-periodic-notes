import { MarkdownView, Notice, TFile, Workspace, WorkspaceLeaf } from 'obsidian';
import { DailyNote, MonthlyNote, QuarterlyNote, WeeklyNote, YearlyNote } from 'obsidian-periodic-notes-provider';
import NotesProvider from '../../notes/provider';
import type { ISettings } from '../../settings';

jest.mock('obsidian');
jest.mock('obsidian-periodic-notes-provider');

const TEST_WAIT_TIMEOUT: number = 10;

describe('Notes Provider', () => {

  let settings: ISettings;
  let sut: NotesProvider;
  
  beforeEach(() => {
    settings = {
      alwaysOpen: false,
      daily: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false,
        excludeWeekends: false,
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

    sut = new NotesProvider(new Workspace(), TEST_WAIT_TIMEOUT);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('does not create notes when nothing is available', async () => {
    console.log(YearlyNote);
    const spyYearlyIsPresent = jest.spyOn(YearlyNote.prototype, 'isPresent');
    const spyQuarterlyIsPresent = jest.spyOn(QuarterlyNote.prototype, 'isPresent');
    const spyMonthlyIsPresent = jest.spyOn(MonthlyNote.prototype, 'isPresent');
    const spyWeeklyIsPresent = jest.spyOn(WeeklyNote.prototype, 'isPresent');
    const spyDailyIsPresent = jest.spyOn(DailyNote.prototype, 'isPresent');

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

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(spyDailyCreate).not.toHaveBeenCalled();
  });

  it('does not create daily notes when it is a Saturday', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.excludeWeekends = true;

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const spyDailyCreate = jest.spyOn(DailyNote.prototype, 'create');
    
    // Mock Date so moment's logic is untouched
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-18T12:00:00Z').getTime());

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(spyDailyCreate).not.toHaveBeenCalled();
  });

  it('does not create daily notes when it is a Sunday', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.excludeWeekends = true;

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const spyDailyCreate = jest.spyOn(DailyNote.prototype, 'create');
    
    // Mock Date so moment's logic is untouched
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-19T12:00:00Z').getTime());

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

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateRootLeaves).toHaveBeenCalled();
  });

  it('does not close existing notes when the new note is already open', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.closeExisting = true;

    const newFile: TFile = new TFile();
    newFile.path = 'daily/2025-01-18.md';
    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(newFile));
    const mockDailyGetAllPaths = DailyNote.prototype.getAllPaths as jest.MockedFunction<typeof DailyNote.prototype.getAllPaths>;
    mockDailyGetAllPaths.mockReturnValue(['daily/2025-01-01.md', newFile.path]);
    const mockIterateRootLeaves = Workspace.prototype.iterateRootLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateRootLeaves>;
    const mockWorkspaceLeafDetach = WorkspaceLeaf.prototype.detach as jest.MockedFunction<typeof WorkspaceLeaf.prototype.detach>;
    const mockViewGetState = MarkdownView.prototype.getState as jest.MockedFunction<typeof MarkdownView.prototype.getState>;
    mockViewGetState.mockReturnValueOnce(undefined)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({file: 'daily/2025-01-01.md'})
      .mockReturnValueOnce({file: newFile.path});
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

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateRootLeaves).toHaveBeenCalled();
    expect(mockWorkspaceLeafDetach).not.toHaveBeenCalled();
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

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateRootLeaves).toHaveBeenCalled();
    expect(mockWorkspaceLeafDetach).toHaveBeenCalledTimes(1);
  });

  it('does not pin new notes when the new note is already open', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.openAndPin = true;

    const expectedFile = new TFile();
    expectedFile.path = 'daily/2025-01-18.md';
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
    const mockIterateRootLeaves = Workspace.prototype.iterateRootLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateRootLeaves>;
    const mockViewGetState = MarkdownView.prototype.getState as jest.MockedFunction<typeof MarkdownView.prototype.getState>;
    mockViewGetState.mockReturnValueOnce(undefined)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({file: 'daily/2025-01-01.md'})
      .mockReturnValueOnce({file: expectedFile.path});
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

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(mockDailyCreate).toHaveBeenCalled();
    expect(mockOpenFile).not.toHaveBeenCalledWith(expectedFile);
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

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyIsPresent).toHaveBeenCalled();
    expect(mockDailyCreate).toHaveBeenCalled();
    expect(mockOpenFile).toHaveBeenCalledWith(expectedFile);
    expect(mockSetPinned).toHaveBeenCalled();
  });

  it('closes open files and pins new ones even when not creating', async () => {
    settings.alwaysOpen = true;
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.closeExisting = true;
    settings.daily.openAndPin = true;

    const expectedFile = new TFile();
    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => true);
    const mockGetCurrent = DailyNote.prototype.getCurrent as jest.MockedFunction<typeof DailyNote.prototype.getCurrent>;
    mockGetCurrent.mockImplementation(() => expectedFile);
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
    const mockOpenFile = WorkspaceLeaf.prototype.openFile as jest.MockedFunction<typeof WorkspaceLeaf.prototype.openFile>;
    mockOpenFile.mockImplementation(() => Promise.resolve());
    const mockSetPinned = WorkspaceLeaf.prototype.setPinned as jest.MockedFunction<typeof WorkspaceLeaf.prototype.setPinned>;
    mockSetPinned.mockImplementation(() => {});
    const mockGetLeaf = Workspace.prototype.getLeaf as jest.MockedFunction<typeof Workspace.prototype.getLeaf>;
    mockGetLeaf.mockImplementation(() => new WorkspaceLeaf());

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateRootLeaves).toHaveBeenCalled();
    expect(mockWorkspaceLeafDetach).toHaveBeenCalledTimes(1);
    expect(mockOpenFile).toHaveBeenCalledWith(expectedFile);
    expect(mockSetPinned).toHaveBeenCalled();
  });
  
});
