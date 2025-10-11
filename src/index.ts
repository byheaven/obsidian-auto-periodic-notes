import { Notice, Plugin, type PluginManifest, Workspace, WorkspaceLeaf } from 'obsidian';
import { ObsidianAppWithPlugins, PERIODIC_NOTES_EVENT_SETTING_UPDATED, PeriodicNotesPluginAdapter } from 'obsidian-periodic-notes-provider';
import { around } from 'monkey-around';
import { SETTINGS_UPDATED } from './events';
import debug from './log';
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
  private dailyCheckTimeout: number | null = null;

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

    // Perform an immediate check, then schedule the daily run at 00:02
    this.notes.checkAndCreateNotes(this.settings);
    this.scheduleNextDailyCheck();
    this.register(this.clearDailyCheckTimeout.bind(this));
  }

  async loadSettings(): Promise<void> {
    this.settings = applyDefaultSettings(await this.loadData());
    debug('Loaded settings: ' + JSON.stringify(this.settings));
  }

  async updateSettings(settings: ISettings): Promise<void> {
    this.settings = settings;
    await this.saveData(this.settings);
    this.onSettingsUpdate();
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

  private scheduleNextDailyCheck(): void {
    this.clearDailyCheckTimeout();

    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(0, 2, 0, 0);

    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    const delay = nextRun.getTime() - now.getTime();

    this.dailyCheckTimeout = window.setTimeout(async () => {
      this.notes.checkAndCreateNotes(this.settings);
      this.scheduleNextDailyCheck();
    }, delay);
  }

  private clearDailyCheckTimeout(): void {
    if (this.dailyCheckTimeout !== null) {
      window.clearTimeout(this.dailyCheckTimeout);
      this.dailyCheckTimeout = null;
    }
  }
}
