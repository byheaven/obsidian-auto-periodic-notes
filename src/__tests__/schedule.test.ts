import { readFileSync } from 'fs';
import { EventRef, PluginManifest, PluginSettingTab } from 'obsidian';
import AutoPeriodicNotes from '../';
import { DEFAULT_SETTINGS } from '../settings';
import { ObsidianApp, ObsidianWorkspace } from '../types';

describe('Daily Note Scheduling', () => {
  let app: ObsidianApp;
  let workspace: ObsidianWorkspace;
  let manifest: PluginManifest;
  let plugin: AutoPeriodicNotesTestable;
  let checkAndCreateNotesSpy: jest.SpyInstance;
  let localStorage: Record<string, unknown>;

  beforeEach(async () => {
    // Reset timers before each test
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-11-29T12:00:00'));

    app = jest.fn() as unknown as ObsidianApp;
    workspace = jest.fn() as unknown as ObsidianWorkspace;
    workspace.onLayoutReady = jest.fn();
    workspace.trigger = jest.fn();
    workspace.on = jest.fn();
    app.workspace = workspace;
    localStorage = {};
    app.loadLocalStorage = jest.fn((key: string) => localStorage[key] ?? null);
    app.saveLocalStorage = jest.fn((key: string, value: unknown) => { localStorage[key] = value; });

    manifest = JSON.parse(readFileSync(__dirname + '/../../manifest.json', 'utf-8'));
    plugin = new AutoPeriodicNotesTestable(app, manifest);

    // Load settings to ensure proper initialization
    await plugin.loadSettings();

    // Spy on checkAndCreateNotes method via testable class and mock implementation
    checkAndCreateNotesSpy = jest.spyOn(plugin.getNotesProvider(), 'checkAndCreateNotes').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // TODO: The following tests need to be rewritten for the new scheduleDailyCheck functionality
  // which uses user-configurable scheduled time instead of fixed 00:02 mainDailyCheck
  it.skip('schedules next daily check for 00:02 the next day', () => {
    // Current time is 2025-11-29 12:00:00
    // Next run should be at 2025-11-30 00:02:00
    const expectedNextRun = new Date('2025-11-30T00:02:00');
    const now = new Date();
    const expectedDelay = expectedNextRun.getTime() - now.getTime();

    plugin.scheduleDailyCheckPublic();

    // Verify that the timeout is scheduled for the correct time
    // Jest fake timers tracks pending timers
    const timers = jest.getTimerCount();
    expect(timers).toBeGreaterThan(0);

    // Fast-forward to just before the scheduled time
    jest.advanceTimersByTime(expectedDelay - 1000);
    expect(checkAndCreateNotesSpy).not.toHaveBeenCalled();

    // Fast-forward past the scheduled time
    jest.advanceTimersByTime(1000);
    expect(checkAndCreateNotesSpy).toHaveBeenCalled();
  });

  it.skip('schedules next daily check for 00:02 today if current time is before 00:02', async () => {
    // Set time to 00:01:00 (before 00:02)
    jest.setSystemTime(new Date('2025-11-29T00:01:00'));

    const expectedNextRun = new Date('2025-11-29T00:02:00');
    const now = new Date();
    const expectedDelay = expectedNextRun.getTime() - now.getTime();

    // Create new plugin instance with updated time
    const newPlugin = new AutoPeriodicNotesTestable(app, manifest);
    await newPlugin.loadSettings();

    newPlugin.scheduleDailyCheckPublic();

    // Verify timer was scheduled
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    // Should be a short delay (1 minute)
    expect(expectedDelay).toBe(60000); // 1 minute in milliseconds
  });

  it.skip('triggers checkAndCreateNotes when scheduled time arrives', async () => {
    plugin.scheduleDailyCheckPublic();

    // Fast-forward time to next 00:02
    jest.runOnlyPendingTimers();

    expect(checkAndCreateNotesSpy).toHaveBeenCalledWith(plugin.settings, { scheduleName: 'mainDailyCheck' });
  });

  it.skip('reschedules next check after running', async () => {
    plugin.scheduleDailyCheckPublic();

    // Fast-forward to trigger the scheduled check
    jest.runOnlyPendingTimers();

    // Wait for async callback to complete - flush microtask queue multiple times
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Should have been called once
    expect(checkAndCreateNotesSpy).toHaveBeenCalledTimes(1);

    // Should have scheduled another check (timer count > 0)
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    // Trigger the rescheduled check
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(checkAndCreateNotesSpy).toHaveBeenCalledTimes(2);
  });

  it.skip('clears timeout on plugin unload', () => {
    plugin.scheduleDailyCheckPublic();

    // Should have a pending timer
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    plugin.clearAllScheduledTimeoutsPublic();

    // Timer should be cleared
    // Note: The timer count may still show 1 because Jest tracks all timers,
    // but running timers should not trigger checkAndCreateNotes
    const beforeCount = checkAndCreateNotesSpy.mock.calls.length;
    jest.runAllTimers();
    const afterCount = checkAndCreateNotesSpy.mock.calls.length;

    // No new calls should have been made
    expect(afterCount).toBe(beforeCount);
  });

  it.skip('handles multiple scheduleNextDailyCheck calls without creating duplicate timeouts', () => {
    // Schedule first check
    plugin.scheduleDailyCheckPublic();
    const firstTimerCount = jest.getTimerCount();

    // Schedule second check (should clear first one)
    plugin.scheduleDailyCheckPublic();

    // Should still have timers scheduled
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    // Run all timers - should only trigger checkAndCreateNotes once per cycle
    jest.runOnlyPendingTimers();

    // Should have been called exactly once (not twice)
    expect(checkAndCreateNotesSpy).toHaveBeenCalledTimes(1);
  });

  it('performs immediate check on layout ready', async () => {
    // Create a fresh plugin instance for this test
    const freshPlugin = new AutoPeriodicNotesTestable(app, manifest);
    await freshPlugin.loadSettings();

    // Enable advanced scheduling for timer test
    freshPlugin.settings.daily.enableAdvancedScheduling = true;
    freshPlugin.settings.daily.available = true;

    freshPlugin.updateDeviceSettings({ createNotes: true, scheduledTime: '22:30' });
    prepareLayoutReady(freshPlugin);

    // Spy on checkAndCreateNotes for fresh plugin
    const freshCheckSpy = jest.spyOn(freshPlugin.getNotesProvider(), 'checkAndCreateNotes');

    freshPlugin.onLayoutReady();

    // Should perform immediate check
    expect(freshCheckSpy).toHaveBeenCalledTimes(1);

    // Should have scheduled next check (now that advanced scheduling is enabled)
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });

  describe('device-local note creation', () => {
    const deviceKey = () => `${manifest.id}-device`;

    async function startPlugin(storedDeviceSettings: unknown, savedData: unknown = DEFAULT_SETTINGS) {
      if (storedDeviceSettings !== undefined) {
        localStorage[deviceKey()] = storedDeviceSettings;
      }
      const sut = new AutoPeriodicNotesTestable(app, manifest, savedData);
      await sut.loadSettings();
      prepareLayoutReady(sut);
      const startupSpy = jest.spyOn(sut.getNotesProvider(), 'checkAndCreateNotes').mockResolvedValue(undefined);
      const nextPeriodSpy = jest.spyOn(sut.getNotesProvider(), 'checkAndCreateNextPeriodNotes').mockResolvedValue(undefined);
      sut.onLayoutReady();
      await jest.advanceTimersByTimeAsync(0);
      return { sut, startupSpy, nextPeriodSpy };
    }

    it('is off by default and never schedules creation, even with times left in synced data.json', async () => {
      jest.setSystemTime(new Date('2025-11-29T23:00:00'));
      const legacyData = {
        ...DEFAULT_SETTINGS,
        daily: { ...DEFAULT_SETTINGS.daily, enableAdvancedScheduling: true, scheduledTime: '22:30' },
        deviceSettings: { 'some-host': { scheduledTime: '22:00', lastExecutionDate: '2025-11-28' } },
      };

      const { sut, startupSpy, nextPeriodSpy } = await startPlugin(undefined, legacyData);

      expect(sut.canCreateNotes()).toBe(false);
      expect(startupSpy).toHaveBeenCalledTimes(1);
      expect(nextPeriodSpy).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
      expect(sut.saveData).not.toHaveBeenCalled();
      expect(app.saveLocalStorage).not.toHaveBeenCalled();
    });

    it('drops legacy device fields from the synced settings', async () => {
      const legacyData = {
        ...DEFAULT_SETTINGS,
        daily: { ...DEFAULT_SETTINGS.daily, scheduledTime: '22:30' },
        deviceSettings: { 'some-host': { scheduledTime: '22:00' } },
      };

      const { sut } = await startPlugin(undefined, legacyData);

      expect(sut.settings).not.toHaveProperty('deviceSettings');
      expect(sut.settings.daily).not.toHaveProperty('scheduledTime');
    });

    it('runs the scheduled task on a creating device and records the run only in local storage', async () => {
      jest.setSystemTime(new Date('2025-11-29T21:59:00'));
      const advancedData = {
        ...DEFAULT_SETTINGS,
        daily: { ...DEFAULT_SETTINGS.daily, enableAdvancedScheduling: true },
      };

      const { sut, nextPeriodSpy } = await startPlugin({ createNotes: true, scheduledTime: '22:00', lastExecutionDate: null }, advancedData);
      await jest.advanceTimersByTimeAsync(60 * 1000);

      expect(nextPeriodSpy).toHaveBeenCalledTimes(1);
      expect(localStorage[deviceKey()]).toEqual({ createNotes: true, scheduledTime: '22:00', lastExecutionDate: '2025-11-29' });
      expect(sut.saveData).not.toHaveBeenCalled();
    });

    it('catches up on startup creation when the switch is turned on', async () => {
      const { sut, startupSpy } = await startPlugin(undefined);
      expect(startupSpy).toHaveBeenCalledTimes(1);

      sut.updateDeviceSettings({ createNotes: true });
      await jest.advanceTimersByTimeAsync(0);
      sut.updateDeviceSettings({ scheduledTime: '22:00' });
      await jest.advanceTimersByTimeAsync(0);

      expect(startupSpy).toHaveBeenCalledTimes(2);
    });

    it('stops scheduling once creation is turned off on the device', async () => {
      const advancedData = {
        ...DEFAULT_SETTINGS,
        daily: { ...DEFAULT_SETTINGS.daily, enableAdvancedScheduling: true },
      };
      const { sut, nextPeriodSpy } = await startPlugin({ createNotes: true, scheduledTime: '22:00', lastExecutionDate: null }, advancedData);
      expect(jest.getTimerCount()).toBe(1);

      sut.updateDeviceSettings({ createNotes: false });
      await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(jest.getTimerCount()).toBe(0);
      expect(nextPeriodSpy).not.toHaveBeenCalled();
      expect(localStorage[deviceKey()]).toEqual({ createNotes: false, scheduledTime: '22:00', lastExecutionDate: null });
      expect(sut.saveData).not.toHaveBeenCalled();
    });
  });
});

function prepareLayoutReady(plugin: AutoPeriodicNotesTestable): void {
  const periodicPlugin = plugin.getPeriodicNotesPlugin();
  periodicPlugin.isEnabled = jest.fn().mockReturnValue(true);
  periodicPlugin.convertSettings = jest.fn().mockReturnValue({
    daily: { available: true },
    weekly: { available: false },
    monthly: { available: false },
    quarterly: { available: false },
    yearly: { available: false },
  });
  plugin.registerEvent = jest.fn();
  plugin.addSettingTab = jest.fn();
  plugin.register = jest.fn();
}

class AutoPeriodicNotesTestable extends AutoPeriodicNotes {
  public registerEvent!: (eventRef: EventRef) => void;
  public addSettingTab!: (settingTab: PluginSettingTab) => void;
  public register!: (cb: () => unknown) => void;

  public saveData = jest.fn((data: unknown): Promise<void> => Promise.resolve());

  constructor(app: ObsidianApp, manifest: PluginManifest, private savedData: unknown = DEFAULT_SETTINGS) {
    super(app, manifest);
    this.app = app;
    this.manifest = manifest;
  }

  loadData(): Promise<unknown> {
    return Promise.resolve(JSON.parse(JSON.stringify(this.savedData)));
  }

  // Expose private properties for testing
  public getNotesProvider() {
    return (this as any).notes;
  }

  public getPeriodicNotesPlugin() {
    return (this as any).periodicNotesPlugin;
  }

  // Expose private methods for testing
  public scheduleDailyCheckPublic(): void {
    (this as any).scheduleDailyCheck();
  }

  public scheduleAllDailyChecksPublic(): void {
    (this as any).scheduleAllDailyChecks();
  }

  public clearAllScheduledTimeoutsPublic(): void {
    (this as any).clearAllScheduledTimeouts();
  }

  public getActiveTimeout(name: string): number | null {
    return (this as any).scheduledTimeouts[name];
  }
}
