# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin that automatically creates periodic notes (daily, weekly, monthly, quarterly, yearly) in the background and manages their tabs. The plugin integrates with the Periodic Notes plugin and uses the `obsidian-periodic-notes-provider` library for abstraction.

## Development Commands

**Build and Development:**
- `npm run dev` - Watch mode build using esbuild
- `npm run build` - Production build with TypeScript type checking
- `npm run test` - Run Jest tests
- `npm run coverage` - Run tests with coverage report
- `npm run test-ci` - CI-optimized test run with JUnit reporting

**Plugin Development Setup:**
Link the plugin to Obsidian for local development:
```bash
ln -s obsidian-auto-periodic-notes ~/.obsidian/plugins/
```

## Architecture

**Main Plugin Class:** `src/index.ts` - `AutoPeriodicNotes`
- Extends Obsidian's Plugin class
- Manages settings synchronization with Periodic Notes plugin
- Sets up user-configurable daily scheduled check with sleep/wake recovery
- Handles plugin lifecycle (onload, layout ready)

**Core Components:**
- **NotesProvider** (`src/notes/provider.ts`) - Main logic for creating and managing periodic notes
- **Settings** (`src/settings/`) - Configuration types and defaults for each periodicity
- **Settings Tab** (`src/settings/tab.ts`) - Obsidian settings UI integration

**Key Dependencies:**
- `obsidian-periodic-notes-provider` - Abstraction layer for Periodic Notes plugin compatibility
- Supports both current (v0.0.17) and beta (v1.0.0-beta3) versions of Periodic Notes

**Note Creation Logic:**
The plugin checks each note type (daily → weekly → monthly → quarterly → yearly) and:
1. Creates missing notes using templates from Periodic Notes plugin
2. Optionally opens and pins new notes in tabs
3. Can close existing older notes of the same type
4. Supports weekend exclusion for daily notes

**Settings Synchronization:**
The plugin listens for Periodic Notes plugin settings changes and automatically syncs availability flags for each note type.

## First Position Tab Feature Implementation

### Problem Solved
The "Open daily notes at first position" feature addresses the issue where newly created daily notes would open adjacent to the currently active tab instead of at the first position in the tab group.

### Obsidian Workspace Hierarchy
Understanding the correct workspace structure was crucial for proper implementation:

```
Workspace
├── rootSplit (WorkspaceRoot)
    ├── leftSplit (optional sidebar)
    ├── mainSplit (main content area)
    │   ├── TabGroup 1
    │   │   ├── Tab 1 (WorkspaceLeaf)
    │   │   ├── Tab 2 (WorkspaceLeaf)  ← Target insertion point (index 0)
    │   │   └── Tab 3 (WorkspaceLeaf)
    │   └── TabGroup 2 (if workspace is split)
    └── rightSplit (optional sidebar)
```

### Implementation Details

**Key Method: `insertChild(0, leaf)`**
- Operates at the correct TabGroup level (not rootSplit level)
- Directly inserts new leaf at index 0 without post-creation movement
- Avoids asynchronous timing issues with setTimeout approaches

**Algorithm:**
1. Get the active leaf and its parent TabGroup
2. Check if position 0 has an empty leaf that can be reused
3. If not, create new WorkspaceLeaf and use `insertChild(0, leaf)`
4. Open the note file in the positioned leaf

**Code Location:** `src/notes/provider.ts:112-146`

