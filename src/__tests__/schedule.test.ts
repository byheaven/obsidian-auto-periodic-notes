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

    // Set device-specific scheduled time
    const deviceId = freshPlugin.getDeviceId();
    if (!freshPlugin.settings.deviceSettings) {
      freshPlugin.settings.deviceSettings = {};
    }
    freshPlugin.settings.deviceSettings[deviceId] = { scheduledTime: '22:30' };

    // Mock periodicNotesPlugin to be enabled
    const periodicPlugin = freshPlugin.getPeriodicNotesPlugin();
    periodicPlugin.isEnabled = jest.fn().mockReturnValue(true);
    periodicPlugin.convertSettings = jest.fn().mockReturnValue({
      daily: { available: true },
      weekly: { available: false },
      monthly: { available: false },
      quarterly: { available: false },
      yearly: { available: false },
    });

    // Mock registerEvent method
    freshPlugin.registerEvent = jest.fn();
    freshPlugin.addSettingTab = jest.fn();
    freshPlugin.register = jest.fn();

    // Spy on checkAndCreateNotes for fresh plugin
    const freshCheckSpy = jest.spyOn(freshPlugin.getNotesProvider(), 'checkAndCreateNotes');

    freshPlugin.onLayoutReady();

    // Should perform immediate check
    expect(freshCheckSpy).toHaveBeenCalledTimes(1);

    // Should have scheduled next check (now that advanced scheduling is enabled)
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });
});

class AutoPeriodicNotesTestable extends AutoPeriodicNotes {
  public registerEvent!: (eventRef: EventRef) => void;
  public addSettingTab!: (settingTab: PluginSettingTab) => void;
  public register!: (cb: () => unknown) => void;

  constructor(app: ObsidianApp, manifest: PluginManifest) {
    super(app, manifest);
    this.app = app;
    this.manifest = manifest;
  }

  loadData(): Promise<unknown> {
    return Promise.resolve(DEFAULT_SETTINGS);
  }

  saveData(data: unknown): Promise<void> {
    return Promise.resolve();
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
