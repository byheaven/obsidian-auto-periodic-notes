# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-01-01

### Added

- feat: support automated git commits at 6pm daily (b038e5d)
- (9c92f37)

## [0.5.0] - 2026-01-01

### Added

- feat: split open and pin setting into separate entries (ee396d3)
- (8980e96)

### Other

- chore: update deps and add better build support (3b9f0cb)
- (1461d9e)
- chore: bump ncipollo/release-action from 1.12.0 to 1.20.0 (62683e0)
- (7335805)
- chore: bump im-open/code-coverage-report-generator (bfb7889)
- (767c7e5)
- chore(deps-dev): bump the typescript-eslint group with 2 updates (4c3d5f6)
- (2c8fc4e)
- chore(deps-dev): bump the jest group with 2 updates (85065d4)
- (fd5e260)
- chore(deps-dev): bump builtin-modules from 4.0.0 to 5.0.0 (243d84a)
- (284da9c)
- chore(deps-dev): bump the typescript-eslint group with 2 updates (9ca6e60)
- (c5779b2)
- chore: fix dependabot label (a16a767)
- chore: ensure build is checked when pushing branches and opening PRs (ea87a39)
- [skip ci] Update version to v0.5.0 (8b58cfb)

## [0.4.0] - 2025-11-01

### Added

- Add Templater integration utility (11b326f)
- Add App mock to Obsidian test mocks (c4d729b)
- Add tests for Templater integration (4fc3603)
- Add setting for Templater processing and improve implementation (63b6084)
- (d61b9f6)

### Changed

- Update tests for Templater integration changes (6244e71)

### Other

- Integrate Templater processing into note creation (a420941)
- [skip ci] Update version to v0.4.0 (0b65ac6)

## [0.3.2] - 2025-07-19

### Fixed

- Fix notes provider to check all leaves, not just root (814391d)
- (45e27fd)

### Other

- [skip ci] Update version to v0.3.2 (7d8ab04)

## [0.3.1] - 2025-07-19

### Fixed

- Fix tab pin logic by using the same workspace leaf (e4fc6fa)
- (431296c)

### Other

- [skip ci] Update version to v0.3.1 (226aa65)

## [0.3.0] - 2025-07-14

### Changed

- Update to use obsidian-periodic-notes-provider (2565515)
- (a022344)

### Other

- Reduce coverage threshold, will fix later (3c46655)
- [skip ci] Update version to v0.3.0 (02b33f7)

## [0.2.3] - 2025-01-19

### Added

- Adding in debugging to make it easier to trace issues in inter-plugin operation (abfb1ad)
- (6f502cc)

### Other

- [skip ci] Update version to v0.2.3 (25a7eb8)

## [0.2.2] - 2025-01-18

### Other

- Support opening notes even when a new one has not been explicitly created (50b4c84)
- (821ad03)
- [skip ci] Update version to v0.2.2 (e17fb8b)

## [0.2.1] - 2025-01-18

### Other

- Support excluding weekends from daily note generation (b9f3a1c)
- (1f402a5)
- [skip ci] Update version to v0.2.1 (bfdb8e4)

## [0.2.0] - 2025-01-12

### Other

- Remove version prefix tag which should fix build issue (0918496)
- Support closing existing tabs when creating new notes (ee36743)
- (be4ac07)
- [skip ci] Update version to v0.2.0 (718f4c1)

## [0.1.0] - 2024-09-14

### Fixed

- Fix issue with creating manifest file and with interval not working (9b9677e)
- (74fc115)

### Other

- Use Obsidian moment and settings API and remove svelte (16908f2)
- Use Obsidian moment and settings API and remove svelte (e4e50ea)
- [skip ci] Update version to v0.1.0 (0a96da2)
- [skip ci] Update version to v0.1.0 (f450a03)
- Reset version (375a3ac)
- [skip ci] Update version to v0.1.0 (8018f02)

## [0.0.1] - 2024-09-10

### Added

- (e08b6f3)
- Add milestone for main functionality in GH (f938132)
- Add tests and GitHub workflow (dc04e6f)
- Add cobertura coverage correctly (c212a67)
- Added as many tests as possible without touching Svelte (3d25b74)
- (071299e)
- Add README and LICENSE (aeaaeb8)
- Add build workflow (f576b03)

### Changed

- Update description in settings (649af28)

### Fixed

- Fix tests from Obsidian plugin review (a98f3f0)
- (07a1679)

### Other

- Initial commit with README and settings (5248245)
- Basic plugin with everythig stripped, copied from sample-plugin (14f63c4)
- Basic plugin working with correct manifest (cb6e169)
- Settings tab working and reading Periodic Notes settings for support (cfbc542)
- Remove jest coverage threshold, deal with it at CI (fa03140)
- Cache the node dependencies (ed78e10)
- (87b7b33)
- Note creation functionality working (7582e74)
- (040753d)
- Open and pin support (a15cff6)
- (2b81554)
- Ensure status is protected for main on Test check (e290c84)
- Continue on error to ignore the latest version failing (d21f513)
- Still needs to calculate version (0e9111a)
- Remove logs to tidy up codebase (78335c5)
- (1dcd406)
- Remove 'v' from release and tag (674e70a)
- Only run build workflow when actual code changes (f02b2e3)
- Close the initial milestone (7c4510b)
- Always sync periodic notes settings on load (341edc7)
