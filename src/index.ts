import { Notice, Plugin, type PluginManifest, Workspace, WorkspaceLeaf } from 'obsidian';
import { ObsidianAppWithPlugins, PERIODIC_NOTES_EVENT_SETTING_UPDATED, PeriodicNotesPluginAdapter } from 'obsidian-periodic-notes-provider';
import { around } from 'monkey-around';
import * as os from 'os';
import { SETTINGS_UPDATED } from './events';
import debug, { setDebugEnabled } from './log';
import NotesProvider from './notes/provider';
import { applyDefaultSettings, type ISettings } from './settings';
import AutoPeriodicNotesSettingsTab from './settings/tab';
import type { ObsidianApp, ObsidianWorkspace } from './types';

export default class AutoPeriodicNotes extends Plugin {
  public settings: ISettings;
  private periodicNotesPlugin: PeriodicNotesPluginAdapter;
  private notes: NotesProvider;
  private monkeyPatchCleanup?: () => void;
  private isDailyNoteCreation: boolean = false;
  private scheduledTimeouts: Record<string, number | null> = {
    mainDailyCheck: null,
    customScheduledTime: null
  };

  constructor(app: ObsidianApp, manifest: PluginManifest) {
    super(app, manifest);

    this.settings = {} as ISettings;
    this.periodicNotesPlugin = new PeriodicNotesPluginAdapter(app as ObsidianAppWithPlugins);
    this.notes = new NotesProvider(app.workspace, app, this);
  }

  async onload(): Promise<void> {
    this.updateSettings = this.updateSettings.bind(this);

    await this.loadSettings();

    // Set up monkey patch for workspace.getLeaf to control daily note positioning
    this.setupWorkspacePatches();

    this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
  }

  onLayoutReady(): void {
    if (!this.periodicNotesPlugin.isEnabled()) {
      new Notice(
        'The Periodic Notes plugin must be installed and available for Auto Periodic Notes to work.',
        10000
      );
      return;
    }

    // Watch for Periodic Notes settings changes
    const workspace: ObsidianWorkspace = this.app.workspace;
    this.registerEvent(workspace.on(PERIODIC_NOTES_EVENT_SETTING_UPDATED, this.syncPeriodicNotesSettings.bind(this)));
    this.syncPeriodicNotesSettings();

    // Add the settings tab
    this.addSettingTab(new AutoPeriodicNotesSettingsTab(this.app, this));

    // Perform an immediate check with startup context, then schedule BOTH daily checks
    this.notes.checkAndCreateNotes(this.settings, { scheduleName: 'startup' });
    this.scheduleAllDailyChecks();
    this.register(this.clearAllScheduledTimeouts.bind(this));
  }

  async loadSettings(): Promise<void> {
    this.settings = applyDefaultSettings(await this.loadData());
    setDebugEnabled(this.settings.debug);
    debug('Loaded settings: ' + JSON.stringify(this.settings));
  }

  async updateSettings(settings: ISettings): Promise<void> {
    // Check if advanced scheduling toggle changed (device-specific time changes are handled by setDeviceScheduledTime)
    const advancedSchedulingChanged =
      this.settings.daily.enableAdvancedScheduling !== settings.daily.enableAdvancedScheduling;

    this.settings = settings;
    setDebugEnabled(this.settings.debug);
    await this.saveData(this.settings);
    this.onSettingsUpdate();

    // Reschedule if advanced scheduling was toggled
    if (advancedSchedulingChanged) {
      debug('Advanced scheduling setting changed, rescheduling custom time...');
      this.scheduleCustomScheduledTime();
    }

    debug('Saved settings: ' + JSON.stringify(this.settings));
  }

  private syncPeriodicNotesSettings(): void {
    debug('Received new settings from Periodic Notes plugin');
    const pluginSettings = this.periodicNotesPlugin.convertSettings();
    this.settings.daily.available = pluginSettings.daily.available;
    this.settings.weekly.available = pluginSettings.weekly.available;
    this.settings.monthly.available = pluginSettings.monthly.available;
    this.settings.quarterly.available = pluginSettings.quarterly.available;
    this.settings.yearly.available = pluginSettings.yearly.available;
    this.updateSettings(this.settings);
  }

  private onSettingsUpdate(): void {
    this.app.workspace.trigger(SETTINGS_UPDATED);
  }

  private setupWorkspacePatches(): void {
    // Capture plugin instance in closure for use in patch
    const plugin = this;

    // Use monkey-around to properly cooperate with other plugins (e.g., open-tab-settings)
    this.monkeyPatchCleanup = around(Workspace.prototype, {
      getLeaf: (oldMethod) => {
        return function (this: Workspace, newLeaf?: any) {
          // If this is for creating a daily note and first position is enabled
          if (plugin.isDailyNoteCreation && plugin.settings.daily.openAtFirstPosition) {
            debug('Intercepted getLeaf call for daily note - creating at first position');
            return plugin.createLeafAtFirstPosition();
          }

          // Otherwise use original method (let open-tab-settings or others handle it)
          return oldMethod.call(this, newLeaf);
        };
      }
    });

    // Register cleanup
    this.register(() => {
      if (this.monkeyPatchCleanup) {
        this.monkeyPatchCleanup();
        debug('Cleaned up monkey patch');
      }
    });
  }

