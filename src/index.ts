import { Notice, Plugin, type PluginManifest } from 'obsidian';
import { SETTINGS_UPDATED } from './events';
import NotesProvider from './notes/provider';
import { PERIODIC_NOTES_EVENT_SETTING_UPDATED, PeriodicNotesPluginAdapter } from './plugins/periodic-notes';
import { applyDefaultSettings, type ISettings } from './settings';
import AutoPeriodicNotesSettingsTab from './settings/tab';
import type { ObsidianApp, ObsidianWorkspace } from './types';
import debug from './log';

export default class AutoPeriodicNotes extends Plugin {
  public settings: ISettings;
  private periodicNotesPlugin: PeriodicNotesPluginAdapter;
  private notes: NotesProvider;

  constructor(app: ObsidianApp, manifest: PluginManifest) {
    super(app, manifest);

    this.settings = {} as ISettings;
    this.periodicNotesPlugin = new PeriodicNotesPluginAdapter(app);
    this.notes = new NotesProvider(app.workspace);
  }

  async onload(): Promise<void> {
    this.updateSettings = this.updateSettings.bind(this);

    await this.loadSettings();

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

    // Register the standard check for new notes and run immediately
    this.registerInterval(
      window.setInterval(() => {
        this.notes.checkAndCreateNotes(this.settings);
      }, 300000)
    );
    this.notes.checkAndCreateNotes(this.settings);
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
    this.updateSettings(this.periodicNotesPlugin.convertSettings(
      this.settings, this.periodicNotesPlugin.getSettings()
    ));
  }

  private onSettingsUpdate(): void {
    this.app.workspace.trigger(SETTINGS_UPDATED);
  }
}
