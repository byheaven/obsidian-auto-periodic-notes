export interface IDeviceSettings {
  createNotes: boolean;
  scheduledTime: string;  // HH:mm, empty when no scheduled run
  lastExecutionDate: string | null;  // YYYY-MM-DD of the last scheduled run
}

export interface LocalStorageApp {
  loadLocalStorage(key: string): unknown;
  saveLocalStorage(key: string, value: unknown): void;
}

export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DEFAULT_DEVICE_SETTINGS: IDeviceSettings = Object.freeze({
  createNotes: false,
  scheduledTime: '',
  lastExecutionDate: null,
});

// Stored in Obsidian's vault-scoped local storage, which Obsidian Sync never copies to other devices.
export function loadDeviceSettings(app: LocalStorageApp, key: string): IDeviceSettings {
  const saved = app.loadLocalStorage(key) as Partial<IDeviceSettings> | null;
  return {
    createNotes: saved?.createNotes === true,
    scheduledTime: typeof saved?.scheduledTime === 'string' && TIME_REGEX.test(saved.scheduledTime) ? saved.scheduledTime : '',
    lastExecutionDate: typeof saved?.lastExecutionDate === 'string' ? saved.lastExecutionDate : null,
  };
}

export function saveDeviceSettings(app: LocalStorageApp, key: string, settings: IDeviceSettings): void {
  app.saveLocalStorage(key, settings);
}
