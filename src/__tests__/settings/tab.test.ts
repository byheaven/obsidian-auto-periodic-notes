import { App, Setting, ToggleComponent } from 'obsidian';
import AutoTasks from '../..';
import { DEFAULT_SETTINGS } from '../../settings';
import { DEFAULT_DEVICE_SETTINGS } from '../../settings/device';
import AutoPeriodicNotesSettingsTab from '../../settings/tab';

describe('settings tab', () => {

  let app: App;
  let plugin: AutoTasks;
  let containerEl: HTMLElement;

  let sut: AutoPeriodicNotesSettingsTab;

  // Helper to create a mock element that supports nested createEl/createDiv calls
  const createMockElement = (): any => {
    const mockEl: any = jest.fn();
    mockEl.createDiv = jest.fn(() => createMockElement());
    mockEl.createEl = jest.fn(() => createMockElement());
    return mockEl;
  };

  beforeEach(() => {
    // Create proper app mock object (not a function)
    app = {
      plugins: {
        plugins: {},
      },
    } as unknown as App;
    plugin = jest.fn() as unknown as AutoTasks;
    plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
    plugin.deviceSettings = { ...DEFAULT_DEVICE_SETTINGS };
    plugin.updateDeviceSettings = jest.fn();
    containerEl = createMockElement() as unknown as HTMLElement;
    containerEl.empty = jest.fn();

    sut = new AutoPeriodicNotesSettingsTab(app, plugin);
    sut.containerEl = containerEl;
    // Manually set app since the mock PluginSettingTab doesn't do it
    (sut as any).app = app;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it('displays banner when periodic notes plugin is unavailable', () => {
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    sut.display();

    expect(setNameSpy).toHaveBeenCalledWith('No periodic notes enabled');
  });

  it('does not display banner when periodic notes plugin is unavailable', () => {
    plugin.settings.daily.available = true;
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    sut.display();

    expect(setNameSpy).not.toHaveBeenCalledWith('No periodic notes enabled');
  });

  it('shows the device creation toggle off by default and saves changes on this device', () => {
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');
    const setValueSpy = jest.spyOn(ToggleComponent.prototype, 'setValue');
    const onChangeSpy = jest.spyOn(ToggleComponent.prototype, 'onChange');

    sut.display();

    expect(setNameSpy).toHaveBeenCalledWith('Create notes on this device');
    expect(setValueSpy).toHaveBeenNthCalledWith(1, false);
    onChangeSpy.mock.calls[0][0](true);
    expect(plugin.updateDeviceSettings).toHaveBeenCalledWith({ createNotes: true });
  });

  it('displays the always open setting', () => {
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    sut.display();

    expect(setNameSpy).toHaveBeenCalledWith('Always open periodic notes');
  });

  it('displays settings for daily periodicity', () => {
    plugin.settings.daily.available = true;
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    sut.display();

    expect(setNameSpy).toHaveBeenCalledWith('Enable automatic daily notes');
    expect(setNameSpy).toHaveBeenCalledWith('Open and pin new daily notes');
    expect(setNameSpy).toHaveBeenCalledWith('Close older daily notes');
    expect(setNameSpy).toHaveBeenCalledWith('Exclude weekends');
    expect(setNameSpy).not.toHaveBeenCalledWith('Enable automatic weekly notes');
  });

  it('displays settings for weekly periodicity', () => {
    plugin.settings.daily.available = false;
    plugin.settings.weekly.available = true;
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    sut.display();

    expect(setNameSpy).toHaveBeenCalledWith('Enable automatic weekly notes');
    expect(setNameSpy).toHaveBeenCalledWith('Open and pin new weekly notes');
    expect(setNameSpy).toHaveBeenCalledWith('Close older weekly notes');
    expect(setNameSpy).not.toHaveBeenCalledWith('Exclude weekends');
    expect(setNameSpy).not.toHaveBeenCalledWith('Enable automatic monthly notes');
  });

  it('displays settings for all periodicities', () => {
    plugin.settings.daily.available = true;
    plugin.settings.weekly.available = true;
    plugin.settings.monthly.available = true;
    plugin.settings.quarterly.available = true;
    plugin.settings.yearly.available = true;
    const setNameSpy = jest.spyOn(Setting.prototype, 'setName');

    sut.display();

    expect(setNameSpy).toHaveBeenCalledWith('Enable automatic daily notes');
    expect(setNameSpy).toHaveBeenCalledWith('Enable automatic weekly notes');
    expect(setNameSpy).toHaveBeenCalledWith('Enable automatic monthly notes');
    expect(setNameSpy).toHaveBeenCalledWith('Enable automatic quarterly notes');
    expect(setNameSpy).toHaveBeenCalledWith('Enable automatic yearly notes');
    expect(setNameSpy).toHaveBeenCalledWith('Open and pin new yearly notes');
    expect(setNameSpy).toHaveBeenCalledWith('Close older yearly notes');
  });

});
