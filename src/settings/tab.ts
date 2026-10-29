import { App, PluginSettingTab, Setting } from 'obsidian';
import { getNextDailyDate } from '../notes/provider';
import { IPeriodicity, ISettings, nextSwitchOnThisDevice, TIME_REGEX } from '.';
import AutoPeriodicNotes from '..';

// Indents a setting that only applies under the one above it (styles.css)
const SUB_SETTING = 'apn-sub-setting';

const OTHER_PERIODS: [IPeriodicity, string][] = [
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['quarterly', 'Quarterly'],
  ['yearly', 'Yearly'],
];

export default class AutoPeriodicNotesSettingsTab extends PluginSettingTab {
  public plugin: AutoPeriodicNotes;
  private expanded = new Set<IPeriodicity>();

  constructor(app: App, plugin: AutoPeriodicNotes) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();
    const settings: ISettings = this.plugin.settings;
    const save = () => this.plugin.updateSettings(settings);
    const otherPeriods = OTHER_PERIODS.filter(([periodicity]) => settings[periodicity].available);

    if (!settings.daily.available && otherPeriods.length === 0) {
      new Setting(this.containerEl)
        .setName('No periodic notes to manage')
        .setDesc('Turn on daily, weekly, monthly, quarterly or yearly notes in Periodic Notes first.');
    }

    new Setting(this.containerEl).setName('This device').setHeading();
    new Setting(this.containerEl)
      .setName('Create notes on this device')
      .setDesc('Not synced. Turn this on for one device only; the others open the notes it creates.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.deviceSettings.createNotes)
        .onChange((val) => this.plugin.updateDeviceSettings({ createNotes: val })));

    if (settings.daily.available) {
      this.displayDailySwitchAndTabs(settings, save);
    }

    if (settings.daily.available || otherPeriods.length > 0) {
      new Setting(this.containerEl).setName('Create automatically').setHeading();
      if (settings.daily.available) {
        new Setting(this.containerEl)
          .setName('Daily notes')
          .setDesc('Uses the folder and template set in Periodic Notes.')
          .addToggle((toggle) => toggle
            .setValue(settings.daily.enabled)
            .onChange(async (val) => {
              settings.daily.enabled = val;
              await save();
            }));
      }
      for (const [periodicity, label] of otherPeriods) {
        this.displayOtherPeriod(periodicity, label, settings, save);
      }
    }

