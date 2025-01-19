import { App, PluginSettingTab, Setting } from 'obsidian';
import { IPeriodicity, ISettings } from '.';
import AutoPeriodicNotes from '..';

export default class AutoPeriodicNotesSettingsTab extends PluginSettingTab {
  public plugin: AutoPeriodicNotes;

  constructor(app: App, plugin: AutoPeriodicNotes) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    const settings: ISettings = this.plugin.settings;
    const periodicities: IPeriodicity[] = [
      'daily',
      'weekly',
      'monthly',
      'quarterly',
      'yearly',
    ];
  
    if (!settings.daily.available && !settings.weekly.available && !settings.monthly.available && !settings.quarterly.available && !settings.yearly.available) {
      const bannerEl = this.containerEl.createDiv({ cls: 'settings-banner' });

      new Setting(bannerEl)
        .setName('No periodic notes enabled')
        .setHeading()
        .setDesc('No periodic notes settings are enabled. You must turn on one of daily, weekly, monthly, quarterly or yearly notes within the Periodic Notes plugin settings to be able to configure them to generate automatically.');
    }

    this.containerEl.createEl('h3', { text: `All periodic notes` });
    new Setting(this.containerEl)
      .setName('Always open periodic notes')
      .setDesc('When opening Obsidian or checking notes, always open your periodic notes even when they haven\'t just been created. This can be useful for maintaining a consistent workspace with pinned notes each time you start your day.')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.alwaysOpen)
          .onChange(async (val) => {
            settings.alwaysOpen = val;
            await this.plugin.updateSettings(settings);
          });
      });

    for (const periodicity of periodicities) {
      if (settings[periodicity].available) {
        this.containerEl.createEl('h3', { text: `Automatic ${periodicity} notes` });
        new Setting(this.containerEl)
          .setName(`Enable automatic ${periodicity} notes`)
          .setDesc(`Create new ${periodicity} notes automatically using periodic notes location and template.`)
          .addToggle((toggle) => {
            toggle
              .setValue(settings[periodicity].enabled)
              .onChange(async (val) => {
                settings[periodicity].enabled = val;
                await this.plugin.updateSettings(settings);
              });
          });
          
        if (periodicity === 'daily') {
          new Setting(this.containerEl)
            .setName(`Exclude weekends`)
            .setDesc('Only create new daily notes Monday - Friday, excluding Saturdays and Sundays.')
            .addToggle((toggle) => {
              toggle
                .setValue(settings[periodicity].excludeWeekends)
                .onChange(async (val) => {
                  settings[periodicity].excludeWeekends = val;
                  await this.plugin.updateSettings(settings);
                });
            });
        }

        new Setting(this.containerEl)
          .setName(`Open and pin new ${periodicity} notes`)
          .setDesc('When enabled, whether to automatically open the new note and pin it to your tabs.')
          .addToggle((toggle) => {
            toggle
              .setValue(settings[periodicity].openAndPin)
              .onChange(async (val) => {
                settings[periodicity].openAndPin = val;
                await this.plugin.updateSettings(settings);
              });
          });
        
        new Setting(this.containerEl)
          .setName(`Close older ${periodicity} notes`)
          .setDesc(`When creating new notes, automatically close any older and open ${periodicity} notes.`)
          .addToggle((toggle) => {
            toggle
              .setValue(settings[periodicity].closeExisting)
              .onChange(async (val) => {
                settings[periodicity].closeExisting = val;
                await this.plugin.updateSettings(settings);
              });
          });
      }
    }
  }
}
