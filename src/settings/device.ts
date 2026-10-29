export interface IDeviceSettings {
  createNotes: boolean;
  lastExecutionDate: string | null;  // YYYY-MM-DD of the last scheduled run
}

export interface LocalStorageApp {
  loadLocalStorage(key: string): unknown;
  saveLocalStorage(key: string, value: unknown): void;
}

export const DEFAULT_DEVICE_SETTINGS: IDeviceSettings = Object.freeze({
  createNotes: false,
  lastExecutionDate: null,
});

// Stored in Obsidian's vault-scoped local storage, which Obsidian Sync never copies to other devices.
export function loadDeviceSettings(app: LocalStorageApp, key: string): IDeviceSettings {
  const saved = app.loadLocalStorage(key) as Partial<IDeviceSettings> | null;
  return {
    createNotes: saved?.createNotes === true,
    lastExecutionDate: typeof saved?.lastExecutionDate === 'string' ? saved.lastExecutionDate : null,
  };
}

export function saveDeviceSettings(app: LocalStorageApp, key: string, settings: IDeviceSettings): void {
  app.saveLocalStorage(key, settings);
}
