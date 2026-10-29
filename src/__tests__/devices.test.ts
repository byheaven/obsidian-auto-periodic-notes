/** @jest-environment ./src/test-environments/time-zone-environment.js */
import { readFileSync } from 'fs';
import { EventRef, PluginManifest, PluginSettingTab, Setting, TAbstractFile } from 'obsidian';
import { DailyNote } from 'obsidian-periodic-notes-provider';
import AutoPeriodicNotes from '../';
import { DEFAULT_SETTINGS } from '../settings';
import AutoPeriodicNotesSettingsTab from '../settings/tab';
import type { ObsidianApp } from '../types';

declare const setTimeZone: (zone: string) => void;

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
// Like the real library, notes are found by the start of their day in local time, wherever they are filed.
jest.mock('obsidian-daily-notes-interface', () => {
  const moment = jest.requireActual('moment');
  const dayKey = (date: moment.Moment) => date.clone().startOf('day').format();
  return {
    DEFAULT_DAILY_NOTE_FORMAT: 'YYYY-MM-DD',
    getDailyNoteSettings: () => ({ folder: 'journals', format: 'YYYY-MM-DD', template: '' }),
    getAllDailyNotes: () => ({}),
    getDailyNote: (date: moment.Moment) => {
      const path = [...mockVault.paths].find((candidate) => {
        const match = candidate.match(/^journals\/(?:.*\/)?(\d{4}-\d{2}-\d{2})\.md$/);
        return match && dayKey(moment(match[1], 'YYYY-MM-DD', true)) === dayKey(date);
      });
      return path ? { path } : null;
    },
    createDailyNote: async (date: moment.Moment) => mockVault.create(`journals/${date.format('YYYY-MM-DD')}.md`),
  };
});

const day = (date: string) => `journals/${date}.md`;
const PREVIOUS = day('2026-10-27');
const TODAY = day('2026-10-28');
const TOMORROW = day('2026-10-29');
const INBOX = 'Inbox.md';

