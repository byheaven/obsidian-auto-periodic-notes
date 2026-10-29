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
  unpinOldDailyNotes: boolean;
  scheduledTime: string;  // HH:mm in UTC, empty when no scheduled run
}

export interface ISettings {
  processTemplater: boolean;
  debug: boolean;
  daily: IDailySettings;
  weekly: IPeriodicitySettings;
  monthly: IPeriodicitySettings;
  quarterly: IPeriodicitySettings;
  yearly: IPeriodicitySettings;
}

export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface LocalSwitchTime {
  localTime: string;  // HH:mm on this device's clock
  zone: string;  // this device's IANA time zone
}

// The UTC switch time as this device's clock will show it at the next switch, which differs from today's
// local time on a daylight saving change.
export function nextSwitchOnThisDevice(scheduledTime: string, now: Date = new Date()): LocalSwitchTime | null {
  const match = scheduledTime.match(TIME_REGEX);
  if (!match) {
    return null;
  }
  const nextRun = new Date(now);
  nextRun.setUTCHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  return {
    localTime: `${String(nextRun.getHours()).padStart(2, '0')}:${String(nextRun.getMinutes()).padStart(2, '0')}`,
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// Fields older versions stored in the synced data.json: alwaysOpen is now each note type's openAndPin,
// enableAdvancedScheduling is a non-empty scheduledTime, createTomorrowsNote never changed the switch,
// and device-specific values live in ./device.
type SavedSettings = Partial<Omit<ISettings, 'daily'>> & {
  alwaysOpen?: unknown;
  daily?: Partial<IDailySettings> & { enableAdvancedScheduling?: boolean; createTomorrowsNote?: unknown };
  deviceSettings?: unknown;
};

export const DEFAULT_PERIODICITY_SETTINGS: IPeriodicitySettings = Object.freeze({
  available: false,
  enabled: false,
  closeExisting: false,
  openAndPin: false,
});

export const DEFAULT_SETTINGS: ISettings = Object.freeze({
  processTemplater: false,
  debug: false,
  daily: {
    ...DEFAULT_PERIODICITY_SETTINGS,
    excludeWeekends: false,
    openAtFirstPosition: false,
    unpinOldDailyNotes: false,
    scheduledTime: '',
  },
  weekly: { ...DEFAULT_PERIODICITY_SETTINGS },
  monthly: { ...DEFAULT_PERIODICITY_SETTINGS },
  quarterly: { ...DEFAULT_PERIODICITY_SETTINGS },
  yearly: { ...DEFAULT_PERIODICITY_SETTINGS },
});

export function applyDefaultSettings(savedSettings: SavedSettings | null | undefined): ISettings {
  const { enableAdvancedScheduling, createTomorrowsNote: _ignored, ...savedDaily } = savedSettings?.daily ?? {};
  const scheduledTime = enableAdvancedScheduling !== false && typeof savedDaily.scheduledTime === 'string' && TIME_REGEX.test(savedDaily.scheduledTime)
    ? savedDaily.scheduledTime
    : '';
  // Perform deep merge to ensure new fields get default values
  const result: ISettings = {
    processTemplater: savedSettings?.processTemplater ?? DEFAULT_SETTINGS.processTemplater,
    debug: savedSettings?.debug ?? DEFAULT_SETTINGS.debug,
    daily: {
      ...DEFAULT_SETTINGS.daily,
      ...savedDaily,
      scheduledTime,
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
