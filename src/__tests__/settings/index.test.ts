import { applyDefaultSettings, type ISettings } from '../../settings';

describe('settings', () => {

  it('applies default settings with empty object', () => {
    const settings = {} as ISettings;

    const result = applyDefaultSettings(settings);

    expect(result.alwaysOpen).toEqual(false);
    expect(result.debug).toEqual(false);
    expect(result.daily.available).toEqual(false);
    expect(result.daily.enabled).toEqual(false);
    expect(result.daily.closeExisting).toEqual(false);
    expect(result.daily.openAndPin).toEqual(false);
  });

  it('applies default settings but overrides with saved settings correctly', () => {
    const settings = {
      daily: {
        available: true,
        enabled: true,
        closeExisting: true,
        openAndPin: true
      }
    } as ISettings;

    const result = applyDefaultSettings(settings);

    expect(result.daily.available).toEqual(true);
    expect(result.daily.enabled).toEqual(true);
    expect(result.daily.closeExisting).toEqual(true);
    expect(result.daily.openAndPin).toEqual(true);
  });

  it('applies default values for new fields when loading old saved settings', () => {
    // Simulate old saved settings without new fields (debug, excludeWeekends, openAtFirstPosition)
    const oldSettings = {
      alwaysOpen: false,
      daily: {
        available: true,
        enabled: true,
        closeExisting: false,
        openAndPin: true
      },
      weekly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false
      },
      monthly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false
      },
      quarterly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false
      },
      yearly: {
        available: false,
        enabled: false,
        closeExisting: false,
        openAndPin: false
      }
    } as ISettings;

    const result = applyDefaultSettings(oldSettings);

    // Check that existing fields are preserved
    expect(result.alwaysOpen).toEqual(false);
    expect(result.daily.available).toEqual(true);
    expect(result.daily.enabled).toEqual(true);
    expect(result.daily.closeExisting).toEqual(false);
    expect(result.daily.openAndPin).toEqual(true);

    // Check that new fields get default values
    expect(result.debug).toEqual(false);
    expect(result.daily.excludeWeekends).toEqual(false);
    expect(result.daily.openAtFirstPosition).toEqual(false);
  });

});