### Research Insights
The solution was derived from analyzing the [open-tab-settings plugin](https://github.com/jesse-r-s-hines/obsidian-open-tab-settings), which successfully implements various tab positioning strategies. Their approach using `insertChild()` method proved more reliable than:
- Using `createLeafInParent()` on rootSplit (wrong hierarchy level)
- Post-creation movement with `moveChild()` (timing issues)
- Relying on `getLeaf()` parameter variations (inconsistent behavior)

## Plugin Compatibility: Monkey-Around Pattern

### Problem: Conflicts with Other Plugins

When multiple Obsidian plugins need to modify the same core methods (monkey-patching), conflicts can arise if they use different patching approaches. This plugin initially had compatibility issues with the `open-tab-settings` plugin.

**Observed Issue:**
- Users reported that `open-tab-settings`'s "prevent duplicate tabs" feature stopped working when both plugins were enabled
- Clicking on an already-open file would create duplicate tabs instead of jumping to the existing tab

### Root Cause Analysis

**Monkey-Patching Conflict:**
1. **open-tab-settings** uses the `monkey-around` library to patch `Workspace.prototype.getLeaf` (prototype method)
2. **obsidian-auto-periodic-notes** originally replaced `workspace.getLeaf` directly (instance method)
3. Instance method assignments override prototype methods, causing the `open-tab-settings` patch to be completely bypassed

**Why This Matters:**
- When a method is assigned to an instance (`this.app.workspace.getLeaf = ...`), JavaScript looks up this instance property first
- The prototype chain is never consulted, so any `Workspace.prototype.getLeaf` patches are ignored
- This breaks cooperative patching between plugins

### Solution: Use monkey-around Library

**Implementation Changes:**
1. **Added Dependency:** Installed `monkey-around` as a dev dependency
2. **Refactored Patching:** Changed from direct method replacement to `around(Workspace.prototype, {...})`
3. **Proper Cleanup:** Used the cleanup function returned by `around()` for proper unpatching

**Code Location:** `src/index.ts:88-115`

**Key Implementation Pattern:**
```typescript
import { around } from 'monkey-around';

private setupWorkspacePatches(): void {
  const plugin = this;

  // Use monkey-around for cooperative patching
  this.monkeyPatchCleanup = around(Workspace.prototype, {
    getLeaf: (oldMethod) => {
      return function (this: Workspace, newLeaf?: any) {
        // Plugin-specific logic with flag check
        if (plugin.isDailyNoteCreation && plugin.settings.daily.openAtFirstPosition) {
          return plugin.createLeafAtFirstPosition();
        }

        // Call original method (allows other patches to run)
        return oldMethod.call(this, newLeaf);
      };
    }
  });

  // Register cleanup on plugin unload
  this.register(() => {
    if (this.monkeyPatchCleanup) {
      this.monkeyPatchCleanup();
    }
  });
}
```

### Benefits of monkey-around

1. **Cooperative Patching:** Multiple plugins can patch the same method without conflicts
2. **Proper Chaining:** Each patch calls the previous one, forming a chain
3. **Clean Unloading:** Patches can be removed in any order without breaking the chain
4. **De-duplication:** Built-in support for ensuring patches run only once

### Testing Compatibility

After implementing this fix:
- All existing tests continue to pass (34 passing tests as of December 2025)
- Compatible with `open-tab-settings` "prevent duplicate tabs" feature
- Both plugins can coexist and their features work as expected

### Best Practices for Obsidian Plugin Development

**When Patching Core Methods:**
- Always use `monkey-around` library for patching prototype methods
- Never directly assign to instance methods (`workspace.method = ...`)
- Always provide cleanup functions and register them with `this.register()`
- Use feature flags or conditions to control when your patch logic runs
- Test compatibility with popular plugins that might patch the same methods

## Testing

Uses Jest with jsdom environment for testing Obsidian plugin functionality. Mock implementations are in `src/__mocks__/obsidian.ts`.

## Build System

Uses esbuild for fast compilation with TypeScript support. The build process includes TypeScript type checking before bundling.

## Templater Integration

The plugin supports automatic processing of Templater templates in newly created notes via the `processTemplater` global setting.

**Implementation:** `src/templater.ts`
- Detects if Templater plugin is installed and enabled
- Only processes templates if Templater's `trigger_on_file_creation` is disabled (to avoid double-processing)
- Requires file to be active in editor for processing - temporarily opens/closes tab if needed
- Uses timeouts to ensure Templater API completes before cleanup

**Usage Pattern:**
```typescript
if (processTemplater) {
  await processTemplaterInFile(app, file, force);
}
```

## Note Creation Scheduling (Updated December 2025)

### Current Architecture (Simplified)

The plugin now uses a **single user-configurable scheduled time** instead of multiple fixed schedules. This simplification was implemented in December 2025 to improve reliability and user control.

### Trigger Logic Summary

#### Trigger Scenarios and Behavior

| Trigger | Condition | Method Called | Period Created | Context |
|---------|-----------|---------------|----------------|---------|
| **Startup** | Advanced scheduling disabled | `checkAndCreateNotes()` | Current | `startup` |
| **Startup** | Current time < scheduled time | `checkAndCreateNotes()` | Current | `startup` |
| **Startup** | Current time > scheduled time | `checkAndCreateNextPeriodNotes()` | Next | `scheduledTime` |
| **Scheduled Timer** | On-time (±5min tolerance) | `checkAndCreateNextPeriodNotes()` | Next | `scheduledTime` |
| **Sleep/Wake** | Current time < scheduled time | `checkAndCreateNotes()` | Current | `startup` |
| **Sleep/Wake** | Current time > scheduled time, not executed today | `checkAndCreateNextPeriodNotes()` | Next | `scheduledTime` |
| **Sleep/Wake** | Current time > scheduled time, already executed | - | Skip | - |

#### Period Calculation by Note Type

| Note Type | Current Period | Next Period |
|-----------|---------------|-------------|
| Daily | Today | Tomorrow (skip weekends if enabled) |
| Weekly | This week | Next week start (startOf week) |
| Monthly | This month | Next month 1st (startOf month) |
| Quarterly | This quarter | Next quarter start (startOf quarter) |
| Yearly | This year | Next year Jan 1 (startOf year) |

#### Special Handling

| Feature | Description |
|---------|-------------|
| **5-min Tolerance** | Timer checks if within ±5min of target; reschedules if exceeded |
| **Debounce** | Sleep/wake checks skip if last check was < 5 seconds ago |
| **Execution Record** | `lastExecutionDate` prevents duplicate daily execution |
| **Device Independence** | Each device has separate scheduled time and execution record |

**Scheduling Triggers:**

1. **Startup Check** - On plugin load (after layout ready)
   - Behavior depends on current time vs scheduled time:
     - **Before scheduled time**: Creates **current period** notes (today's daily note)
     - **After scheduled time**: Creates **next period** notes (tomorrow's daily note + unpin old)
   - Uses `executeStartupLogic()` to determine which path to take

2. **User-Configured Daily Check** - At user's specified time (e.g., 22:30)
   - Creates **next period** notes for all enabled types
   - Daily: Tomorrow's note (or next weekday if excludeWeekends enabled)
   - Weekly/Monthly/Quarterly/Yearly: Next period notes
   - Uses `checkAndCreateNextPeriodNotes(context: { scheduleName: 'scheduledTime' })`

3. **Sleep/Wake Recovery** - After missed scheduled time (via Visibility API)
   - Triggered when window becomes visible after scheduled time AND not executed today
   - Creates **next period** notes (same as scheduled task)
   - Uses `lastExecutionDate` to prevent duplicate execution

**Implementation:** `src/index.ts`
- `executeStartupLogic()` - Branches based on current time vs scheduled time
- `scheduleDailyCheck()` - Calculates delay until next scheduled time
- `executeCustomScheduledTask(isOnTime)` - Always creates next period notes
- `onWindowBecameVisible()` - Handles sleep/wake recovery
- Device-specific scheduled times via `os.hostname()` stored in `deviceSettings`

### Sleep/Wake Recovery Implementation

**Problem:** JavaScript `setTimeout` fails when system sleeps past the scheduled time.

**Solution:** Visibility API monitoring
- Listens to `document.visibilitychange` events
- When window becomes visible, checks if scheduled time was missed
- Executes missed tasks immediately if not already run today
- Uses `lastCustomScheduledExecutionDate` (YYYY-MM-DD) to prevent duplicates

**Code Location:** `src/index.ts:291-359`

**Tolerance Mechanism:**
- 5-minute tolerance window prevents false triggers after sleep
- If `setTimeout` fires >5min away from target time, reschedules instead of executing
- Prevents execution during sleep recovery when timer fires late

### Architecture Migration (December 2025)

**Removed:**
- ❌ `scheduleMainDailyCheck()` - Fixed 00:02 daily check
- ❌ `mainDailyCheck` from `scheduledTimeouts` and `CheckContext`
- ❌ 6 tests specific to 00:02 scheduling behavior

**Renamed:**
- `scheduleCustomScheduledTime()` → `scheduleDailyCheck()`
- `customScheduledTime` → `scheduledTime` (all references)
- Timeout key: `scheduledTimeouts.customScheduledTime` → `scheduledTimeouts.scheduledTime`

**Added:**
- ✅ `checkAndCreateNextPeriodNotes()` method in NotesProvider
- ✅ `nextPeriod` parameter in `checkAndCreateSingleNote()`
- ✅ `isOnTime` parameter in `executeCustomScheduledTask()`
- ✅ `lateExecution` schedule context type

**Modified:**
- `CheckContext` type: `'scheduledTime' | 'lateExecution' | 'startup'`
- `executeCustomScheduledTask()` now accepts `isOnTime` boolean
- `onWindowBecameVisible()` uses `scheduleDailyCheck()` naming

### Next Period Note Creation

**All Note Types (Daily/Weekly/Monthly/Quarterly/Yearly):**
- Fully implemented using `obsidian-daily-notes-interface`
- When `nextPeriod=true`: Creates next period note with appropriate date calculation
- Uses `createXXXNote(targetDate)` with calculated future date
- Helper functions: `getPeriodicNoteHelpers()`, `calculateNextPeriodDate()`, `getPeriodLabel()`

**Date Calculation:**
- Daily: `+1 day` (skip weekends if enabled)
- Weekly: `+1 week, startOf('week')`
- Monthly: `+1 month, startOf('month')`
- Quarterly: `+1 quarter, startOf('quarter')`
- Yearly: `+1 year, startOf('year')`

### Execution Flow Diagrams

**On-Time Execution (22:30, no sleep):**
```
scheduleDailyCheck()
  → setTimeout(22:30)
  → executeCustomScheduledTask(true)
  → checkAndCreateNextPeriodNotes()
  → All notes: next period
```

**Sleep Recovery (wake at 23:00, missed 22:30, not executed today):**
```
visibilitychange event
  → onWindowBecameVisible()
  → Check: currentTime > targetTime && lastExecutionDate !== today
  → executeCustomScheduledTask(false)
  → checkAndCreateNextPeriodNotes({ scheduleName: 'scheduledTime' })
  → All notes: next period
  → Unpin old daily notes (if enabled)
```

**Startup (before scheduled time, e.g., 15:00):**
```
onLayoutReady()
  → executeStartupLogic()
  → currentTime < scheduledTime
  → checkAndCreateNotes({ scheduleName: 'startup' })
  → All notes: current period
```

**Startup (after scheduled time, e.g., 23:00):**
```
onLayoutReady()
  → executeStartupLogic()
  → currentTime > scheduledTime
  → executeCustomScheduledTask()
  → checkAndCreateNextPeriodNotes({ scheduleName: 'scheduledTime' })
  → All notes: next period
  → Unpin old daily notes (if enabled)
```

### Device-Specific Settings

**Problem:** Multiple devices need different scheduled times (e.g., desktop at 22:30, laptop at 22:00)

**Solution:**
- Uses `os.hostname()` to identify device
- Stores per-device scheduled time in `settings.deviceSettings[deviceId].scheduledTime`
- Falls back to global `settings.daily.scheduledTime` if device-specific not set
- Syncs across devices via Obsidian Sync

**Methods:**
- `getDeviceId()` - Returns `os.hostname()`
- `getDeviceScheduledTime()` - Gets device-specific or global time
- `setDeviceScheduledTime(time)` - Sets device-specific time

**Code Location:** `src/index.ts:184-213`

### Key File Changes (December 2025)

#### `src/index.ts`

**Deleted Functions:**
- `scheduleMainDailyCheck()` (lines 215-241) - Removed fixed 00:02 daily check

**Property Changes:**
```typescript
// Before
private scheduledTimeouts: Record<string, number | null> = {
  mainDailyCheck: null,
  customScheduledTime: null
};

// After
private scheduledTimeouts: Record<string, number | null> = {
  scheduledTime: null
};
```

**Function Renames:**
- `scheduleCustomScheduledTime()` → `scheduleDailyCheck()`
- All debug log prefixes updated: `[customScheduledTime]` → `[scheduledTime]`

**Modified Functions:**
- `executeCustomScheduledTask(isOnTime: boolean = true)` - Now handles both on-time and late execution
- `onWindowBecameVisible()` - Updated to call `scheduleDailyCheck()` and use `executeCustomScheduledTask(false)` for late execution
- `scheduleDailyCheck()` - Updated to call `executeCustomScheduledTask(true)` for on-time execution
- `scheduleAllDailyChecks()` - Simplified to only call `scheduleDailyCheck()`

**Validation Improvements:**
- Added time format validation before parsing: `/^([01]\d|2[0-3]):([0-5]\d)$/`
- Prevents invalid time strings from bypassing the 00:02 conflict check
- Located in `scheduleDailyCheck()` (line 238-242)

#### `src/notes/provider.ts`

**New Method:**
```typescript
async checkAndCreateNextPeriodNotes(settings: ISettings, context?: CheckContext): Promise<void>
```
- Creates next period notes for all enabled types
- Passes `nextPeriod=true` to `checkAndCreateSingleNote()`
- Code location: lines 41-49

**Modified Method Signature:**
```typescript
// Before
private async checkAndCreateSingleNote(
  setting: IPeriodicitySettings,
  cls: Note,
  term: string,
  alwaysOpen: boolean,
  processTemplater: boolean,
  context?: CheckContext
): Promise<void>

// After
private async checkAndCreateSingleNote(
  setting: IPeriodicitySettings,
  cls: Note,
  term: string,
  alwaysOpen: boolean,
  processTemplater: boolean,
  context?: CheckContext,
  nextPeriod: boolean = false  // New parameter
): Promise<void>
```

**Daily Notes Next Period Logic:**
```typescript
// New logic in checkAndCreateSingleNote()
if (nextPeriod) {
  targetDate = targetDate.add(1, 'day');

  // Skip weekends if enabled
  if (dailySettings.excludeWeekends) {
    while (targetDate.format('dd') === 'Sa' || targetDate.format('dd') === 'Su') {
      targetDate = targetDate.add(1, 'day');
    }
  }

  debug(`Target date for next period: ${targetDate.format('YYYY-MM-DD')}`);
}
```
- Code location: lines 72-82

**Variable Renames:**
- `isCustomScheduledTime` → `isScheduledTime`
- `isMainDailyCheckOrStartup` → `isStartup`

**Comment Updates:**
- Removed references to `mainDailyCheck` in comments
- Added TODO comment about future period note limitation (lines 200-203)

#### `src/notes/provider.ts` - CheckContext Interface

**Before:**
```typescript
export interface CheckContext {
  scheduleName?: 'mainDailyCheck' | 'customScheduledTime' | 'startup';
}
```

**After:**
```typescript
export interface CheckContext {
  scheduleName?: 'scheduledTime' | 'startup';
}
```
- Code location: lines 12-14
- Note: `lateExecution` context removed; all scheduled/late executions now use `scheduledTime`

#### `src/__tests__/schedule.test.ts`

**Test Updates:**
- Renamed `scheduleMainDailyCheckPublic()` → `scheduleDailyCheckPublic()` in testable class
- Skipped 6 tests specific to mainDailyCheck behavior with `.skip()`
- Updated "performs immediate check on layout ready" test to enable advanced scheduling

**Skipped Tests (with TODO comments):**
1. "schedules next daily check for 00:02 the next day"
2. "schedules next daily check for 00:02 today if current time is before 00:02"
3. "triggers checkAndCreateNotes when scheduled time arrives"
4. "reschedules next check after running"
5. "clears timeout on plugin unload"
6. "handles multiple scheduleNextDailyCheck calls without creating duplicate timeouts"

**Updated Test:**
```typescript
it('performs immediate check on layout ready', async () => {
  // ... setup ...

  // Enable advanced scheduling for timer test
  freshPlugin.settings.daily.enableAdvancedScheduling = true;
  freshPlugin.settings.daily.available = true;

  // Set device-specific scheduled time
  const deviceId = freshPlugin.getDeviceId();
  if (!freshPlugin.settings.deviceSettings) {
    freshPlugin.settings.deviceSettings = {};
  }
  freshPlugin.settings.deviceSettings[deviceId] = { scheduledTime: '22:30' };

  // ... rest of test ...
});
```

**Test Status After Migration:**
- ✅ 34 tests passing
- ⏭️ 6 tests skipped
- ❌ 0 tests failing

#### `src/__tests__/notes/provider.test.ts`

**Test Name Update:**
```typescript
// Before
it('opens synced file via filesystem fallback when not in cache (customScheduledTime)', ...)

// After
it('opens synced file via filesystem fallback when not in cache (scheduledTime)', ...)
```

**Context Parameter Update:**
```typescript
// Before
await sutWithVault.checkAndCreateNotes(settings, { scheduleName: 'customScheduledTime' });

// After
await sutWithVault.checkAndCreateNotes(settings, { scheduleName: 'scheduledTime' });
```

### Breaking Changes

**None** - This is a refactoring that maintains backward compatibility:
- Existing settings are preserved and work as before
- The `createTomorrowsNote` setting is maintained for backward compatibility
- Users can continue using existing configurations

**Future Deprecation:**
- `createTomorrowsNote` setting is now redundant (behavior is default when `nextPeriod=true`)
- May be removed in a future major version

### Migration Notes for Developers

If extending or modifying the scheduling system:

1. **Always use `scheduledTime` context** - `mainDailyCheck` no longer exists
2. **Use `nextPeriod` parameter** - Instead of checking `createTomorrowsNote` setting
3. **Handle both execution modes** - On-time (next period) vs late (current period)
4. **Test with sleep/wake cycles** - Use Visibility API test scenarios
5. **Consider device-specific settings** - Use `getDeviceScheduledTime()` instead of direct settings access

### Performance Considerations

**Reduced Overhead:**
- Removed one daily `setTimeout` (mainDailyCheck)
- Single scheduling path instead of dual paths
- Cleaner timeout management with single entry in `scheduledTimeouts`

**Visibility API Overhead:**
- Negligible - Event listener only fires on visibility change
- Quick check when window becomes visible (< 1ms)
- No continuous polling or background timers

## Settings Architecture

**Two-Level Settings Structure:**

1. **Global Settings** (apply to all note types):
   - `alwaysOpen` - Always open notes when created (overrides per-note `openAndPin`)
   - `processTemplater` - Enable Templater integration
   - `debug` - Enable debug logging

2. **Per-Periodicity Settings** (daily, weekly, monthly, quarterly, yearly):
   - `available` - Synced from Periodic Notes plugin (read-only in UI)
   - `enabled` - User toggle for auto-creation
   - `closeExisting` - Close older notes of same type
   - `openAndPin` - Open and pin new notes in tabs
   - `excludeWeekends` - (Daily only) Skip weekend note creation
   - `openAtFirstPosition` - (Daily only) Open at first tab position

3. **Daily Advanced Scheduling Settings** (daily only):
   - `enableAdvancedScheduling` - Enable user-configurable scheduled time
   - `createTomorrowsNote` - (Legacy) Create tomorrow's note at scheduled time
   - `unpinOldDailyNotes` - Unpin old daily notes instead of closing them

4. **Device-Specific Settings**:
   - `deviceSettings[deviceId].scheduledTime` - Per-device scheduled time (e.g., "22:30")
   - Falls back to `daily.scheduledTime` if not set for current device
   - Syncs across devices via Obsidian Sync while maintaining device independence

**Settings Synchronization:**
The plugin listens for `PERIODIC_NOTES_EVENT_SETTING_UPDATED` events from Periodic Notes plugin and automatically updates the `available` flags to match which note types are configured.

**Default Settings Application:**
`applyDefaultSettings()` performs deep merge to ensure newly added settings fields get default values when loading saved settings from older plugin versions.

## Debug Mode

Enable debug logging by toggling the "Debug" setting in the settings tab. Debug output uses the `debug()` function from `src/log.ts` and logs to console with `[Auto Periodic Notes]` prefix.

**Common Debug Scenarios:**
- Tracking note creation flow
- Verifying monkey patch behavior
- Monitoring settings synchronization
- Troubleshooting Templater integration
- Debugging scheduled time execution and sleep/wake recovery
- Checking device-specific scheduled time resolution

## Development Workflow

**Local Plugin Testing:**
1. Symlink plugin to Obsidian plugins directory:
   ```bash
   ln -s $(pwd) ~/.obsidian/plugins/auto-periodic-notes
   ```
2. Run `npm run dev` to watch for changes
3. After each rebuild, toggle plugin off/on in Obsidian to reload
4. Enable Debug mode in settings for detailed logging

**Running Single Test:**
```bash
npm test -- src/__tests__/notes/provider.test.ts
```

**Version Bumping:**
```bash
npm run version
```
This updates both `manifest.json` and `versions.json` together.

## Coding Conventions

- Use 2-space indentation
- Prefer `camelCase` for functions/variables, `PascalCase` for classes
- Use `debug()` helper from `src/log.ts` instead of `console.log`
- Keep imports sorted: core APIs, third-party packages, local modules
- Place test files in `src/__tests__/` with `.test.ts` suffix
- Mock Obsidian APIs using `src/__mocks__/obsidian.ts`

## Pull Request Guidelines

Before submitting a PR:
1. Run `npm run build` and `npm run test` to ensure all checks pass
2. Link related issues in PR description
3. Include screenshots for UI changes
4. Document any changes to default automation behavior
5. Ensure all existing tests pass (currently 34 passing tests)