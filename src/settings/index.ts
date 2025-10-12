export type IPeriodicity =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

export interface IPeriodicitySettings {
  available: boolean;
  enabled: boolean;
  closeExisting: boolean,
  openAndPin: boolean;
}

export interface IDailySettings extends IPeriodicitySettings {
  excludeWeekends: boolean;
  openAtFirstPosition: boolean;
}

export interface ISettings {
  alwaysOpen: boolean;
  processTemplater: boolean;
  debug: boolean;
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
  openAndPin: false,
});

export const DEFAULT_SETTINGS: ISettings = Object.freeze({
  alwaysOpen: false,
  processTemplater: false,
  debug: false,
  daily: { ...DEFAULT_PERIODICITY_SETTINGS, excludeWeekends: false, openAtFirstPosition: false },
  weekly: { ...DEFAULT_PERIODICITY_SETTINGS },
  monthly: { ...DEFAULT_PERIODICITY_SETTINGS },
  quarterly: { ...DEFAULT_PERIODICITY_SETTINGS },
  yearly: { ...DEFAULT_PERIODICITY_SETTINGS },
});

export function applyDefaultSettings(savedSettings: ISettings): ISettings {
  // Perform deep merge to ensure new fields get default values
  const result: ISettings = {
    alwaysOpen: savedSettings?.alwaysOpen ?? DEFAULT_SETTINGS.alwaysOpen,
    processTemplater: savedSettings?.processTemplater ?? DEFAULT_SETTINGS.processTemplater,
    debug: savedSettings?.debug ?? DEFAULT_SETTINGS.debug,
    daily: {
      ...DEFAULT_SETTINGS.daily,
      ...savedSettings?.daily,
    },
    weekly: {
      ...DEFAULT_SETTINGS.weekly,
      ...savedSettings?.weekly,
    },
    monthly: {
      ...DEFAULT_SETTINGS.monthly,
      ...savedSettings?.monthly,
    },
    quarterly: {
      ...DEFAULT_SETTINGS.quarterly,
      ...savedSettings?.quarterly,
    },
    yearly: {
      ...DEFAULT_SETTINGS.yearly,
      ...savedSettings?.yearly,
    },
  };

  return result;
}
