## Purpose

Provides a TypeScript + Vite build system that compiles the AEM EDS block library with strict type checking, discovers new block entry points automatically, and produces both a runtime bundle and a Universal Editor bundle without manual configuration edits per block.

## Requirements

### Requirement: Strict TypeScript compilation
The system SHALL type-check all sources under `src/` using a strict `tsconfig.json` (strict mode enabled) with a `@/*` path alias resolving to `src/*`, and SHALL fail the build when type errors are present.

#### Scenario: Type error blocks build
- **WHEN** a source file under `src/` contains a type error
- **THEN** `npm run build` SHALL exit with a non-zero status and SHALL NOT produce a production bundle

#### Scenario: Path alias resolves correctly
- **WHEN** a source file imports a module using the `@/` alias (e.g. `@/utils/foo`)
- **THEN** both the TypeScript compiler and the Vite build SHALL resolve the import to `src/foo` without error

### Requirement: Automatic block entry discovery
The system SHALL automatically discover Vite build entry points by globbing `src/blocks/<name>/<name>.ts` (the file whose name matches its parent block directory), so that adding a new block source file does not require editing `vite.config.ts` or `vite.config-editor.ts`. Other `.ts` files inside a block directory SHALL NOT be treated as independent entries.

#### Scenario: New block is added without config changes
- **WHEN** a new file is added at `src/blocks/<new-block>/<new-block>.ts` and no other build config file is modified
- **THEN** running `npm run build` SHALL produce a corresponding output bundle for `<new-block>`

#### Scenario: Non-entry helper file inside a block is not built as a separate bundle
- **WHEN** a block directory contains a helper file such as `src/blocks/<name>/<name>-api.ts` that is imported by `src/blocks/<name>/<name>.ts`
- **THEN** running `npm run build` SHALL NOT emit a standalone output bundle for the helper file

### Requirement: Dual runtime and editor build configurations
The system SHALL provide two Vite build configurations — a runtime configuration and a Universal Editor configuration — both consuming the same auto-discovered block entry points, each producing output consistent with AEM EDS delivery conventions.

#### Scenario: Runtime build succeeds
- **WHEN** `npm run build` is executed
- **THEN** the runtime Vite configuration SHALL complete successfully and emit block bundles usable by the EDS runtime loading sequence

#### Scenario: Editor build succeeds
- **WHEN** the Universal Editor build configuration is executed
- **THEN** it SHALL complete successfully and emit bundles usable by the Universal Editor authoring environment

### Requirement: Vendor chunk splitting
The build SHALL split shared third-party dependencies into named vendor chunks (e.g. `aem-core`, `three-core`) separate from per-block bundles.

#### Scenario: Shared dependency is isolated into a vendor chunk
- **WHEN** two or more blocks import the same third-party dependency
- **THEN** the production build output SHALL contain that dependency once, in a vendor chunk, rather than duplicated in each block bundle

### Requirement: Version banner injection
Each production build output file SHALL include a version banner comment identifying the build (e.g. version/timestamp) at the top of the emitted file.

#### Scenario: Banner present in build output
- **WHEN** `npm run build` completes
- **THEN** each emitted JS bundle SHALL start with a comment header containing version information

### Requirement: Clean output before build
The system SHALL remove previous build output from the output root before each new build, so stale files from removed blocks are not retained.

#### Scenario: Removed block does not persist in output
- **WHEN** a block source directory under `src/blocks/` is deleted and `npm run build` is run again
- **THEN** the previous build output for that block SHALL NOT be present after the build completes

### Requirement: Combined local development workflow
The system SHALL provide an `npm run start` command that runs TypeScript watch compilation, Vite watch/dev build, and the AEM local development server (`aem up`) together, so that source edits are reflected without manual rebuild steps.

#### Scenario: Local dev server reflects source changes
- **WHEN** `npm run start` is running and a file under `src/` is saved
- **THEN** the corresponding build output SHALL be regenerated automatically without requiring the user to re-run a build command

### Requirement: Preserved three-phase loading order
The migrated runtime SHALL preserve the existing AEM EDS three-phase page loading sequence (eager, then lazy, then delayed), with no phase executing out of order.

#### Scenario: Page loads through all three phases without console errors
- **WHEN** a page is loaded against the local `aem up` environment built from `src/`
- **THEN** eager-phase logic SHALL execute first, lazy-phase logic SHALL execute after eager completes, delayed-phase logic SHALL execute last, and the browser console SHALL show no errors originating from the build output
