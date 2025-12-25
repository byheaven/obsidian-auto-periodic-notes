import { App, MarkdownView, Notice, TFile, Workspace, WorkspaceLeaf } from 'obsidian';
import { DailyNote, MonthlyNote, QuarterlyNote, WeeklyNote, YearlyNote } from 'obsidian-periodic-notes-provider';
import NotesProvider from '../../notes/provider';
import type { ISettings } from '../../settings';

jest.mock('obsidian');
jest.mock('obsidian-periodic-notes-provider');
jest.mock('obsidian-daily-notes-interface', () => ({
  getAllDailyNotes: jest.fn().mockReturnValue({}),
  getDailyNote: jest.fn().mockReturnValue(null),
  createDailyNote: jest.fn().mockImplementation(() => {
    const mockFile = {
      path: 'daily-note.md',
      name: 'daily-note.md',
      basename: 'daily-note',
      extension: 'md',
    } as TFile;
    return Promise.resolve(mockFile);
  }),
  getDailyNoteSettings: jest.fn().mockReturnValue({
    folder: 'daily',
    format: 'YYYY-MM-DD',
    template: '',
  }),
  DEFAULT_DAILY_NOTE_FORMAT: 'YYYY-MM-DD',
}));

const TEST_WAIT_TIMEOUT: number = 10;

