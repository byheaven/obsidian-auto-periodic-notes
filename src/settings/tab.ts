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

    // === General Settings ===
    this.containerEl.createEl('h3', { text: 'General settings' });

    new Setting(this.containerEl)
      .setName('Enable debug logging')
      .setDesc('Enable detailed debug logging in the developer console.')
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
      .setDesc('Always open your periodic notes even when they haven\'t just been created.')
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
        .setDesc('Automatically process Templater syntax from notes created in the background.')
        .addToggle((toggle) => {
          toggle
            .setValue(settings.processTemplater)
            .onChange(async (val) => {
              settings.processTemplater = val;
              await this.plugin.updateSettings(settings);
            });
        });
    }

    // === Per-Periodicity Settings ===
    for (const periodicity of periodicities) {
      if (settings[periodicity].available) {
        this.renderPeriodicitySection(periodicity, settings);
      }
    }
  }

  private renderPeriodicitySection(periodicity: IPeriodicity, settings: ISettings): void {
    const isDaily = periodicity === 'daily';

    // Section header
    this.containerEl.createEl('h3', { text: `Automatic ${periodicity} notes` });

    // Enable toggle
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

    // Exclude weekends (daily only)
    if (isDaily) {
      new Setting(this.containerEl)
        .setName('Exclude weekends')
        .setDesc('Skip creating daily notes on Saturdays and Sundays.')
        .addToggle((toggle) => {
          toggle
            .setValue(settings.daily.excludeWeekends)
            .onChange(async (val) => {
              settings.daily.excludeWeekends = val;
              await this.plugin.updateSettings(settings);
            });
        });
    }

    new Setting(this.containerEl)
      .setName(`Open and pin new ${periodicity} notes`)
      .setDesc('Automatically open and pin the new note to your tabs.')
      .addToggle((toggle) => {
        toggle
          .setValue(settings[periodicity].openAndPin)
          .onChange(async (val) => {
            settings[periodicity].openAndPin = val;
            await this.plugin.updateSettings(settings);
          });
      });

    if (isDaily) {
      new Setting(this.containerEl)
        .setName('Open daily notes at first position')
        .setDesc('Position new daily note tabs at the first position.')
        .addToggle((toggle) => {
          toggle
            .setValue(settings.daily.openAtFirstPosition)
            .onChange(async (val) => {
              settings.daily.openAtFirstPosition = val;
              await this.plugin.updateSettings(settings);
            });
        });
    }

    new Setting(this.containerEl)
      .setName(`Close older ${periodicity} notes`)
      .setDesc(
        isDaily
          ? 'Close older open daily notes at 00:02 or on startup (not at custom scheduled time).'
          : `Automatically close any older open ${periodicity} notes.`
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings[periodicity].closeExisting)
          .onChange(async (val) => {
            settings[periodicity].closeExisting = val;
            await this.plugin.updateSettings(settings);
          });
      });

    // === Advanced: Custom Scheduled Time (daily only, collapsible) ===
    if (isDaily) {
      this.renderDailyAdvancedSection(settings);
    }
  }

  private renderDailyAdvancedSection(settings: ISettings): void {
    // Create collapsible section using native HTML details element
    const detailsEl = this.containerEl.createEl('details', { cls: 'setting-item-details' });
    detailsEl.createEl('summary', { 
      text: 'Advanced: Custom Scheduled Time',
      cls: 'setting-item-heading'
    });

    // Container for settings inside the collapsible
    const advancedContainer = detailsEl.createDiv({ cls: 'setting-item-details-content' });

    new Setting(advancedContainer)
      .setName('Enable custom scheduled time')
      .setDesc('Schedule an additional daily check at a custom time (e.g., 22:30 to create tomorrow\'s note before sleep).')
      .addToggle((toggle) => {
        toggle
          .setValue(settings.daily.enableAdvancedScheduling)
          .onChange(async (val) => {
            settings.daily.enableAdvancedScheduling = val;
            await this.plugin.updateSettings(settings);
            this.display(); // Refresh UI to show/hide dependent settings
          });
      });

    // Show dependent settings only if advanced scheduling is enabled
    if (settings.daily.enableAdvancedScheduling) {
      new Setting(advancedContainer)
        .setName('Scheduled time')
        .setDesc('Time for the custom check (24-hour format, e.g., 22:30).')
        .addText((text) => {
          text
            .setPlaceholder('HH:mm (e.g., 22:30)')
            .setValue(settings.daily.scheduledTime)
            .onChange(async (val) => {
              const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(val);
              if (isValid || val === '') {
                settings.daily.scheduledTime = val || '00:02';
                await this.plugin.updateSettings(settings);
              } else {
                new Notice('Invalid time format. Use HH:mm (e.g., 22:30)');
              }
            });
        });

      new Setting(advancedContainer)
        .setName("Create tomorrow's daily note")
        .setDesc("At the custom scheduled time, create tomorrow's note instead of today's.")
        .addToggle((toggle) => {
          toggle
            .setValue(settings.daily.createTomorrowsNote)
            .onChange(async (val) => {
              settings.daily.createTomorrowsNote = val;
              await this.plugin.updateSettings(settings);
            });
        });

      new Setting(advancedContainer)
        .setName('Unpin old daily notes')
        .setDesc('At the custom scheduled time, unpin old daily notes instead of closing them.')
        .addToggle((toggle) => {
          toggle
            .setValue(settings.daily.unpinOldDailyNotes)
            .onChange(async (val) => {
              settings.daily.unpinOldDailyNotes = val;
              await this.plugin.updateSettings(settings);
            });
        });
    }
  }
}