// The user's settings; the scheduled time is synced, the creation switch is not.
function syncedSettings(scheduledTime = '22:30'): Record<string, unknown> {
  return {
    ...DEFAULT_SETTINGS,
    daily: {
      ...DEFAULT_SETTINGS.daily,
      enabled: true,
      openAndPin: true,
      openAtFirstPosition: true,
      closeExisting: true,
      scheduledTime,
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

  // Like Obsidian, the leaf shows the file only once loading it has finished
  async openFile(file: { path: string }) {
    await new Promise((resolve) => setTimeout(resolve, 50));
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
    ['startup before the scheduled time', '2026-10-28T08:00:00Z', nothing, startupState],
    ['startup after the scheduled time', '2026-10-28T23:00:00Z', nothing, lateStartupState],
    ['the scheduled time', '2026-10-28T08:00:00Z', () => advanceTo('2026-10-28T22:30:30Z'), scheduledState],
    ['wake after the scheduled time', '2026-10-28T08:00:00Z', () => sleepAndWakeAt('2026-10-28T23:10:00Z'), scheduledState],
  ])('at %s', (_trigger, startAt, trigger, expected) => {
    it.each([true, false])('handles tabs the same way when createNotes=%s, creating nothing', async (createNotes) => {
      const { tabs } = await startDevice({ createNotes, at: startAt, tabs: restoredTabs });
      await trigger();

      expect(tabs()).toEqual(expected);
      expect(mockVault.created).toEqual([]);
    });
  });

  it('runs the scheduled task once per day on a device that does not create notes', async () => {
    const { device, tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00Z', tabs: [[TODAY, true]] });
    await advanceTo('2026-10-28T22:30:30Z');
    expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);

    // The user pins today's note again to finish it tonight
    (device.app.workspace as any).iterateAllLeaves((leaf: FakeLeaf) => leaf.file === TODAY && leaf.setPinned(true));
    await sleepAndWakeAt('2026-10-28T23:10:00Z');
    await jest.runOnlyPendingTimersAsync();

    expect(tabs()).toEqual([[TOMORROW, true], [TODAY, true]]);
  });

  it.each([true, false])('keeps a daily note the user creates and opens by hand in one tab (createNotes=%s)', async (createNotes) => {
    const { device, tabs } = await startDevice({ createNotes, at: '2026-10-28T08:00:00Z', tabs: [[TODAY, true], [INBOX, false]] });
    // The user deletes today's note, which closes its tab
    mockVault.paths.delete(TODAY);
    let activeLeaf: FakeLeaf | undefined;
    (device.app.workspace as any).iterateAllLeaves((leaf: FakeLeaf) => {
      if (leaf.file === TODAY) leaf.detach();
      else activeLeaf = leaf;
    });

    // Periodic Notes recreates today's note, then opens it in the active tab
    mockVault.add(TODAY);
    await Promise.resolve();
    activeLeaf!.openFile({ path: TODAY });
    await settle();
    await settle();

    expect(tabs()).toEqual([[TODAY, true]]);
  });

  it('opens the daily note once when it arrives while a wake run is in progress', async () => {
    mockVault.paths.delete(TODAY);
    const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00Z', tabs: [[PREVIOUS, true], [INBOX, false]] });

    mockVault.add(TODAY);
    await jest.advanceTimersByTimeAsync(300);
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    await settle();

    expect(tabs()).toEqual(startupState);
  });

  describe('when the note arrives by sync after the trigger ran', () => {
    it('handles the scheduled note as the scheduled time would have', async () => {
      mockVault.paths.delete(TOMORROW);
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00Z', tabs: restoredTabs });
      await advanceTo('2026-10-28T22:30:30Z');
      expect(tabs()).toEqual(startupState);

      await arrive(TOMORROW);

      expect(tabs()).toEqual(scheduledState);
      expect(mockVault.created).toEqual([]);
    });

    it("handles today's note as startup would have, closing older daily notes", async () => {
      mockVault.paths.delete(TODAY);
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00Z', tabs: [[PREVIOUS, true], [INBOX, false]] });
      expect(tabs()).toEqual([[PREVIOUS, true], [INBOX, false]]);

      await arrive(TODAY);

      expect(tabs()).toEqual(startupState);
      expect(mockVault.created).toEqual([]);
    });

    it('ignores files that are not the note the current trigger targets', async () => {
      const { device, tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00Z', tabs: [[TODAY, true], [INBOX, false]] });
      // The user reopens yesterday's note; another startup run would close it
      (device.app.workspace as any).getLeaf().openFile({ path: PREVIOUS });
      await settle();
      const before = tabs();
      expect(before).toEqual([[TODAY, true], [INBOX, false], [PREVIOUS, false]]);

      for (const path of [TOMORROW, PREVIOUS, day('2026-10-30'), 'Inbox2.md', 'notes/2026-10-28.md']) {
        await arrive(path);
        expect(tabs()).toEqual(before);
      }

      await arrive(TODAY);
      expect(tabs()).toEqual(startupState);
    });

    it('opens a note the creating device created itself only once', async () => {
      mockVault.paths.delete(TOMORROW);
      const { tabs } = await startDevice({ createNotes: true, at: '2026-10-28T08:00:00Z', tabs: [[TODAY, true]] });
      await advanceTo('2026-10-28T22:30:30Z');

      expect(mockVault.created).toEqual([TOMORROW]);
      expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);
    });
  });

  it('never creates notes without the local switch, even if synced data says otherwise', async () => {
    mockVault.paths = new Set([INBOX]);
    const { tabs } = await startDevice({
      createNotes: false,
      at: '2026-10-28T08:00:00Z',
      tabs: [[INBOX, false]],
      data: { ...syncedSettings(), createNotes: true },
    });
    await advanceTo('2026-10-28T22:30:30Z');
    await sleepAndWakeAt('2026-10-28T23:10:00Z');

    expect(mockVault.created).toEqual([]);
    expect(tabs()).toEqual([[INBOX, false]]);

    await arrive(TOMORROW);
    expect(tabs()).toEqual([[TOMORROW, true], [INBOX, false]]);
  });

  describe('synced scheduled time', () => {
    it('uses the synced time over a time left in local storage by 0.6.0', async () => {
      const { tabs } = await startDevice({
        createNotes: false,
        at: '2026-10-28T08:00:00Z',
        tabs: [[TODAY, true]],
        localRecord: { createNotes: false, scheduledTime: '21:00', lastExecutionDate: null },
      });
      await advanceTo('2026-10-28T21:00:30Z');
      expect(tabs()).toEqual([[TODAY, true]]);

      await advanceTo('2026-10-28T22:30:30Z');
      expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);
    });

    it('follows a time changed on another device without restarting', async () => {
      const { device, tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00Z', tabs: [[TODAY, true]] });
      const onload = jest.spyOn(device, 'onload');
      await advanceTo('2026-10-28T20:00:00Z');
      const timers = jest.getTimerCount();

      device.savedData = syncedSettings('23:15');
      await device.onExternalSettingsChange();
      expect(jest.getTimerCount()).toBe(timers);

      await advanceTo('2026-10-28T22:30:30Z');
      expect(tabs()).toEqual([[TODAY, true]]);
      await advanceTo('2026-10-28T23:15:30Z');
      expect(tabs()).toEqual([[TOMORROW, true], [TODAY, false]]);
      expect(onload).not.toHaveBeenCalled();
    });
  });

  // The scheduled time is a UTC time and days follow UTC, so devices in different time zones pin the same note.
  // With 14:00 UTC (22:00 in Shanghai) that note is always the Shanghai date two hours ahead of the instant.
  describe.each([
    ['Asia/Shanghai', 22],
    ['America/Los_Angeles', 7],
  ])('on a device in %s', (zone, localHourAt14Utc) => {
    const pinnedDailyNotes = (tabs: (string | boolean | null)[][]) => tabs.filter(([, pinned]) => pinned).map(([file]) => file);
    const noRunYet = (createNotes: boolean) => ({ createNotes, lastExecutionDate: '2026-10-01' });
    const elapseTo = (at: string) => jest.advanceTimersByTimeAsync(new Date(at).getTime() - Date.now());

    beforeEach(() => {
      setTimeZone(zone);
      expect(new Date('2026-10-29T14:00:00Z').getHours()).toBe(localHourAt14Utc);
      mockVault.paths = new Set(['26', '27', '28', '29', '30', '31'].map((d) => day(`2026-10-${d}`))
        .concat(['01', '02', '03'].map((d) => day(`2026-11-${d}`))));
    });

    it.each([
      ['2026-10-29T03:00:00Z', '2026-10-29'],
      ['2026-10-29T06:00:00Z', '2026-10-29'],
      ['2026-10-29T07:00:00Z', '2026-10-29'],
      ['2026-10-29T13:59:58Z', '2026-10-29'],
      ['2026-10-29T14:00:00Z', '2026-10-30'],
      ['2026-10-29T15:59:58Z', '2026-10-30'],
      ['2026-10-29T16:00:00Z', '2026-10-30'],
      ['2026-10-29T23:59:58Z', '2026-10-30'],
      ['2026-10-30T00:00:00Z', '2026-10-30'],
      ['2026-10-30T07:00:00Z', '2026-10-30'],
      ['2026-11-01T09:00:00Z', '2026-11-01'],
      ['2026-11-01T14:00:00Z', '2026-11-02'],
      ['2026-11-01T16:00:00Z', '2026-11-02'],
    ])('pins the note of the Shanghai date two hours ahead at startup at %s', async (at, date) => {
      const { tabs } = await startDevice({ createNotes: false, at, data: syncedSettings('14:00'), localRecord: noRunYet(false) });

      expect(pinnedDailyNotes(tabs())).toEqual([day(date)]);
      expect(mockVault.created).toEqual([]);
    });

    it('runs at the same UTC instant every day, across a daylight saving change', async () => {
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-31T13:00:00Z', data: syncedSettings('14:00'), localRecord: noRunYet(false) });
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-31')]);

      await elapseTo('2026-10-31T13:59:59Z');
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-31')]);
      await elapseTo('2026-10-31T14:00:00Z');
      await settle();
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-11-01')]);

      await elapseTo('2026-11-01T13:59:59Z');
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-11-01')]);
      await elapseTo('2026-11-01T14:00:00Z');
      await settle();
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-11-02')]);
    });

    it('names the note it creates by the UTC date', async () => {
      mockVault.paths.delete(day('2026-10-29'));
      mockVault.paths.delete(day('2026-10-30'));
      const { tabs } = await startDevice({
        createNotes: true,
        at: '2026-10-29T15:00:00Z',
        tabs: [[day('2026-10-28'), true]],
        data: syncedSettings('14:00'),
        localRecord: noRunYet(true),
      });

      expect(mockVault.created).toEqual([day('2026-10-30')]);
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-30')]);
    });

    it('runs once per UTC day, not again after local midnight', async () => {
      mockVault.paths.delete(day('2026-10-31'));
      const { device, tabs } = await startDevice({ createNotes: true, at: '2026-10-29T13:00:00Z', data: syncedSettings('14:00'), localRecord: noRunYet(true) });
      await elapseTo('2026-10-29T14:00:00Z');
      await settle();
      (device.app.workspace as any).iterateAllLeaves((leaf: FakeLeaf) => leaf.file === day('2026-10-29') && leaf.setPinned(true));

      await sleepAndWakeAt('2026-10-29T17:00:00Z');
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-30'), day('2026-10-29')]);

      await sleepAndWakeAt('2026-10-30T14:30:00Z');
      expect(mockVault.created).toEqual([day('2026-10-31')]);
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-31')]);
    });

    it('uses UTC days with unpinning at the switch time off', async () => {
      const data = syncedSettings('14:00') as { daily: Record<string, unknown> };
      data.daily = { ...data.daily, unpinOldDailyNotes: false };
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-29T03:00:00Z', tabs: [[day('2026-10-28'), true]], data, localRecord: noRunYet(false) });

      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-29')]);
    });

    it('finds a note filed outside the default path instead of creating another', async () => {
      mockVault.paths.delete(day('2026-10-30'));
      mockVault.paths.add('journals/2026/2026-10-30.md');
      const { tabs } = await startDevice({ createNotes: true, at: '2026-10-29T15:00:00Z', data: syncedSettings('14:00'), localRecord: noRunYet(true) });

      expect(mockVault.created).toEqual([]);
      expect(pinnedDailyNotes(tabs())).toEqual(['journals/2026/2026-10-30.md']);
    });

    it('applies any UTC time, not only the Shanghai evening', async () => {
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-29T17:00:00Z', data: syncedSettings('20:00'), localRecord: noRunYet(false) });
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-29')]);

      await elapseTo('2026-10-29T20:00:00Z');
      await settle();
      expect(pinnedDailyNotes(tabs())).toEqual([day('2026-10-30')]);
    });
  });

  it('keeps the local date when no scheduled time is set', async () => {
    setTimeZone('Asia/Shanghai');
    mockVault.paths = new Set([day('2026-10-29'), day('2026-10-30')]);
    const { tabs } = await startDevice({ createNotes: false, at: '2026-10-29T17:00:00Z', data: syncedSettings('') });

    expect(tabs()).toEqual([[day('2026-10-30'), true]]);
  });

  // The settings tab rendered by a running device, read back through the Setting mock
  describe('settings tab', () => {
    type Rendered = {
      name: string; desc: string; heading: boolean; disabled: boolean;
      descEl: { classes: Set<string> };
      toggles: { value: boolean; changeHandler: (val: boolean) => Promise<void> }[];
      texts: { value: string; changeHandler: (val: string) => Promise<void> }[];
      buttons: { text: string; attributes: Record<string, string>; clickHandler: () => void }[];
    };
    const rendered = () => (Setting as unknown as { rendered: Rendered[] }).rendered;
    const find = (name: string) => rendered().find((setting) => setting.name === name)!;
    const status = () => rendered().find((setting) => setting.name.startsWith('Current daily note'))!;

    function openTab(device: AutoPeriodicNotes) {
      rendered().length = 0;
      const tab = new AutoPeriodicNotesSettingsTab(device.app, device);
      (tab as unknown as { app: unknown }).app = device.app;
      tab.containerEl = { empty: () => { rendered().length = 0; } } as unknown as HTMLElement;
      tab.display();
      return tab;
    }

    async function deviceAt(zone: string, at: string, createNotes: boolean, data = syncedSettings('14:00')) {
      setTimeZone(zone);
      const { device } = await startDevice({ createNotes, at, data, localRecord: { createNotes, lastExecutionDate: '2026-10-01' } });
      return device;
    }

    it('groups the settings by task', async () => {
      const device = await deviceAt('Asia/Shanghai', '2026-10-29T10:00:00Z', true);
      for (const periodicity of ['weekly', 'monthly', 'quarterly', 'yearly'] as const) {
        device.settings[periodicity].available = true;
      }
      (device.app as unknown as { plugins: unknown }).plugins = { plugins: { 'templater-obsidian': {} } };

      openTab(device);

      expect(rendered().map((setting) => (setting.heading ? '# ' : '') + setting.name)).toEqual([
        '# This device', 'Create notes on this device',
        '# Daily switch', 'Current daily note: 2026-10-29', 'Switch time (UTC)', 'Skip weekends',
        '# Tabs', 'Pin the daily note', 'Put it in the first tab', 'Close older daily notes', 'At the switch time, only unpin them',
        '# Create automatically', 'Daily notes', 'Weekly notes', 'Monthly notes', 'Quarterly notes', 'Yearly notes',
        '# Advanced', 'Run Templater in new notes', 'Debug logging',
      ]);
    });

    it.each([
      ['Asia/Shanghai', '22:00'],
      ['America/Los_Angeles', '07:00'],
    ])('shows the current note and the next switch on a device in %s', async (zone, localTime) => {
      const device = await deviceAt(zone, '2026-10-29T10:00:00Z', zone === 'Asia/Shanghai');

      openTab(device);

      expect(status().name).toBe('Current daily note: 2026-10-29');
      expect(status().desc).toBe(`Switches to 2026-10-30 at ${localTime} on this device.`);
      expect(find('Switch time (UTC)').desc).toBe(`${localTime} on this device (${zone}). Every device switches at the same moment.`);
    });

    it('shows the next switch at the local time it will have after a daylight saving change', async () => {
      const device = await deviceAt('America/Los_Angeles', '2026-10-31T15:00:00Z', false);

      openTab(device);

      expect(status().name).toBe('Current daily note: 2026-11-01');
      expect(status().desc).toBe('Switches to 2026-11-02 at 06:00 on this device.');
    });

    it('keeps Monday\'s note over a skipped weekend', async () => {
      const data = syncedSettings('14:00') as { daily: Record<string, unknown> };
      data.daily = { ...data.daily, excludeWeekends: true };
      const device = await deviceAt('Asia/Shanghai', '2026-10-30T15:00:00Z', true, data);

      openTab(device);

      expect(status().name).toBe('Current daily note: 2026-11-02');
      expect(status().desc).toBe('Switches to 2026-11-03 at 22:00 on this device.');
    });

    it('names the switch that leaves Monday\'s note, at its local time after a daylight saving change', async () => {
      const data = syncedSettings('14:00') as { daily: Record<string, unknown> };
      data.daily = { ...data.daily, excludeWeekends: true };
      const device = await deviceAt('America/Los_Angeles', '2026-10-30T15:00:00Z', false, data);

      openTab(device);

      expect(status().name).toBe('Current daily note: 2026-11-02');
      expect(status().desc).toBe('Switches to 2026-11-03 at 06:00 on this device.');
    });

    it('still tells devices on 0.6.x whether the switch is on', async () => {
      const device = await deviceAt('Asia/Shanghai', '2026-10-29T10:00:00Z', true);
      openTab(device);
      const saved = () => (device.saveData as jest.Mock).mock.calls.at(-1)[0];

      await find('Switch time (UTC)').texts[0].changeHandler('');
      expect(saved().daily).toMatchObject({ scheduledTime: '', enableAdvancedScheduling: false });

      await find('Switch time (UTC)').texts[0].changeHandler('14:00');
      expect(saved().daily).toMatchObject({ scheduledTime: '14:00', enableAdvancedScheduling: true });
    });

    it('follows this device\'s date without a switch time', async () => {
      const device = await deviceAt('America/Los_Angeles', '2026-10-29T02:00:00Z', false, syncedSettings(''));

      openTab(device);

      expect(status().name).toBe('Current daily note: 2026-10-28');
      expect(status().desc).toBe('No switch time set.');
      expect(find('At the switch time, only unpin them').disabled).toBe(true);
    });

    it('keeps the saved switch time while the field holds an invalid time', async () => {
      const device = await deviceAt('Asia/Shanghai', '2026-10-29T15:00:00Z', true);
      openTab(device);

      await find('Switch time (UTC)').texts[0].changeHandler('25:00');

      expect(find('Switch time (UTC)').desc).toBe('Use 24-hour time, for example 14:00.');
      expect(find('Switch time (UTC)').descEl.classes.has('mod-warning')).toBe(true);
      expect(device.settings.daily.scheduledTime).toBe('14:00');
      expect(device.saveData).not.toHaveBeenCalled();
      expect(status().name).toBe('Current daily note: 2026-10-30');
      expect(find('At the switch time, only unpin them').disabled).toBe(false);
    });

    it('turns the switch off when the time is cleared and back on when it is set', async () => {
      const device = await deviceAt('Asia/Shanghai', '2026-10-29T10:00:00Z', true);
      openTab(device);
      const switchTime = find('Switch time (UTC)');

      await switchTime.texts[0].changeHandler('');
      expect(device.settings.daily.scheduledTime).toBe('');
      expect(status().desc).toBe('No switch time set.');
      expect(find('At the switch time, only unpin them').disabled).toBe(true);
      expect(device.settings.daily.unpinOldDailyNotes).toBe(true);

      await switchTime.texts[0].changeHandler(' 15:30 ');
      expect(device.settings.daily.scheduledTime).toBe('15:30');
      expect(switchTime.desc).toBe('23:30 on this device (Asia/Shanghai). Every device switches at the same moment.');
      expect(find('At the switch time, only unpin them').disabled).toBe(false);
    });

    it('disables the first-tab option while the daily note is not pinned', async () => {
      const device = await deviceAt('Asia/Shanghai', '2026-10-29T10:00:00Z', true);
      openTab(device);

      await find('Pin the daily note').toggles[0].changeHandler(false);

      expect(device.settings.daily.openAndPin).toBe(false);
      expect(find('Put it in the first tab').disabled).toBe(true);
      expect(device.settings.daily.openAtFirstPosition).toBe(true);
    });

    it('reveals a note type\'s own options, each saving one setting', async () => {
      const device = await deviceAt('Asia/Shanghai', '2026-10-29T10:00:00Z', true);
      device.settings.weekly.available = true;
      device.settings.monthly.available = true;
      openTab(device);
      expect(find('Weekly notes').buttons[0].attributes['aria-expanded']).toBe('false');

      find('Weekly notes').buttons[0].clickHandler();

      const names = rendered().map((setting) => setting.name);
      const weekly = names.indexOf('Weekly notes');
      expect(names.slice(weekly, weekly + 4)).toEqual(['Weekly notes', 'Pin the weekly note', 'Close older weekly notes', 'Monthly notes']);
      expect(find('Weekly notes').buttons[0].text).toBe('Hide options');
      expect(find('Weekly notes').buttons[0].attributes['aria-expanded']).toBe('true');

      const before = JSON.parse(JSON.stringify(device.settings));
      await find('Pin the weekly note').toggles[0].changeHandler(true);
      expect(device.settings).toEqual({ ...before, weekly: { ...before.weekly, openAndPin: true } });
    });
  });

  describe('older notes and waking', () => {
    it('closes older daily notes at the switch when only-unpin is off', async () => {
      const data = syncedSettings() as { daily: Record<string, unknown> };
      data.daily = { ...data.daily, unpinOldDailyNotes: false };

      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T23:00:00Z', tabs: [[TODAY, true], [INBOX, false]], data });

      expect(tabs()).toEqual([[TOMORROW, true], [INBOX, false]]);
    });

    it('closes older daily notes at startup when the daily note is not pinned', async () => {
      const data = syncedSettings('') as { daily: Record<string, unknown> };
      data.daily = { ...data.daily, openAndPin: false, unpinOldDailyNotes: false };
      (DailyNote.prototype.isPresent as jest.Mock).mockReturnValueOnce(true);
      (DailyNote.prototype.getCurrent as jest.Mock).mockReturnValueOnce({ path: TODAY });

      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-28T08:00:00Z', tabs: [[PREVIOUS, true], [INBOX, false]], data });

      expect(tabs()).toEqual([[INBOX, false]]);
    });

    it('leaves notes opened by hand alone on a wake the same day without a switch time', async () => {
      setTimeZone('Asia/Shanghai');
      const { device, tabs } = await startDevice({ createNotes: false, at: '2026-10-29T10:00:00Z', data: syncedSettings('') });
      (device.app.workspace as any).getLeaf().openFile({ path: PREVIOUS });
      await settle();

      await sleepAndWakeAt('2026-10-29T11:00:00Z');

      expect(tabs()).toEqual([[TOMORROW, true], [PREVIOUS, false]]);
    });

    it('moves to the new local day on wake without a switch time', async () => {
      setTimeZone('Asia/Shanghai');
      mockVault.paths.add(day('2026-10-30'));
      const { tabs } = await startDevice({ createNotes: false, at: '2026-10-29T10:00:00Z', data: syncedSettings('') });
      expect(tabs()).toEqual([[TOMORROW, true]]);

      await sleepAndWakeAt('2026-10-29T17:00:00Z');

      expect(tabs()).toEqual([[day('2026-10-30'), true]]);
    });
  });
});
