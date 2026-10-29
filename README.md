# Automatic Periodic Notes for Obsidian

Creates new periodic notes automatically in the background and allows these to be pinned in your open tabs; supports daily, weekly, monthly, quarterly and yearly notes.

Designed to work with [Obsidian](https://obsidian.md), requires the [Periodic Notes](https://github.com/liamcain/obsidian-periodic-notes) plugin.

_Note: this now supports the current (**v0.0.17**) and newer Beta (**v1.0.0-beta3**) versions of Periodic Notes available via [BRAT](https://tfthacker.com/BRAT). This functionality is provided through a [abstract provider](https://github.com/jamiefdhurst/obsidian-periodic-notes-provider) for the required plugin._

This plugin respects the settings of the Periodic Notes plugin, creating your notes using the templates, format and location you have selected.

## Features

![Example of notice in Obsidian, showing creation of today's daily note](/docs/notice-example.png)

- Creates new notes in the background for your periodic notes
- Supports daily, weekly, monthly, quarterly and yearly notes with individual settings for each
- Supports opening and pinning the new notes automatically when created
- Supports automatically closing older notes
- Can exclude weekends from daily note generation

## Settings

![Example of Settings screen within Obsidian](/docs/settings.png)

Automatic creation can be toggled on and off for each of the supported note types, these are only shown if you have enabled and configured these notes within the Periodic Notes plugin. Within each note type, you can set whether to open and pin the note automatically, or whether to simply create it in the background, showing a notice when complete.

### Creating notes on one device only

Notes are created only on devices where **Create notes on this device** is turned on. It is off by default, so a vault synced across several devices (for example with Obsidian Sync) gets each note from a single device instead of duplicate or conflicting copies. Devices with it off still open, pin, close, and unpin notes at startup, on wake, and at the custom scheduled time, but only for notes that already exist; when the daily note they are waiting for arrives later by sync, they handle it as soon as it appears.

This switch and the record of the last scheduled run are stored in the device's local storage and are never synced. The custom scheduled time is synced and is a UTC time, so every device acts at the same instant whatever its time zone; while it is set, the date of the daily note follows UTC as well, so devices in different time zones always pin the same note. The settings tab shows what the UTC time is on each device's clock. For example, 14:00 UTC is 22:00 in Shanghai: before then the note is today's (in Shanghai), and from then on it is tomorrow's. Turn the switch on only on the one device that should create notes.

## Development

This plugin has been developed using Typescript with the Obsidian and Periodic Notes APIs and Jest for testing.

Once you've cloned the repository, to speed up plugin development it is recommended to symlink the location of the plugin directly into your local Obsidian:

```bash
ln -s obsidian-auto-periodic-notes ~/.obsidian/plugins/
```

You can then run the plugin build automatically to pick up any changes:

```bash
npm run dev
```

To test the plugin using just, you can run it with or without coverage:

```bash
npm run test
npm run coverage
```

When submitting a PR, the plugin will be automatically tested, and when merged into main this will be built and released using GitHub Actions.

## Thanks

Many thanks to [Liam Cain](https://liamca.in/hello) for the awesome work on the Periodic Notes plugin!
