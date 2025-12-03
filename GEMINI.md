# Obsidian Auto Periodic Notes

## Project Overview
This project is an Obsidian plugin that automatically creates periodic notes (daily, weekly, monthly, quarterly, yearly) in the background. It integrates with the **Periodic Notes** plugin and uses the `obsidian-periodic-notes-provider` library to abstract compatibility with different versions of that plugin.

**Key Features:**
- Automatic background creation of periodic notes.
- Configurable behavior for opening and pinning new notes.
- Option to close existing older notes of the same type.
- "Open at first position" logic for daily notes.
- Integration with the **Templater** plugin for advanced templates.
- Robust compatibility handling (e.g., using `monkey-around` for workspace patching).

## Architecture & Key Files

*   **`src/index.ts`**: The main plugin entry point (`AutoPeriodicNotes` class). Handles lifecycle (onload, onunload), settings synchronization, and the daily check scheduler (runs at 00:02).
*   **`src/notes/provider.ts`**: Contains the core logic for creating and managing notes. Implements the `insertChild(0, leaf)` logic for correct tab positioning.
*   **`src/settings/`**:
    *   `index.ts`: Defines setting types and default values.
    *   `tab.ts`: Implements the Obsidian settings UI (`AutoPeriodicNotesSettingsTab`).
*   **`src/templater.ts`**: Handles the integration with the Templater plugin, ensuring templates are processed correctly on new note creation.
*   **`src/events.ts`**: Event helper functions.
*   **`src/log.ts`**: centralized logging utility (`debug()`).

## Building and Running

**Prerequisites:** Node.js and npm.

*   **Development Build (Watch Mode):**
    ```bash
    npm run dev
    ```
    This runs `esbuild` in watch mode.

*   **Production Build:**
    ```bash
    npm run build
    ```
    Runs TypeScript type checking (`tsc`) and then a production build with `esbuild`.

*   **Running Tests:**
    ```bash
    npm test
    ```
    Runs the Jest test suite.

*   **Test Coverage:**
    ```bash
    npm run coverage
    ```

**Local Development Setup:**
To test in Obsidian, symlink the project directory to your vault's plugins folder:
```bash
ln -s /path/to/obsidian-auto-periodic-notes <path-to-vault>/.obsidian/plugins/obsidian-auto-periodic-notes
```
After building, you must **toggle the plugin off and on** in Obsidian settings to reload the code.

## Development Conventions

*   **Language:** TypeScript.
*   **Style:** 2-space indentation. Prefer `camelCase` for functions/variables, `PascalCase` for classes.
*   **Logging:** Use the `debug()` function from `src/log.ts` instead of `console.log`.
*   **Testing:**
    *   Uses `jest` with `ts-jest` and `jest-environment-jsdom`.
    *   Mocks for the Obsidian API are located in `src/__mocks__/obsidian.ts`.
    *   Tests are located in `src/__tests__/`.
*   **Patching:**
    *   **CRITICAL:** When patching core Obsidian methods (like `Workspace.prototype.getLeaf`), **ALWAYS** use the `monkey-around` library.
    *   Do **NOT** directly assign to instance methods (e.g., `this.app.workspace.getLeaf = ...`) as this breaks compatibility with other plugins.
    *   Refer to `src/index.ts` for the correct implementation using `around()`.

## Key Logic Details

*   **Tab Positioning:** The "Open daily notes at first position" feature uses `insertChild(0, leaf)` on the parent `TabGroup`. This is more reliable than `createLeafInParent` or `moveChild`.
*   **Templater Integration:** Logic in `src/templater.ts` ensures that if Templater is enabled, it is triggered for the new file. It checks `trigger_on_file_creation` to avoid double-processing.
*   **Scheduling:** The plugin schedules a check for new notes immediately on load and then sets a timer for 2 minutes after midnight (`00:02`) each day.
