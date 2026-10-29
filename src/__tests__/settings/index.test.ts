/** @jest-environment ./src/test-environments/time-zone-environment.js */
import { applyDefaultSettings, describeScheduledTime, type ISettings } from '../../settings';

declare const setTimeZone: (zone: string) => void;

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


  describe('scheduled time hint', () => {
    it.each([
      ['Asia/Shanghai', '14:00', '2026-10-29T03:00:00Z', '14:00 UTC = 22:00 on this device (Asia/Shanghai)'],
      ['America/Los_Angeles', '14:00', '2026-10-29T03:00:00Z', '14:00 UTC = 07:00 on this device (America/Los_Angeles)'],
      ['America/Los_Angeles', '14:00', '2026-11-02T03:00:00Z', '14:00 UTC = 06:00 on this device (America/Los_Angeles)'],
      ['America/Los_Angeles', '14:00', '2026-10-31T20:00:00Z', '14:00 UTC = 06:00 on this device (America/Los_Angeles)'],
      ['Asia/Shanghai', '20:00', '2026-10-29T03:00:00Z', '20:00 UTC = 04:00 on this device (Asia/Shanghai)'],
    ])('in %s shows %s UTC at %s as the next run on the local clock', (zone, time, now, expected) => {
      setTimeZone(zone);

      expect(describeScheduledTime(time, new Date(now))).toBe(expected);
    });

    it('handles zones with a half-hour offset', () => {
      setTimeZone('Asia/Kolkata');

      expect(describeScheduledTime('14:00', new Date('2026-10-29T03:00:00Z'))).toMatch(/^14:00 UTC = 19:30 on this device \(Asia\/(Kolkata|Calcutta)\)$/);
    });

    it('describes nothing without a valid time', () => {
      expect(describeScheduledTime('')).toBe('');
    });
  });
});
