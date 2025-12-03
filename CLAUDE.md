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
- Sets up 5-minute interval timer for note checking
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
- All 23 existing tests continue to pass
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

## Note Creation Scheduling

The plugin runs note checks on two triggers:

1. **Immediate Check:** On plugin load (after layout ready)
2. **Daily Scheduled Check:** At 00:02 (2 minutes after midnight) each day

**Implementation:** `src/index.ts:166-183`
- Uses `scheduleNextDailyCheck()` to calculate time until next midnight
- Cleans up timeout on plugin unload to prevent memory leaks
- Runs full check cycle for all note types on each trigger

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
5. Ensure all 23+ existing tests pass