    new Setting(this.containerEl).setName('Advanced').setHeading();
    if ((this.app as any).plugins?.plugins?.['templater-obsidian']) {
      new Setting(this.containerEl)
        .setName('Run Templater in new notes')
        .addToggle((toggle) => toggle
          .setValue(settings.processTemplater)
          .onChange(async (val) => {
            settings.processTemplater = val;
            await save();
          }));
    }
    new Setting(this.containerEl)
      .setName('Debug logging')
      .setDesc('Writes details to the developer console.')
      .addToggle((toggle) => toggle
        .setValue(settings.debug)
        .onChange(async (val) => {
          settings.debug = val;
          await save();
        }));
  }

  private displayDailySwitchAndTabs(settings: ISettings, save: () => Promise<void>): void {
    new Setting(this.containerEl).setName('Daily switch').setHeading();

    const status = new Setting(this.containerEl);
    const showStatus = () => {
      const current = this.plugin.currentDailyDate();
      const next = nextSwitchOnThisDevice(settings.daily.scheduledTime);
      status.setName(`Current daily note: ${current.format('YYYY-MM-DD')}`);
      status.setDesc(next
        ? `Switches to ${getNextDailyDate(current, settings.daily.excludeWeekends).format('YYYY-MM-DD')} at ${next.localTime} on this device.`
        : 'No switch time set.');
    };

    const switchTime = new Setting(this.containerEl).setName('Switch time (UTC)');
    const showSwitchTime = (value: string) => {
      const next = nextSwitchOnThisDevice(value);
      const invalid = value !== '' && !next;
      switchTime.setDesc(value === ''
        ? 'Not set. Today’s note follows this device’s date and updates when Obsidian starts or wakes.'
        : next
          ? `${next.localTime} on this device (${next.zone}). Every device switches at the same moment.`
          : 'Use 24-hour time, for example 14:00.');
      switchTime.descEl.toggleClass('mod-warning', invalid);
    };

    new Setting(this.containerEl)
      .setName('Skip weekends')
      .setDesc('No notes for Saturday and Sunday; Friday switches straight to Monday.')
      .addToggle((toggle) => toggle
        .setValue(settings.daily.excludeWeekends)
        .onChange(async (val) => {
          settings.daily.excludeWeekends = val;
          await save();
          showStatus();
        }));

    new Setting(this.containerEl).setName('Tabs').setHeading();
    const pin = new Setting(this.containerEl)
      .setName('Pin the daily note')
      .setDesc('Keeps the current daily note open and pinned.');
    const firstTab = new Setting(this.containerEl)
      .setClass(SUB_SETTING)
      .setName('Put it in the first tab')
      .addToggle((toggle) => toggle
        .setValue(settings.daily.openAtFirstPosition)
        .onChange(async (val) => {
          settings.daily.openAtFirstPosition = val;
          await save();
        }))
      .setDisabled(!settings.daily.openAndPin);
    pin.addToggle((toggle) => toggle
      .setValue(settings.daily.openAndPin)
      .onChange(async (val) => {
        settings.daily.openAndPin = val;
        firstTab.setDisabled(!val);
        await save();
      }));
    new Setting(this.containerEl)
      .setName('Close older daily notes')
      .setDesc('When Obsidian starts and when a new daily note is created.')
      .addToggle((toggle) => toggle
        .setValue(settings.daily.closeExisting)
        .onChange(async (val) => {
          settings.daily.closeExisting = val;
          await save();
        }));
    const unpinOnly = new Setting(this.containerEl)
      .setClass(SUB_SETTING)
      .setName('At the switch time, only unpin them')
      .setDesc('Older daily notes stay open, unpinned.')
      .addToggle((toggle) => toggle
        .setValue(settings.daily.unpinOldDailyNotes)
        .onChange(async (val) => {
          settings.daily.unpinOldDailyNotes = val;
          await save();
        }))
      .setDisabled(settings.daily.scheduledTime === '');

    switchTime.addText((text) => text
      .setPlaceholder('HH:mm')
      .setValue(settings.daily.scheduledTime)
      .onChange(async (value) => {
        const time = value.trim();
        showSwitchTime(time);
        if (time !== '' && !TIME_REGEX.test(time)) {
          return;
        }
        settings.daily.scheduledTime = time;
        unpinOnly.setDisabled(time === '');
        await save();
        showStatus();
      }));

    showStatus();
    showSwitchTime(settings.daily.scheduledTime);
  }

  private displayOtherPeriod(periodicity: IPeriodicity, label: string, settings: ISettings, save: () => Promise<void>): void {
    const expanded = this.expanded.has(periodicity);
    new Setting(this.containerEl)
      .setName(`${label} notes`)
      .addButton((button) => {
        button.buttonEl.setAttr('aria-expanded', String(expanded));
        button
          .setButtonText(expanded ? 'Hide options' : 'Options')
          .onClick(() => {
          if (expanded) {
            this.expanded.delete(periodicity);
          } else {
            this.expanded.add(periodicity);
          }
          this.display();
        });
      })
      .addToggle((toggle) => toggle
        .setValue(settings[periodicity].enabled)
        .onChange(async (val) => {
          settings[periodicity].enabled = val;
          await save();
        }));
    if (!expanded) {
      return;
    }
    new Setting(this.containerEl)
      .setClass(SUB_SETTING)
      .setName(`Pin the ${periodicity} note`)
      .addToggle((toggle) => toggle
        .setValue(settings[periodicity].openAndPin)
        .onChange(async (val) => {
          settings[periodicity].openAndPin = val;
          await save();
        }));
    new Setting(this.containerEl)
      .setClass(SUB_SETTING)
      .setName(`Close older ${periodicity} notes`)
      .addToggle((toggle) => toggle
        .setValue(settings[periodicity].closeExisting)
        .onChange(async (val) => {
          settings[periodicity].closeExisting = val;
          await save();
        }));
  }
}
