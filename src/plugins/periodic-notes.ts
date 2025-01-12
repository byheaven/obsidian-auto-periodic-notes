import type { Plugin } from 'obsidian';
import type { ISettings } from '../settings';
import type { ObsidianAppWithPlugins } from '../types';

export const PLUGIN_NAME: string = 'periodic-notes';
export const PERIODIC_NOTES_EVENT_SETTING_UPDATED: string = 'periodic-notes:settings-updated';

export interface IPeriodicNotesPeriodicitySettings {
  enabled: boolean;
}

export interface IPeriodicNotesSettings {
  daily: IPeriodicNotesPeriodicitySettings;
  weekly: IPeriodicNotesPeriodicitySettings;
  monthly: IPeriodicNotesPeriodicitySettings;
  quarterly: IPeriodicNotesPeriodicitySettings;
  yearly: IPeriodicNotesPeriodicitySettings;
}

export interface IPeriodicNotesPlugin extends Plugin {
  settings: IPeriodicNotesSettings;
}

export class PeriodicNotesPluginAdapter {
  private app: ObsidianAppWithPlugins;

  constructor(app: ObsidianAppWithPlugins) {
    this.app = app;
  }

  isEnabled(): boolean {
    return this.app.plugins.enabledPlugins.has(PLUGIN_NAME);
  }

  private getPlugin(): IPeriodicNotesPlugin {
    return this.app.plugins.getPlugin(PLUGIN_NAME) as IPeriodicNotesPlugin;
  }

  getSettings(): IPeriodicNotesSettings {
    return this.getPlugin().settings || ({} as IPeriodicNotesSettings);
  }

  convertSettings(settings: ISettings, periodicNotesSettings: IPeriodicNotesSettings) {
    settings.daily.available = periodicNotesSettings.daily.enabled;
    settings.weekly.available = periodicNotesSettings.weekly.enabled;
    settings.monthly.available = periodicNotesSettings.monthly.enabled;
    settings.quarterly.available = periodicNotesSettings.quarterly.enabled;
    settings.yearly.available = periodicNotesSettings.yearly.enabled;
  
    return settings;
  }
}
