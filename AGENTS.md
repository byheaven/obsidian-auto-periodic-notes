# Repository Guidelines

## Project Structure & Module Organization
The plugin entry point lives in `src/index.ts`, orchestrating event helpers in `src/events.ts` and note logic under `src/notes/`. Settings UI code sits in `src/settings/`, while reusable mocks and Jest suites are under `src/__mocks__/` and `src/__tests__/`. Build artefacts land in `main.js` via `esbuild.config.mjs`. Plugin metadata resides in `manifest.json` and release tags in `versions.json`. Design assets referenced by the README are in `docs/`.

## Build, Test, and Development Commands
`npm run dev` bundles the plugin in watch mode; keep it running while editing TS files. `npm run build` enforces TypeScript checks (`tsc -noEmit`) and produces a production bundle. `npm run test` executes the Jest suite, while `npm run coverage` adds Istanbul reports. CI mirrors `npm run test-ci` when validating PRs. Use `npm run version` to bump `manifest.json` and `versions.json` together.

## Coding Style & Naming Conventions
Write TypeScript with 2-space indentation and strict null checks in mind (see `tsconfig.json`). Prefer `camelCase` for functions and variables, `PascalCase` for classes, and keep modules focused on a single responsibility. Use the `debug` helper in `src/log.ts` for diagnostic output instead of `console.log`. Keep imports sorted logically: core APIs, third-party packages, local modules.

## Testing Guidelines
Place spec files alongside subjects using the `.test.ts` suffix within `src/__tests__`. Stub Obsidian APIs with the mocks under `src/__mocks__`. New features should extend coverage for note creation flows and settings toggles; fail fast by running `npm run test` before pushing, and include coverage reports when refactoring formatters.

## Commit & Pull Request Guidelines
Commit messages follow an imperative voice, e.g., `git commit -m "Fix tab pinning race"`; use `[skip ci]` only for version bumps. Before opening a PR, run `npm run build` and `npm run test`, link related issues, and describe user impact or screenshots for UI-affecting changes. Call out Obsidian configuration steps so reviewers can reproduce behaviour locally. Finally, attach release notes if the change alters default automation behaviour.

## Obsidian Setup Tips
For local testing, symlink the plugin into your vault (`ln -s $(pwd) ~/.obsidian/plugins/auto-periodic-notes`), then reload Obsidian. After each `npm run dev` rebuild, toggle the plugin off/on to pick up changes, and keep vault paths aligned with the Periodic Notes configuration.
