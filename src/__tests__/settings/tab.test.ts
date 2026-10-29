import { App, moment, Setting } from 'obsidian';
import AutoPeriodicNotes from '../..';
import { DEFAULT_SETTINGS, type ISettings } from '../../settings';
import { DEFAULT_DEVICE_SETTINGS } from '../../settings/device';
import AutoPeriodicNotesSettingsTab from '../../settings/tab';

type RenderedSetting = Setting & { name: string; heading: boolean; toggles: { changeHandler: (val: boolean) => unknown }[] };

describe('settings tab', () => {
  let app: App;
  let plugin: AutoPeriodicNotes;
  let sut: AutoPeriodicNotesSettingsTab;

  const rendered = () => (Setting as unknown as { rendered: RenderedSetting[] }).rendered;
  const names = () => rendered().map((setting) => setting.name);
  const find = (name: string) => rendered().find((setting) => setting.name === name)!;
  const withAvailable = (...available: (keyof Omit<ISettings, 'processTemplater' | 'debug'>)[]): ISettings => {
    const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    for (const periodicity of available) {
      settings[periodicity].available = true;
    }
    return settings;
  };

  beforeEach(() => {
    rendered().length = 0;
    app = { plugins: { plugins: {} } } as unknown as App;
    plugin = {
      settings: withAvailable(),
      deviceSettings: { ...DEFAULT_DEVICE_SETTINGS },
      updateDeviceSettings: jest.fn(),
      updateSettings: jest.fn(),
      currentDailyDate: () => moment('2026-10-29', 'YYYY-MM-DD'),
    } as unknown as AutoPeriodicNotes;
    sut = new AutoPeriodicNotesSettingsTab(app, plugin);
    sut.containerEl = { empty: jest.fn() } as unknown as HTMLElement;
    (sut as any).app = app;
  });

  it('points to Periodic Notes when it has no note types turned on', () => {
    sut.display();

    expect(names()).toContain('No periodic notes to manage');
    expect(names()).not.toContain('Daily switch');
    expect(names()).not.toContain('Create automatically');
  });

  it('shows only the note types turned on in Periodic Notes', () => {
    plugin.settings = withAvailable('daily', 'monthly', 'yearly');

    sut.display();

    expect(names()).not.toContain('No periodic notes to manage');
    expect(names()).toEqual(expect.arrayContaining(['Daily notes', 'Monthly notes', 'Yearly notes']));
    expect(names()).not.toContain('Weekly notes');
    expect(names()).not.toContain('Quarterly notes');
  });

  it('keeps the device switch out of the synced settings', () => {
    sut.display();

    find('Create notes on this device').toggles[0].changeHandler(true);

    expect(plugin.updateDeviceSettings).toHaveBeenCalledWith({ createNotes: true });
    expect(plugin.updateSettings).not.toHaveBeenCalled();
  });

  it('offers Templater only when it is installed', () => {
    sut.display();
    expect(names()).not.toContain('Run Templater in new notes');

    rendered().length = 0;
    (app as any).plugins.plugins['templater-obsidian'] = {};
    sut.display();
    expect(names()).toContain('Run Templater in new notes');
  });
});
