/** @jest-environment ./src/test-environments/time-zone-environment.js */
import { applyDefaultSettings, nextSwitchOnThisDevice, type ISettings } from '../../settings';

declare const setTimeZone: (zone: string) => void;

describe('settings', () => {

  it('applies default settings with empty object', () => {
    const settings = {} as ISettings;

    const result = applyDefaultSettings(settings);

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
    expect(result.daily.available).toEqual(true);
    expect(result.daily.enabled).toEqual(true);
    expect(result.daily.closeExisting).toEqual(false);
    expect(result.daily.openAndPin).toEqual(true);

    // Check that new fields get default values
    expect(result.debug).toEqual(false);
    expect(result.daily.excludeWeekends).toEqual(false);
    expect(result.daily.openAtFirstPosition).toEqual(false);
  });


  describe('settings saved by 0.6.2', () => {
    const period = { available: true, enabled: true, closeExisting: false, openAndPin: false };
    const saved062 = () => ({
      alwaysOpen: true,
      processTemplater: true,
      debug: false,
      daily: {
        available: true, enabled: true, closeExisting: true, openAndPin: true, excludeWeekends: false,
        openAtFirstPosition: true, enableAdvancedScheduling: true, createTomorrowsNote: true,
        unpinOldDailyNotes: true, scheduledTime: '14:00',
      },
      weekly: { ...period }, monthly: { ...period }, quarterly: { ...period }, yearly: { ...period },
    });

    it('keep every value and drop the removed settings', () => {
      expect(applyDefaultSettings(saved062())).toEqual({
        processTemplater: true,
        debug: false,
        daily: {
          available: true, enabled: true, closeExisting: true, openAndPin: true, excludeWeekends: false,
          openAtFirstPosition: true, unpinOldDailyNotes: true, scheduledTime: '14:00',
        },
        weekly: period, monthly: period, quarterly: period, yearly: period,
      });
    });

    it('leave the switch time unset when custom scheduling was off', () => {
      const saved = saved062();
      saved.daily.enableAdvancedScheduling = false;

      const result = applyDefaultSettings(saved);

      expect(result.daily.scheduledTime).toBe('');
      expect(applyDefaultSettings(JSON.parse(JSON.stringify(result))).daily.scheduledTime).toBe('');
    });

    it('come out the same when loaded again', () => {
      const migrated = applyDefaultSettings(saved062());

      expect(applyDefaultSettings(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    });

    it('keep each note type\'s pin setting whatever alwaysOpen was', () => {
      const saved = saved062();
      saved.alwaysOpen = false;

      const result = applyDefaultSettings(saved);

      expect(result.daily.openAndPin).toBe(true);
      expect(result.weekly.openAndPin).toBe(false);
    });
  });

  describe('next switch on this device', () => {
    it.each([
      ['Asia/Shanghai', '14:00', '2026-10-29T03:00:00Z', '22:00'],
      ['America/Los_Angeles', '14:00', '2026-10-29T03:00:00Z', '07:00'],
      ['America/Los_Angeles', '14:00', '2026-11-02T03:00:00Z', '06:00'],
      ['America/Los_Angeles', '14:00', '2026-10-31T20:00:00Z', '06:00'],
      ['Asia/Shanghai', '20:00', '2026-10-29T03:00:00Z', '04:00'],
    ])('in %s shows %s UTC at %s as %s on the local clock', (zone, time, now, localTime) => {
      setTimeZone(zone);

      expect(nextSwitchOnThisDevice(time, new Date(now))).toEqual({ localTime, zone });
    });

    it('handles zones with a half-hour offset', () => {
      setTimeZone('Asia/Kolkata');

      expect(nextSwitchOnThisDevice('14:00', new Date('2026-10-29T03:00:00Z'))?.localTime).toBe('19:30');
    });

    it('has no switch without a valid time', () => {
      expect(nextSwitchOnThisDevice('')).toBeNull();
      expect(nextSwitchOnThisDevice('25:00')).toBeNull();
    });
  });
});