describe('Notes Provider', () => {
  
  let settings: ISettings;
  let sut: NotesProvider;
  let mockPlugin: any;
  
  beforeEach(() => {
    settings = {
      alwaysOpen: false,
      processTemplater: false,
      debug: false,
      daily: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false,
        excludeWeekends: false,
        openAtFirstPosition: false,
        enableAdvancedScheduling: false,
        scheduledTime: "00:02",
        createTomorrowsNote: false,
        unpinOldDailyNotes: false,
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
      deviceSettings: {},
    };

    const mockApp = { workspace: new Workspace() } as any;
    mockPlugin = { setDailyNoteCreation: jest.fn() } as any;
    sut = new NotesProvider(new Workspace(), mockApp, mockPlugin, TEST_WAIT_TIMEOUT);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('does not create notes when nothing is available', async () => {
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

    const mockApp = { workspace: new Workspace() } as any;
    const mockPlugin = { setDailyNoteCreation: jest.fn() } as any;
    const sut = new NotesProvider(new Workspace(), mockApp, mockPlugin);
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

  it('processes Templater code when creating new notes and setting is enabled', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.processTemplater = true;

    const newFile = new TFile();
    newFile.path = 'daily/2025-01-18.md';

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(newFile));

    // Mock workspace leaf for Templater
    const mockLeaf = new WorkspaceLeaf();
    mockLeaf.openFile = jest.fn().mockResolvedValue(undefined);
    mockLeaf.detach = jest.fn();

    // Mock the Templater plugin
    const mockTemplaterPlugin = {
      settings: {
        trigger_on_file_creation: false,
      },
      templater: {
        overwrite_active_file_commands: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create a new provider with mocked app that has Templater plugin
    const mockApp = new App();
    (mockApp as any).plugins = {
      plugins: {
        'templater-obsidian': mockTemplaterPlugin,
      },
    };
    (mockApp as any).workspace = {
      getActiveFile: jest.fn().mockReturnValue(null),
      getLeaf: jest.fn().mockReturnValue(mockLeaf),
    };
    (mockApp as any).vault = {
      read: jest.fn().mockResolvedValue('file content'),
    };

    const mockPlugin = { setDailyNoteCreation: jest.fn() } as any;
    const sutWithTemplater = new NotesProvider(new Workspace(), mockApp, mockPlugin, TEST_WAIT_TIMEOUT);

    await sutWithTemplater.checkAndCreateNotes(settings);

    expect(mockDailyCreate).toHaveBeenCalled();
    expect(mockTemplaterPlugin.templater.overwrite_active_file_commands).toHaveBeenCalled();
  });

  it('does not process Templater code when setting is disabled', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.processTemplater = false;

    const newFile = new TFile();
    newFile.path = 'daily/2025-01-18.md';

    const mockDailyIsPresent = DailyNote.prototype.isPresent as jest.MockedFunction<typeof DailyNote.prototype.isPresent>;
    mockDailyIsPresent.mockImplementation(() => false);
    const mockDailyCreate = DailyNote.prototype.create as jest.MockedFunction<typeof DailyNote.prototype.create>;
    mockDailyCreate.mockImplementation(() => Promise.resolve(newFile));

    // Mock workspace leaf for Templater
    const mockLeaf = new WorkspaceLeaf();
    mockLeaf.openFile = jest.fn().mockResolvedValue(undefined);
    mockLeaf.detach = jest.fn();

    // Mock the Templater plugin
    const mockTemplaterPlugin = {
      settings: {
        trigger_on_file_creation: false,
      },
      templater: {
        overwrite_active_file_commands: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Create a new provider with mocked app that has Templater plugin
    const mockApp = new App();
    (mockApp as any).plugins = {
      plugins: {
        'templater-obsidian': mockTemplaterPlugin,
      },
    };
    (mockApp as any).workspace = {
      getActiveFile: jest.fn().mockReturnValue(null),
      getLeaf: jest.fn().mockReturnValue(mockLeaf),
    };
    (mockApp as any).vault = {
      read: jest.fn().mockResolvedValue('file content'),
    };

    const mockPlugin = { setDailyNoteCreation: jest.fn() } as any;
    const sutWithTemplater = new NotesProvider(new Workspace(), mockApp, mockPlugin, TEST_WAIT_TIMEOUT);

    await sutWithTemplater.checkAndCreateNotes(settings);

    expect(mockDailyCreate).toHaveBeenCalled();
    expect(mockTemplaterPlugin.templater.overwrite_active_file_commands).not.toHaveBeenCalled();
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
    const mockIterateAllLeaves = Workspace.prototype.iterateAllLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateAllLeaves>;
    mockIterateAllLeaves.mockImplementation((cb) => {
      [].map(cb);
    });

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateAllLeaves).toHaveBeenCalled();
  });

  it('closes old notes but keeps the current note open', async () => {
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
    const mockIterateAllLeaves = Workspace.prototype.iterateAllLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateAllLeaves>;
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
    mockIterateAllLeaves.mockImplementation((cb) => {
      leaves.map(cb);
    });

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateAllLeaves).toHaveBeenCalled();
    // Should close old daily note (leaves[2]) but NOT the current one (leaves[3])
    expect(mockWorkspaceLeafDetach).toHaveBeenCalledTimes(1);
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
    const mockIterateAllLeaves = Workspace.prototype.iterateAllLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateAllLeaves>;
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
    mockIterateAllLeaves.mockImplementation((cb) => {
      leaves.map(cb);
    });

    await sut.checkAndCreateNotes(settings);

    expect(DailyNote).toHaveBeenCalled();
    expect(mockDailyGetAllPaths).toHaveBeenCalled();
    expect(mockIterateAllLeaves).toHaveBeenCalled();
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
    const mockIterateAllLeaves = Workspace.prototype.iterateAllLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateAllLeaves>;
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
    mockIterateAllLeaves.mockImplementation((cb) => {
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

  it('opens daily notes at first position when enabled', async () => {
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.openAndPin = true;
    settings.daily.openAtFirstPosition = true;

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
    expect(mockDailyCreate).toHaveBeenCalled();
    expect(mockGetLeaf).toHaveBeenCalledWith('tab');
    expect(mockOpenFile).toHaveBeenCalledWith(expectedFile);
    expect(mockSetPinned).toHaveBeenCalled();
    expect(mockPlugin.setDailyNoteCreation).toHaveBeenNthCalledWith(1, true);
    expect(mockPlugin.setDailyNoteCreation).toHaveBeenNthCalledWith(2, false);
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
    const mockIterateAllLeaves = Workspace.prototype.iterateAllLeaves as jest.MockedFunction<typeof Workspace.prototype.iterateAllLeaves>;
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
    mockIterateAllLeaves.mockImplementation((cb) => {
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
    expect(mockIterateAllLeaves).toHaveBeenCalled();
    expect(mockWorkspaceLeafDetach).toHaveBeenCalledTimes(1);
    expect(mockOpenFile).toHaveBeenCalledWith(expectedFile);
    expect(mockSetPinned).toHaveBeenCalled();
  });

  it('opens synced file via filesystem fallback when not in cache (scheduledTime)', async () => {
    // This tests the scenario where a file was synced from another device
    // but hasn't been indexed by Obsidian's metadata cache yet
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.openAndPin = true;
    settings.daily.enableAdvancedScheduling = true;
    // Don't use createTomorrowsNote to avoid timezone issues in tests
    settings.daily.createTomorrowsNote = false;

    // Mock Date to a specific date (use noon to avoid timezone issues)
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-20T12:00:00Z').getTime());

    // The synced file that exists on filesystem but not in cache (today's note)
    // Create with proper path property
    const syncedFile = {
      path: 'daily/2025-01-20.md',
      name: '2025-01-20.md',
      basename: '2025-01-20',
      extension: 'md',
    } as TFile;

    // getDailyNote returns null (not in cache), getDailyNoteSettings returns settings
    const { getDailyNote, createDailyNote, getDailyNoteSettings } = require('obsidian-daily-notes-interface');
    getDailyNote.mockReturnValue(null);
    getDailyNoteSettings.mockReturnValue({
      folder: 'daily',
      format: 'YYYY-MM-DD',
      template: '',
    });

    // Create mock app with vault that can find the file
    const mockVaultGetAbstractFileByPath = jest.fn().mockImplementation((path: string) => {
      if (path === 'daily/2025-01-20.md') {
        return syncedFile;
      }
      return null;
    });
    const mockApp = {
      workspace: new Workspace(),
      vault: {
        getAbstractFileByPath: mockVaultGetAbstractFileByPath,
      },
    } as any;

    const mockOpenFile = WorkspaceLeaf.prototype.openFile as jest.MockedFunction<typeof WorkspaceLeaf.prototype.openFile>;
    mockOpenFile.mockImplementation(() => Promise.resolve());
    const mockSetPinned = WorkspaceLeaf.prototype.setPinned as jest.MockedFunction<typeof WorkspaceLeaf.prototype.setPinned>;
    mockSetPinned.mockImplementation(() => {});
    const mockGetLeaf = Workspace.prototype.getLeaf as jest.MockedFunction<typeof Workspace.prototype.getLeaf>;
    mockGetLeaf.mockImplementation(() => new WorkspaceLeaf());

    const mockPlugin = { setDailyNoteCreation: jest.fn() } as any;
    const sutWithVault = new NotesProvider(new Workspace(), mockApp, mockPlugin, TEST_WAIT_TIMEOUT);

    await sutWithVault.checkAndCreateNotes(settings, { scheduleName: 'scheduledTime' });

    // Should find the file via filesystem fallback
    expect(mockVaultGetAbstractFileByPath).toHaveBeenCalledWith('daily/2025-01-20.md');
    // Should NOT create a new file since it exists on filesystem
    expect(createDailyNote).not.toHaveBeenCalled();
    // Should open the synced file
    expect(mockOpenFile).toHaveBeenCalledWith(syncedFile);
    expect(mockSetPinned).toHaveBeenCalled();
  });

});
