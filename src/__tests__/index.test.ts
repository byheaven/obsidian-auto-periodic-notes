import { readFileSync } from 'fs';
import { PluginManifest } from 'obsidian';
import AutoPeriodicNotes from '../';
import { SETTINGS_UPDATED } from '../events';
import { DEFAULT_SETTINGS } from '../settings';
import { ObsidianApp, ObsidianWorkspace } from '../types';

describe('AutoPeriodicNotes', () => {
  let app: ObsidianApp;
  let workspace: ObsidianWorkspace;
  let manifest: PluginManifest;
  let sut: AutoPeriodicNotes;

  beforeEach(() => {
    app = jest.fn() as unknown as ObsidianApp;
    workspace = jest.fn() as unknown as ObsidianWorkspace;
    workspace.onLayoutReady = jest.fn();
    workspace.trigger = jest.fn();
    app.workspace = workspace;
    manifest = JSON.parse(readFileSync(__dirname + '/../../manifest.json', 'utf-8'));
    sut = new AutoPeriodicNotesTestable(app, manifest);
  });

  it('loads settings', async () => {
    await sut.loadSettings();

    expect(sut.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('updates settings', async () => {
    await sut.loadSettings();

    const settings = DEFAULT_SETTINGS;
    settings.daily.available = true;
    settings.daily.enabled = true;
    settings.daily.openAndPin = true;

    const workspaceTrigger = jest.spyOn(workspace, 'trigger');

    await sut.updateSettings(settings);

    expect(sut.settings).toEqual(settings);
    expect(workspaceTrigger).toHaveBeenCalledWith(SETTINGS_UPDATED);
  });
});

class AutoPeriodicNotesTestable extends AutoPeriodicNotes {
  constructor(app: ObsidianApp, manifest: PluginManifest) {
    super(app, manifest);

    this.app = app;
    this.manifest = manifest;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadData(): Promise<any> {
    return Promise.resolve(DEFAULT_SETTINGS);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveData(data: any): Promise<void> {
    return Promise.resolve();
  }
}
