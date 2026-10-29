import { readFileSync } from 'fs';
import { EventRef, PluginManifest, PluginSettingTab, TAbstractFile } from 'obsidian';
import { DailyNote } from 'obsidian-periodic-notes-provider';
import AutoPeriodicNotes from '../';
import { DEFAULT_SETTINGS } from '../settings';
import type { ObsidianApp } from '../types';

// One synced vault shared by the devices under test; Obsidian fires 'create' for every new file, including
// files the plugin itself creates.
const mockVault = {
  paths: new Set<string>(),
  created: [] as string[],
  listeners: [] as ((file: TAbstractFile) => void)[],
  get(path: string): { path: string } | null {
    return mockVault.paths.has(path) ? { path } : null;
  },
  add(path: string): { path: string } {
    mockVault.paths.add(path);
    mockVault.listeners.forEach((listener) => listener({ path } as TAbstractFile));
    return { path };
  },
  create(path: string): { path: string } {
    mockVault.created.push(path);
    return mockVault.add(path);
  },
};

jest.mock('obsidian-periodic-notes-provider');
jest.mock('obsidian-daily-notes-interface', () => ({
  DEFAULT_DAILY_NOTE_FORMAT: 'YYYY-MM-DD',
  getDailyNoteSettings: () => ({ folder: 'journals', format: 'YYYY-MM-DD', template: '' }),
  getAllDailyNotes: () => ({}),
  getDailyNote: (date: { format(format: string): string }) => mockVault.get(`journals/${date.format('YYYY-MM-DD')}.md`),
  createDailyNote: async (date: { format(format: string): string }) => mockVault.create(`journals/${date.format('YYYY-MM-DD')}.md`),
}));

const day = (date: string) => `journals/${date}.md`;
const PREVIOUS = day('2026-10-27');
const TODAY = day('2026-10-28');
const TOMORROW = day('2026-10-29');
const INBOX = 'Inbox.md';

// The user's settings; the scheduled time is synced, the creation switch is not.
function syncedSettings(scheduledTime = '22:30'): Record<string, unknown> {
  return {
    ...DEFAULT_SETTINGS,
    alwaysOpen: true,
    daily: {
      ...DEFAULT_SETTINGS.daily,
      enabled: true,
      openAndPin: true,
      openAtFirstPosition: true,
      closeExisting: true,
      enableAdvancedScheduling: true,
      scheduledTime,
      createTomorrowsNote: true,
      unpinOldDailyNotes: true,
    },
  };
}

class FakeLeaf {
  public pinned = false;
  public view = {
    getViewType: () => 'markdown',
    getState: () => ({ file: this.file }),
  };

  constructor(public parent: FakeTabGroup, public file: string | null = null) {}

  setPinned(pinned: boolean) {
    this.pinned = pinned;
  }

  async openFile(file: { path: string }) {
    this.file = file.path;
  }

  detach() {
    this.parent.removeChild(this);
  }
}

class FakeTabGroup {
  public children: FakeLeaf[] = [];

  removeChild(leaf: FakeLeaf) {
    this.children = this.children.filter((child) => child !== leaf);
  }

  insertChild(index: number, leaf: FakeLeaf) {
    this.children.splice(index, 0, leaf);
  }
}

class Device extends AutoPeriodicNotes {
  public registerEvent = jest.fn((ref: EventRef) => {});
  public addSettingTab = jest.fn((tab: PluginSettingTab) => {});
  public register = jest.fn((cleanup: () => unknown) => { cleanups.push(cleanup); });
  public saveData = jest.fn((data: unknown) => Promise.resolve());

  constructor(app: ObsidianApp, manifest: PluginManifest, public savedData: unknown) {
    super(app, manifest);
    this.app = app;
    this.manifest = manifest;
  }

  loadData(): Promise<unknown> {
    return Promise.resolve(JSON.parse(JSON.stringify(this.savedData)));
  }
}

const cleanups: (() => unknown)[] = [];
const manifest: PluginManifest = JSON.parse(readFileSync(__dirname + '/../../manifest.json', 'utf-8'));

interface StartOptions {
  createNotes: boolean;
  at: string;
  tabs?: [string, boolean][];
  data?: unknown;
  localRecord?: unknown;
}

