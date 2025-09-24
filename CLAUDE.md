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

## Testing

Uses Jest with jsdom environment for testing Obsidian plugin functionality. Mock implementations are in `src/__mocks__/obsidian.ts`.

## Build System

Uses esbuild for fast compilation with TypeScript support. The build process includes TypeScript type checking before bundling.