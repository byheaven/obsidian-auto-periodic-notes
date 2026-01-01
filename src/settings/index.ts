import debug from '../log';
import { periodicities } from '../constants';

export type IPeriodicity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface IPeriodicitySettings {
  available: boolean;
  enabled: boolean;
  closeExisting: boolean;
  openAndPin?: boolean; // Deprecated: will be removed in a future breaking release
  open: boolean;
  pin: boolean;
}

export interface IDailySettings extends IPeriodicitySettings {
  excludeWeekends: boolean;
}

export interface ISettings {
  alwaysOpen: boolean;
  gitCommit: boolean;
  gitCommitMessage: string;
  processTemplater: boolean;
  daily: IDailySettings;
  weekly: IPeriodicitySettings;
  monthly: IPeriodicitySettings;
  quarterly: IPeriodicitySettings;
  yearly: IPeriodicitySettings;
}

export const DEFAULT_PERIODICITY_SETTINGS: IPeriodicitySettings = Object.freeze({
  available: false,
  enabled: false,
  closeExisting: false,
  open: false,
  pin: false,
});

export const DEFAULT_SETTINGS: ISettings = Object.freeze({
  alwaysOpen: false,
  gitCommit: false,
  gitCommitMessage: 'chore: latest notes from {DATE}',
  processTemplater: false,
  daily: { ...DEFAULT_PERIODICITY_SETTINGS, excludeWeekends: false },
  weekly: { ...DEFAULT_PERIODICITY_SETTINGS },
  monthly: { ...DEFAULT_PERIODICITY_SETTINGS },
  quarterly: { ...DEFAULT_PERIODICITY_SETTINGS },
  yearly: { ...DEFAULT_PERIODICITY_SETTINGS },
});

export function applyDefaultSettings(savedSettings: ISettings): ISettings {
  // Automatically migrate "openAndPin" setting into new structure
  for (const periodicity of periodicities) {
    if (
      typeof savedSettings[periodicity] !== 'undefined' &&
      typeof savedSettings[periodicity].openAndPin !== 'undefined'
    ) {
      savedSettings[periodicity].open = savedSettings[periodicity].openAndPin;
      savedSettings[periodicity].pin = savedSettings[periodicity].openAndPin;
      savedSettings[periodicity].openAndPin = undefined;
      debug('When loading settings, migrated "openAndPin" settings into new structure');
    }
  }

  return Object.assign({}, DEFAULT_SETTINGS, savedSettings);
}