async function startDevice({ createNotes, at, tabs = [], data = syncedSettings(), localRecord }: StartOptions) {
  jest.setSystemTime(new Date(at));
  const group = new FakeTabGroup();
  for (const [file, pinned] of tabs) {
    const leaf = new FakeLeaf(group, file);
    leaf.pinned = pinned;
    group.children.push(leaf);
  }
  const localStorage: Record<string, unknown> = {
    [`${manifest.id}-device`]: localRecord ?? { createNotes, lastExecutionDate: null },
  };
  const app = {
    workspace: {
      onLayoutReady: jest.fn(),
      trigger: jest.fn(),
      on: jest.fn(),
      iterateAllLeaves: (callback: (leaf: FakeLeaf) => void) => group.children.forEach(callback),
      getLeaf: () => {
        const leaf = new FakeLeaf(group);
        group.children.push(leaf);
        return leaf;
      },
    },
    vault: {
      on: (name: string, listener: (file: TAbstractFile) => void) => {
        mockVault.listeners.push(listener);
        return {} as EventRef;
      },
      getAbstractFileByPath: (path: string) => mockVault.get(path),
    },
    loadLocalStorage: (key: string) => localStorage[key] ?? null,
    saveLocalStorage: (key: string, value: unknown) => { localStorage[key] = value; },
  } as unknown as ObsidianApp;

  const device = new Device(app, manifest, data);
  const periodicNotes = (device as any).periodicNotesPlugin;
  periodicNotes.isEnabled = jest.fn().mockReturnValue(true);
  periodicNotes.convertSettings = jest.fn().mockReturnValue({
    daily: { available: true },
    weekly: { available: false },
    monthly: { available: false },
    quarterly: { available: false },
    yearly: { available: false },
  });
  await device.onload();
  device.onLayoutReady();
  await settle();

  return {
    device,
    tabs: () => group.children.map((leaf) => [leaf.file, leaf.pinned]),
  };
}

// Covers the provider's pause after closing tabs
async function settle() {
  await jest.advanceTimersByTimeAsync(1500);
}

async function advanceTo(at: string) {
  await jest.advanceTimersByTimeAsync(new Date(at).getTime() - Date.now());
  await settle();
}

async function sleepAndWakeAt(at: string) {
  jest.setSystemTime(new Date(at));
  document.dispatchEvent(new Event('visibilitychange'));
  await settle();
}

async function arrive(path: string) {
  mockVault.add(path);
  await settle();
}