  private createLeafAtFirstPosition(): WorkspaceLeaf {
    const activeLeaf = this.app.workspace.getMostRecentLeaf();
    if (!activeLeaf) {
      // Temporarily disable daily note creation flag to avoid recursion
      const wasDailyNoteCreation = this.isDailyNoteCreation;
      this.isDailyNoteCreation = false;
      const leaf = this.app.workspace.getLeaf('tab');
      this.isDailyNoteCreation = wasDailyNoteCreation;
      return leaf;
    }

    const activeTabGroup = activeLeaf.parent;

    // Check if first position has an empty leaf we can reuse
    const children = (activeTabGroup as any).children;
    if (children && children.length > 0) {
      const firstLeaf = children[0];
      // Use a basic empty check since we can't easily access notes.isEmptyLeaf here
      const viewType = firstLeaf.view.getViewType();
      if (["empty", "home-tab-view"].includes(viewType)) {
        debug('Reusing empty leaf at first position');
        return firstLeaf;
      }
    }

    // Create new leaf at first position
    try {
      const newLeaf = new (WorkspaceLeaf as any)(this.app);
      (activeTabGroup as any).insertChild(0, newLeaf);
      debug('Created new leaf at first position via monkey patch');
      return newLeaf;
    } catch (error) {
      debug('Failed to create leaf at first position, using fallback: ' + error);
      // Temporarily disable daily note creation flag to avoid recursion
      const wasDailyNoteCreation = this.isDailyNoteCreation;
      this.isDailyNoteCreation = false;
      const leaf = this.app.workspace.getLeaf('tab');
      this.isDailyNoteCreation = wasDailyNoteCreation;
      return leaf;
    }
  }

  // Public method for NotesProvider to signal daily note creation
  public setDailyNoteCreation(isCreating: boolean): void {
    this.isDailyNoteCreation = isCreating;
  }

  // Get unique device identifier based on hostname
  public getDeviceId(): string {
    return os.hostname();
  }

  // Get device-specific scheduled time, falling back to global setting
  public getDeviceScheduledTime(): string {
    const deviceId = this.getDeviceId();
    return this.settings.deviceSettings?.[deviceId]?.scheduledTime
      ?? this.settings.daily.scheduledTime
      ?? '';
  }

  // Set device-specific scheduled time
  public async setDeviceScheduledTime(time: string): Promise<void> {
    const deviceId = this.getDeviceId();
    if (!this.settings.deviceSettings) {
      this.settings.deviceSettings = {};
    }
    if (!this.settings.deviceSettings[deviceId]) {
      this.settings.deviceSettings[deviceId] = { scheduledTime: '' };
    }
    this.settings.deviceSettings[deviceId].scheduledTime = time;
    await this.saveData(this.settings);

    // Reschedule custom time with new device-specific time
    debug(`Device ${deviceId} scheduled time changed to ${time}, rescheduling...`);
    this.scheduleCustomScheduledTime();
  }

  private scheduleMainDailyCheck(): void {
    this.clearScheduledTimeout('mainDailyCheck');

    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(0, 2, 0, 0); // Always 00:02

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();
    debug(`[mainDailyCheck] Scheduled for ${nextRun.toISOString()} (in ${delay}ms)`);

    this.scheduledTimeouts.mainDailyCheck = window.setTimeout(async () => {
      await this.notes.checkAndCreateNotes(this.settings, { scheduleName: 'mainDailyCheck' });
      this.scheduleMainDailyCheck(); // Reschedule itself
    }, delay);
  }

  private scheduleCustomScheduledTime(): void {
    const dailySettings = this.settings.daily;
    // Use device-specific scheduled time
    const scheduledTime = this.getDeviceScheduledTime();
    const deviceId = this.getDeviceId();

    debug(`[customScheduledTime] Checking settings for device ${deviceId}: enableAdvancedScheduling=${dailySettings.enableAdvancedScheduling}, scheduledTime=${scheduledTime}`);

    // Only schedule if enabled AND has valid time
    if (!dailySettings.enableAdvancedScheduling || !scheduledTime) {
      debug(`[customScheduledTime] Not scheduling - conditions not met`);
      this.clearScheduledTimeout('customScheduledTime');
      return;
    }

    this.clearScheduledTimeout('customScheduledTime');

    const now = new Date();
    const nextRun = new Date(now);
    const [hours, minutes] = this.parseScheduledTime(scheduledTime);
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();
    const targetTime = nextRun.getTime();
    debug(`[customScheduledTime] Scheduled for ${nextRun.toISOString()} (in ${delay}ms)`);

    this.scheduledTimeouts.customScheduledTime = window.setTimeout(async () => {
      // Validate that we're within a reasonable window of the target time
      // This prevents false triggers after system sleep/wake cycles
      const currentTime = Date.now();
      const timeDiff = Math.abs(currentTime - targetTime);
      const TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance

      if (timeDiff > TOLERANCE_MS) {
        debug(`[customScheduledTime] Skipped - triggered ${Math.round(timeDiff / 1000 / 60)}min away from target (likely sleep recovery)`);
        this.scheduleCustomScheduledTime(); // Reschedule to the correct next time
        return;
      }

      await this.notes.checkAndCreateNotes(this.settings, { scheduleName: 'customScheduledTime' });
      this.scheduleCustomScheduledTime(); // Reschedule itself
    }, delay);
  }

  private scheduleAllDailyChecks(): void {
    this.scheduleMainDailyCheck();
    this.scheduleCustomScheduledTime();
  }

  private parseScheduledTime(timeString: string): [number, number] {
    const match = timeString.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      debug(`Invalid scheduled time: ${timeString}, using 00:02`);
      return [0, 2];
    }
    return [parseInt(match[1], 10), parseInt(match[2], 10)];
  }

  private clearScheduledTimeout(name: string): void {
    if (this.scheduledTimeouts[name] !== null) {
      window.clearTimeout(this.scheduledTimeouts[name]!);
      this.scheduledTimeouts[name] = null;
      debug(`Cleared timeout: ${name}`);
    }
  }

  private clearAllScheduledTimeouts(): void {
    Object.keys(this.scheduledTimeouts).forEach(name => {
      this.clearScheduledTimeout(name);
    });
  }
}
