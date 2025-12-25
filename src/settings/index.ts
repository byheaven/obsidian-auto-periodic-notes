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
  enableAdvancedScheduling: boolean;
  scheduledTime: string;  // Default/fallback time, device-specific times are in deviceSettings
  createTomorrowsNote: boolean;
  unpinOldDailyNotes: boolean;
}

export interface IDeviceSettings {
  scheduledTime: string;  // Device-specific scheduled time (HH:mm)
  lastExecutionDate?: string;  // Last execution date (YYYY-MM-DD) for this device
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
  deviceSettings: Record<string, IDeviceSettings>;  // Keyed by hostname
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
  daily: {
    ...DEFAULT_PERIODICITY_SETTINGS,
    excludeWeekends: false,
    openAtFirstPosition: false,
    enableAdvancedScheduling: false,
    scheduledTime: "22:00",
    createTomorrowsNote: false,
    unpinOldDailyNotes: false
  },
  weekly: { ...DEFAULT_PERIODICITY_SETTINGS },
  monthly: { ...DEFAULT_PERIODICITY_SETTINGS },
  quarterly: { ...DEFAULT_PERIODICITY_SETTINGS },
  yearly: { ...DEFAULT_PERIODICITY_SETTINGS },
  deviceSettings: {},
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
    deviceSettings: savedSettings?.deviceSettings ?? {},
  };

  return result;
}