describe('Tab handling across devices', () => {
  beforeAll(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockVault.paths = new Set([PREVIOUS, TODAY, TOMORROW, INBOX]);
    mockVault.created = [];
    mockVault.listeners = [];
    (DailyNote.prototype.getAllPaths as jest.Mock).mockImplementation(
      () => [...mockVault.paths].filter((path) => path.startsWith('journals/'))
    );
  });

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    jest.useRealTimers();
  });

  const restoredTabs: [string, boolean][] = [[PREVIOUS, true], [TODAY, true], [INBOX, false]];
  const startupState = [[TODAY, true], [INBOX, false]];
  const scheduledState = [[TOMORROW, true], [TODAY, false], [INBOX, false]];
  const lateStartupState = [[TOMORROW, true], [PREVIOUS, false], [TODAY, false], [INBOX, false]];
  const nothing = async () => {};

  // Every trigger must leave a device that does not create notes with the same tabs as the creating device.
  describe.each([
    ['startup before the scheduled time', '2026-10-28T08:00:00', nothing, startupState],
    ['startup after the scheduled time', '2026-10-28T23:00:00', nothing, lateStartupState],
    ['the scheduled time', '2026-10-28T08:00:00', () => advanceTo('2026-10-28T22:30:30'), scheduledState],
    ['wake after the scheduled time', '2026-10-28T08:00:00', () => sleepAndWakeAt('2026-10-28T23:10:00'), scheduledState],
  ])('at %s', (_trigger, startAt, trigger, expected) => {
    it.each([true, false])('handles tabs the same way when createNotes=%s, creating nothing', async (createNotes) => {
      const { tabs } = await startDevice({ createNotes, at: startAt, tabs: restoredTabs });
      await trigger();

      expect(tabs()).toEqual(expected);
      expect(mockVault.created).toEqual([]);
    });
  });

  it('runs the scheduled task once per day on a device that does not create notes', async () => {
    const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00', tabs: [[TODAY, true]] });
    await advanceTo('2026-10-28T22:30:30');
    const leafWithTomorrow = () => tabs().filter(([file]) => file === TOMORROW);
    expect(leafWithTomorrow()).toEqual([[TOMORROW, true]]);

    await sleepAndWakeAt('2026-10-28T23:10:00');
    await jest.runOnlyPendingTimersAsync();

    expect(leafWithTomorrow()).toEqual([[TOMORROW, true]]);
    expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);
  });

  describe('when the note arrives by sync after the trigger ran', () => {
    it('handles the scheduled note as the scheduled time would have', async () => {
      mockVault.paths.delete(TOMORROW);
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00', tabs: restoredTabs });
      await advanceTo('2026-10-28T22:30:30');
      expect(tabs()).toEqual(startupState);

      await arrive(TOMORROW);

      expect(tabs()).toEqual(scheduledState);
      expect(mockVault.created).toEqual([]);
    });

    it("handles today's note as startup would have, closing older daily notes", async () => {
      mockVault.paths.delete(TODAY);
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00', tabs: [[PREVIOUS, true], [INBOX, false]] });
      expect(tabs()).toEqual([[PREVIOUS, true], [INBOX, false]]);

      await arrive(TODAY);

      expect(tabs()).toEqual(startupState);
      expect(mockVault.created).toEqual([]);
    });

    it('ignores files that are not the note the current trigger targets', async () => {
      mockVault.paths.delete(TOMORROW);
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00', tabs: [[TODAY, true], [INBOX, false]] });
      await advanceTo('2026-10-28T22:30:30');
      const before = tabs();

      for (const path of [TODAY, PREVIOUS, day('2026-10-30'), 'Inbox2.md', 'notes/2026-10-29.md']) {
        await arrive(path);
        expect(tabs()).toEqual(before);
      }

      await arrive(TOMORROW);
      expect(tabs()).toEqual(scheduledState);
    });

    it('opens a note the creating device created itself only once', async () => {
      mockVault.paths.delete(TOMORROW);
      const { tabs } = await startDevice({ createNotes: true, at: '2026-10-28T08:00:00', tabs: [[TODAY, true]] });
      await advanceTo('2026-10-28T22:30:30');

      expect(mockVault.created).toEqual([TOMORROW]);
      expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);
    });
  });

  it('never creates notes without the local switch, even if synced data says otherwise', async () => {
    mockVault.paths = new Set([INBOX]);
    const { tabs } = await startDevice({
      createNotes: false,
      at: '2026-10-28T08:00:00',
      tabs: [[INBOX, false]],
      data: { ...syncedSettings(), createNotes: true },
    });
    await advanceTo('2026-10-28T22:30:30');
    await sleepAndWakeAt('2026-10-28T23:10:00');

    expect(mockVault.created).toEqual([]);
    expect(tabs()).toEqual([[INBOX, false]]);

    await arrive(TOMORROW);
    expect(tabs()).toEqual([[TOMORROW, true], [INBOX, false]]);
  });

  describe('synced scheduled time', () => {
    it('uses the synced time over a time left in local storage by 0.6.0', async () => {
      const { tabs } = await startDevice({
        createNotes: false,
        at: '2026-10-28T08:00:00',
        tabs: [[TODAY, true]],
        localRecord: { createNotes: false, scheduledTime: '21:00', lastExecutionDate: null },
      });
      await advanceTo('2026-10-28T21:00:30');
      expect(tabs()).toEqual([[TODAY, true]]);

      await advanceTo('2026-10-28T22:30:30');
      expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);
    });

    it('follows a time changed on another device without restarting', async () => {
      const { device, tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00', tabs: [[TODAY, true]] });
      const onload = jest.spyOn(device, 'onload');
      await advanceTo('2026-10-28T20:00:00');
      const timers = jest.getTimerCount();

      device.savedData = syncedSettings('23:15');
      await device.onExternalSettingsChange();
      expect(jest.getTimerCount()).toBe(timers);

      await advanceTo('2026-10-28T22:30:30');
      expect(tabs()).toEqual([[TODAY, true]]);
      await advanceTo('2026-10-28T23:15:30');
      expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);
      expect(onload).not.toHaveBeenCalled();
    });
  });
});
