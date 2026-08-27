## Why

The repository is currently a plain JS AEM EDS boilerplate (blocks/, scripts/, styles/ at the repo root) with no type checking, no bundler, and only minimal linting (ESLint on JS/JSON via `.eslintrc.js`, no Prettier, no pre-commit enforcement). As the block library grows, this leaves the project without compile-time safety, a scalable build pipeline for new blocks, or consistent code-quality gates. This change establishes the foundation repo: it migrates the runtime to TypeScript (strict) under `src/`, introduces a Vite-based build toolchain with automatic block-entry discovery, keeps the Universal Editor (UE) JSON model pipeline (`component-definition.json`, `component-models.json`, `component-filters.json`) working from the new source layout, and adds enforced code-quality tooling (ESLint, Prettier, Husky + lint-staged) so all of this can be relied on going forward.

## What Changes

- **BREAKING**: Move build-relevant sources into `src/` (`src/app/aem.ts`, `src/app/scripts.ts`, `src/styles/*.css`, `src/blocks/*`, `src/models/*`, `src/configs/`, `src/types/`, `src/utils/`), replacing the current root-level `scripts/aem.js`, `scripts/scripts.js`, `styles/*.css` as the source of truth. Existing root files remain only as build output/back-compat during migration; entry points and imports are updated to the new paths.
- Add `tsconfig.json` with strict mode enabled and a `@/*` path alias resolving to `src/*`.
- Add `vite.config.ts` (runtime build) and `vite.config-editor.ts` (Universal Editor build): both auto-discover block entry points via a `src/blocks/<name>/<name>.ts` glob — matching only the file whose name matches its parent block directory, so helper/utility `.ts` files living alongside a block (e.g. `turneo-proxy-test`'s API helpers) are treated as regular imported modules, not separate entries — split vendor chunks (e.g. `aem-core`, `three-core`), inject a version banner, and clean the output root before each build.
- Update `package.json` scripts: `start` (runs `tsc:watch`, `vite` dev/watch, and `aem up` together), `build` (type-check + Vite production build), `tsc:watch`, and keep `build:json` (JSON model merge) working against the new source layout.
- Keep the existing UE JSON pipeline intact: `merge-json-cli` merges `models/_component-*.json` fragments — which themselves spread-include the shared field-model fragments (`_button.json`, `_image.json`, `_page.json`, `_section.json`, `_text.json`, `_title.json`) and every block's own `_<name>.json` model file via a relative glob — into the three root JSON files. All of this moves under `src/models/` and `src/blocks/`, preserving their current sibling relationship so the existing relative include paths keep resolving unchanged.
- Add Prettier configuration and align ESLint with `typescript-eslint` + `eslint-plugin-xwalk` for `.ts` sources; keep JS/JSON/CSS linting for any remaining non-migrated files.
- Add Husky pre-commit hook wired to `lint-staged`, enforcing lint + format checks on staged files, and document the Conventional Commits requirement for commit messages.

## Capabilities

### New Capabilities

- `build-toolchain`: TypeScript + Vite build system for AEM EDS blocks, including automatic discovery of block entry points, dual runtime/editor build configs, vendor chunk splitting, version banner injection, and output-directory cleanup.
- `code-quality-tooling`: ESLint (TypeScript-aware, `eslint-plugin-xwalk`) + Prettier configuration, Husky pre-commit hook, and `lint-staged` enforcement gating commits on lint/format checks and Conventional Commits.
- `ue-json-pipeline`: the JSON model merge pipeline (`build:json` / `merge-json-cli`), covering the root fragment files, the shared field-model fragments they include, and the per-block model fragments each block contributes, all re-pointed at `src/models/` and `src/blocks/` while still emitting `component-definition.json`, `component-models.json`, and `component-filters.json` at the repo root with unchanged content shape.

### Modified Capabilities

<!-- none - no existing spec documents this behavior today -->

## Impact

- **Affected code**: `scripts/aem.js`, `scripts/scripts.js`, `scripts/delayed.js`, `styles/*.css`, all `blocks/*/*.js` plus each block's `_<name>.json` model fragment, `models/_component-*.json` root fragments, and `models/_button.json` / `_image.json` / `_page.json` / `_section.json` / `_text.json` / `_title.json` shared field fragments — all migrated/ported into `src/` with TypeScript types.
- **Build system**: New `vite.config.ts`, `vite.config-editor.ts`, `tsconfig.json`; `package.json` scripts (`start`, `build`, `tsc:watch`, `build:json`) rewritten.
- **Dependencies**: Adds `vite`, `typescript`, `typescript-eslint`, `prettier`, `lint-staged` (Husky already present) and related type packages; existing `eslint-plugin-xwalk`, `merge-json-cli`, `husky` retained.
- **Local dev workflow**: `npm run start` now runs `tsc:watch` + Vite watch + `aem up` concurrently instead of `aem up` alone.
- **CI/hooks**: Husky pre-commit hook now runs `lint-staged`, blocking commits that fail lint/format checks.
