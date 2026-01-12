import { App, PluginSettingTab, Setting, ToggleComponent } from 'obsidian';
import { ISettings } from '.';
import AutoPeriodicNotes from '..';
import { periodicities } from '../constants';

export default class AutoPeriodicNotesSettingsTab extends PluginSettingTab {
  public plugin: AutoPeriodicNotes;

  constructor(app: App, plugin: AutoPeriodicNotes) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    this.containerEl.empty();

    const settings: ISettings = this.plugin.settings;

    if (
      !settings.daily.available &&
      !settings.weekly.available &&
      !settings.monthly.available &&
      !settings.quarterly.available &&
      !settings.yearly.available
    ) {
      const bannerEl = this.containerEl.createDiv({ cls: 'settings-banner' });

      new Setting(bannerEl)
        .setName('No periodic notes enabled')
        .setHeading()
        .setDesc(
          'No periodic notes settings are enabled. You must turn on one of daily, weekly, monthly, quarterly or yearly notes within the Periodic Notes plugin settings to be able to configure them to generate automatically.'
        );
    }

    this.containerEl.createEl('h3', { text: `All periodic notes` });
    new Setting(this.containerEl)
      .setName('Always open periodic notes')
      .setDesc(
        "When opening Obsidian or checking notes, always open your periodic notes even when they haven't just been created. This can be useful for maintaining a consistent workspace with pinned notes each time you start your day."
      )
      .addToggle((toggle) => {
        toggle.setValue(settings.alwaysOpen).onChange(async (val) => {
          settings.alwaysOpen = val;
          await this.plugin.updateSettings(settings);
        });
      });

    // Only show Templater setting if Templater plugin is installed
    const templaterInstalled = !!(this.app as any).plugins?.plugins?.['templater-obsidian'];
    if (templaterInstalled) {
      new Setting(this.containerEl)
        .setName('Process Templater code in automatically created notes')
        .setDesc(
          'When enabled, automatically process and remove Templater syntax (like <% tp.file.cursor(0) %>) from notes created in the background. Note: With the current implementation of Templater processing APIs, this leads to a brief creation and then closure of tabs in the UI.'
        )
        .addToggle((toggle) => {
          toggle.setValue(settings.processTemplater).onChange(async (val) => {
            settings.processTemplater = val;
            await this.plugin.updateSettings(settings);
          });
        });
    }

    // Show git settings if within Git repo
    this.containerEl.createEl('h3', { text: `Automatic git commits` });
    new Setting(this.containerEl)
      .setName('Enable automatic git commit at the end of each day (18:00/6pm)')
      .setDesc('When enabled, automatically commit any changes within the vault.')
      .addToggle((toggle) => {
        toggle.setValue(settings.gitCommit).onChange(async (val) => {
          settings.gitCommit = val;
          await this.plugin.updateSettings(settings);
        });
      });

    new Setting(this.containerEl)
      .setName('Git commit message format')
      .setDesc(
        'Set the message to use when committing, where {DATE} will be replaced with the current date.'
      )
      .addTextArea((text) => {
        text.setValue(settings.gitCommitMessage).onChange(async (val) => {
          settings.gitCommitMessage = val;
          await this.plugin.updateSettings(settings);
        });
      });

    for (const periodicity of periodicities) {
      if (settings[periodicity].available) {
        this.containerEl.createEl('h3', { text: `Automatic ${periodicity} notes` });
        new Setting(this.containerEl)
          .setName(`Enable automatic ${periodicity} notes`)
          .setDesc(
            `Create new ${periodicity} notes automatically using periodic notes location and template.`
          )
          .addToggle((toggle) => {
            toggle.setValue(settings[periodicity].enabled).onChange(async (val) => {
              settings[periodicity].enabled = val;
              await this.plugin.updateSettings(settings);
            });
          });

        if (periodicity === 'daily') {
          new Setting(this.containerEl)
            .setName(`Exclude weekends`)
            .setDesc(
              'Only create new daily notes Monday - Friday, excluding Saturdays and Sundays.'
            )
            .addToggle((toggle) => {
              toggle.setValue(settings[periodicity].excludeWeekends).onChange(async (val) => {
                settings[periodicity].excludeWeekends = val;
                await this.plugin.updateSettings(settings);
              });
            });
        }

        let pinToggle: ToggleComponent;
        new Setting(this.containerEl)
          .setName(`Open new ${periodicity} notes`)
          .setDesc('Automatically open the new note when created.')
          .addToggle((toggle) => {
            toggle.setValue(settings[periodicity].open).onChange(async (val) => {
              pinToggle.setDisabled(!val);
              settings[periodicity].open = val;
              await this.plugin.updateSettings(settings);
            });
          });

        new Setting(this.containerEl)
          .setName(`Pin new ${periodicity} notes`)
          .setDesc('Automatically pin the new note to your tabs.')
          .addToggle((toggle) => {
            pinToggle = toggle;
            toggle
              .setDisabled(!settings[periodicity].open)
              .setValue(settings[periodicity].pin)
              .onChange(async (val) => {
                settings[periodicity].pin = val;
                await this.plugin.updateSettings(settings);
              });
          });

        new Setting(this.containerEl)
          .setName(`Close older ${periodicity} notes`)
          .setDesc(
            `When creating new notes, automatically close any older and open ${periodicity} notes.`
          )
          .addToggle((toggle) => {
            toggle.setValue(settings[periodicity].closeExisting).onChange(async (val) => {
              settings[periodicity].closeExisting = val;
              await this.plugin.updateSettings(settings);
            });
          });
      }
    }
  }
}
