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
    scheduledTime: null
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
    this.notes.checkAndCreateNotes(this.settings, { scheduleName: 'startup' })
      .then(() => this.checkMissedScheduledTaskOnStartup())
      .catch(error => {
        debug(`Error during startup check: ${error.message}`);
        console.error('Auto Periodic Notes: Failed to create notes on startup', error);
        new Notice('Auto Periodic Notes: Failed to create notes on startup. Check console for details.');
      });
    this.scheduleAllDailyChecks();
    this.register(this.clearAllScheduledTimeouts.bind(this));

    // Set up Visibility API listener to detect sleep/wake recovery
    this.setupVisibilityListener();
  }

  async loadSettings(): Promise<void> {
    this.settings = applyDefaultSettings(await this.loadData());
    setDebugEnabled(this.settings.debug);
    debug('Loaded settings: ' + JSON.stringify(this.settings));
  }

  async updateSettings(settings: ISettings): Promise<void> {
    this.settings = settings;
    setDebugEnabled(this.settings.debug);
    await this.saveData(this.settings);
    this.onSettingsUpdate();

    // Always reschedule custom time when settings change
    // scheduleDailyCheck() is idempotent and self-disabling
    this.scheduleDailyCheck();

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
    this.onSettingsUpdate();

    // Reschedule custom time with new device-specific time
    debug(`Device ${deviceId} scheduled time changed to ${time}, rescheduling...`);
    this.scheduleDailyCheck();
  }

  // Get device-specific last execution date
  private getLastExecutionDate(): string | null {
    const deviceId = this.getDeviceId();
    return this.settings.deviceSettings?.[deviceId]?.lastExecutionDate ?? null;
  }

  // Set device-specific last execution date
  private async setLastExecutionDate(date: string): Promise<void> {
    const deviceId = this.getDeviceId();
    if (!this.settings.deviceSettings) {
      this.settings.deviceSettings = {};
    }
    if (!this.settings.deviceSettings[deviceId]) {
      this.settings.deviceSettings[deviceId] = { scheduledTime: '' };
    }
    this.settings.deviceSettings[deviceId].lastExecutionDate = date;
    await this.saveData(this.settings);
  }

  private scheduleDailyCheck(): void {
    const dailySettings = this.settings.daily;
    // Use device-specific scheduled time
    const scheduledTime = this.getDeviceScheduledTime();
    const deviceId = this.getDeviceId();

    debug(`[scheduledTime] Checking settings for device ${deviceId}: enableAdvancedScheduling=${dailySettings.enableAdvancedScheduling}, scheduledTime=${scheduledTime}`);

    // Only schedule if enabled AND has valid time
    if (!dailySettings.enableAdvancedScheduling || !scheduledTime) {
      debug(`[scheduledTime] Not scheduling - conditions not met`);
      this.clearScheduledTimeout('scheduledTime');
      return;
    }



    // Validate time format before parsing
    const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!TIME_REGEX.test(scheduledTime)) {
      debug(`[scheduledTime] Not scheduling - invalid time format: ${scheduledTime}`);
      this.clearScheduledTimeout('scheduledTime');
      return;
    }

    this.clearScheduledTimeout('scheduledTime');

    const now = new Date();
    const nextRun = new Date(now);
    const [hours, minutes] = this.parseScheduledTime(scheduledTime);
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();
    const targetTime = nextRun.getTime();
    debug(`[scheduledTime] Scheduled for ${nextRun.toISOString()} (in ${delay}ms)`);

    this.scheduledTimeouts.scheduledTime = window.setTimeout(async () => {
      try {
        // Validate that we're within a reasonable window of the target time
        // This prevents false triggers after system sleep/wake cycles
        const currentTime = Date.now();
        const timeDiff = Math.abs(currentTime - targetTime);
        const TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance

        if (timeDiff > TOLERANCE_MS) {
          debug(`[scheduledTime] Skipped - triggered ${Math.round(timeDiff / 1000 / 60)}min away from target (likely sleep recovery)`);
          this.scheduleDailyCheck(); // Reschedule to the correct next time
          return;
        }

        // On-time execution: create next period notes
        await this.executeCustomScheduledTask(true);
      } catch (error) {
        debug(`Error in scheduledTime: ${error.message}`);
        console.error('Auto Periodic Notes: Failed during custom scheduled check', error);
        new Notice('Auto Periodic Notes: Failed to create notes at scheduled time. Check console for details.');
      } finally {
        // Always reschedule, even if there was an error
        this.scheduleDailyCheck();
      }
    }, delay);
  }

  private scheduleAllDailyChecks(): void {
    this.scheduleDailyCheck();
  }

  private setupVisibilityListener(): void {
    debug('[Visibility] Setting up visibility change listener');

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Window changed from hidden to visible
        debug('[Visibility] Window became visible, checking for missed schedules');
        console.log('[Auto Periodic Notes] Window became visible, checking scheduled tasks...');

        await this.onWindowBecameVisible();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.register(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      debug('[Visibility] Visibility listener removed');
    });

    debug('[Visibility] Visibility listener registered');
  }

  private async onWindowBecameVisible(): Promise<void> {
    // Only handle cases where advanced scheduling is enabled
    if (!this.settings.daily.enableAdvancedScheduling) {
      debug('[Visibility] Advanced scheduling not enabled, skipping');
      return;
    }

    const scheduledTime = this.getDeviceScheduledTime();
    if (!scheduledTime) {
      debug('[Visibility] No scheduled time configured, skipping');
      return;
    }

    const now = new Date();
    const todayString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const [hours, minutes] = this.parseScheduledTime(scheduledTime);

    // Build today's target time
    const todayTarget = new Date(now);
    todayTarget.setHours(hours, minutes, 0, 0);

    const currentTime = now.getTime();
    const targetTime = todayTarget.getTime();

    debug(`[Visibility] Checking: now=${now.toISOString()}, target=${todayTarget.toISOString()}, lastExecution=${this.getLastExecutionDate()}`);

    if (currentTime < targetTime) {
      // Case 1: Current time is before the scheduled time
      // Ensure timeout is correctly scheduled (reschedule to prevent being interrupted by sleep)
      debug('[Visibility] Before scheduled time, ensuring timeout is set');
      console.log(`[Auto Periodic Notes] Before scheduled time ${scheduledTime}, rescheduling...`);

      this.scheduleDailyCheck();
    } else {
      // Case 2: Current time is after the scheduled time
      // Check if it has already been executed today
      const lastExecution = this.getLastExecutionDate();
      if (lastExecution !== todayString) {
        debug('[Visibility] After scheduled time and not executed today, triggering now');
        console.log(`[Auto Periodic Notes] Missed scheduled time ${scheduledTime}, executing now...`);

        // Late execution: create current period notes
        await this.executeCustomScheduledTask(false);
      } else {
        debug('[Visibility] After scheduled time but already executed today, skipping');
        console.log(`[Auto Periodic Notes] Already executed today at ${scheduledTime}, skipping`);
      }
    }
  }

  private async executeCustomScheduledTask(isOnTime: boolean = true): Promise<void> {
    const now = new Date();
    const todayString = now.toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      console.log(`[Auto Periodic Notes] Executing scheduled task at ${now.toLocaleTimeString()} (${isOnTime ? 'on-time' : 'late'})`);

      // Both on-time and late execution: create next period notes with scheduledTime context
      // This ensures consistent behavior: always create tomorrow's note and unpin old notes
      console.log('[Auto Periodic Notes] Creating next period notes (tomorrow)');
      await this.notes.checkAndCreateNextPeriodNotes(this.settings, { scheduleName: 'scheduledTime' });

      // Mark execution date and persist to settings
      await this.setLastExecutionDate(todayString);
      debug(`[Execution] Marked and persisted execution date: ${todayString}`);

      console.log(`[Auto Periodic Notes] Scheduled task completed successfully`);
    } catch (error) {
      debug(`Error during scheduled task: ${error.message}`);
      console.error('Auto Periodic Notes: Failed to execute scheduled task', error);
      new Notice('Auto Periodic Notes: Failed to create notes. Check console for details.');
    }
  }

  /**
   * Check if scheduled task was missed on startup (e.g., Obsidian restarted after scheduled time).
   * If so, execute the task now.
   */
  private async checkMissedScheduledTaskOnStartup(): Promise<void> {
    if (!this.settings.daily.enableAdvancedScheduling) {
      debug('[Startup Recovery] Advanced scheduling not enabled, skipping');
      return;
    }

    const scheduledTime = this.getDeviceScheduledTime();
    if (!scheduledTime) {
      debug('[Startup Recovery] No scheduled time configured, skipping');
      return;
    }

    const now = new Date();
    const todayString = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const [hours, minutes] = this.parseScheduledTime(scheduledTime);

    // Build today's target time
    const todayTarget = new Date(now);
    todayTarget.setHours(hours, minutes, 0, 0);

    const currentTime = now.getTime();
    const targetTime = todayTarget.getTime();

    debug(`[Startup Recovery] Checking: now=${now.toISOString()}, target=${todayTarget.toISOString()}, lastExecution=${this.getLastExecutionDate()}`);

    // Only recover if current time is after scheduled time AND not executed today
    if (currentTime > targetTime) {
      const lastExecution = this.getLastExecutionDate();
      if (lastExecution !== todayString) {
        debug('[Startup Recovery] Missed scheduled task detected, executing now');
        console.log(`[Auto Periodic Notes] Startup recovery: missed scheduled time ${scheduledTime}, executing now...`);

        await this.executeCustomScheduledTask(false);
      } else {
        debug('[Startup Recovery] Already executed today, skipping');
      }
    } else {
      debug('[Startup Recovery] Before scheduled time, no recovery needed');
    }
  }

  private parseScheduledTime(timeString: string): [number, number] {
    const match = timeString.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      debug(`Invalid scheduled time: ${timeString}, using default 00:00`);
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
