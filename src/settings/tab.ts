import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
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

    this.containerEl.createEl('h3', { text: `General settings` });

    new Setting(this.containerEl)
      .setName('Enable debug logging')
      .setDesc('Enable detailed debug logging in the developer console. Useful for troubleshooting issues.')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.debug)
          .onChange(async (val) => {
            settings.debug = val;
            await this.plugin.updateSettings(settings);
          });
      });

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

    // Only show Templater setting if Templater plugin is installed
    const templaterInstalled = !!(this.app as any).plugins?.plugins?.['templater-obsidian'];
    if (templaterInstalled) {
      new Setting(this.containerEl)
        .setName('Process Templater code in automatically created notes')
        .setDesc('When enabled, automatically process and remove Templater syntax (like <% tp.file.cursor(0) %>) from notes created in the background. Note: With the current implementation of Templater processing APIs, this leads to a brief creation and then closure of tabs in the UI.')
        .addToggle((toggle) => {
          toggle
            .setValue(settings.processTemplater)
            .onChange(async (val) => {
              settings.processTemplater = val;
              await this.plugin.updateSettings(settings);
            });
        });
    }

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
          // === Behavior Options (Universal) ===
          this.containerEl.createEl('h4', { text: 'Behavior Options (applies to all checks)' });

          new Setting(this.containerEl)
            .setName(`Exclude weekends`)
            .setDesc('Skip creating daily notes on Saturdays and Sundays. Applies to both the 00:02 check and custom scheduled time.')
            .addToggle((toggle) => {
              toggle
                .setValue(settings[periodicity].excludeWeekends)
                .onChange(async (val) => {
                  settings[periodicity].excludeWeekends = val;
                  await this.plugin.updateSettings(settings);
                });
            });

          new Setting(this.containerEl)
            .setName(`Open daily notes at first position`)
            .setDesc('Position new daily note tabs at the first position instead of at the end.')
            .addToggle((toggle) => {
              toggle
                .setValue(settings[periodicity].openAtFirstPosition)
                .onChange(async (val) => {
                  settings[periodicity].openAtFirstPosition = val;
                  await this.plugin.updateSettings(settings);
                });
            });

          // === Advanced: Custom Scheduled Time ===
          this.containerEl.createEl('h4', { text: 'Advanced: Custom Scheduled Time', cls: 'setting-item-heading' });

          new Setting(this.containerEl)
            .setName('Enable custom scheduled time')
            .setDesc('Schedule an additional daily check at a custom time (e.g., 22:30 to create tomorrow\'s note before sleep). The 00:02 check still runs separately.')
            .addToggle((toggle) => {
              toggle
                .setValue(settings[periodicity].enableAdvancedScheduling)
                .onChange(async (val) => {
                  settings[periodicity].enableAdvancedScheduling = val;
                  await this.plugin.updateSettings(settings);
                  this.display(); // Refresh UI to show/hide dependent settings
                });
            });

          // Show these only if advanced scheduling enabled
          if (settings[periodicity].enableAdvancedScheduling) {
            new Setting(this.containerEl)
              .setName('Scheduled time')
              .setDesc('Time for the custom check (24-hour format, e.g., 22:30). The default 00:02 check is separate and always runs.')
              .addText((text) => {
                text
                  .setPlaceholder('HH:mm (e.g., 22:30)')
                  .setValue(settings[periodicity].scheduledTime)
                  .onChange(async (val) => {
                    const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(val);
                    if (isValid || val === '') {
                      settings[periodicity].scheduledTime = val || '00:02';
                      await this.plugin.updateSettings(settings);
                    } else {
                      new Notice('Invalid time format. Use HH:mm (e.g., 22:30)');
                    }
                  });
              });

            new Setting(this.containerEl)
              .setName("Create tomorrow's daily note")
              .setDesc("At the custom scheduled time, create tomorrow's note instead of today's. The 00:02 check will still create today's note if needed.")
              .addToggle((toggle) => {
                toggle
                  .setValue(settings[periodicity].createTomorrowsNote)
                  .onChange(async (val) => {
                    settings[periodicity].createTomorrowsNote = val;
                    await this.plugin.updateSettings(settings);
                  });
              });

            new Setting(this.containerEl)
              .setName('Unpin old daily notes (custom time only)')
              .setDesc('At the custom scheduled time, unpin all old daily notes instead of closing them. The 00:02 and startup checks use the "Close older daily notes" setting below.')
              .addToggle((toggle) => {
                toggle
                  .setValue(settings[periodicity].unpinOldDailyNotes)
                  .onChange(async (val) => {
                    settings[periodicity].unpinOldDailyNotes = val;
                    await this.plugin.updateSettings(settings);
                  });
              });
          }
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
          .setDesc(
            periodicity === 'daily'
              ? 'When creating notes at 00:02 or on plugin startup, automatically close older open daily notes. This does NOT apply to the custom scheduled time.'
              : `When creating new notes, automatically close any older and open ${periodicity} notes.`
          )
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
