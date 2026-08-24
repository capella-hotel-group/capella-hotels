## 1. Toolchain scaffolding

- [x] 1.1 Add `tsconfig.json` with strict mode enabled and `@/*` path alias to `src/*`; verify `npx tsc --noEmit` runs (no source files yet, so it should complete with no errors)
- [x] 1.2 Add `vite.config.ts` with block-entry discovery via a `src/blocks/<name>/<name>.ts` glob (entry file name must match its parent block directory; other `.ts` files in the folder are not treated as entries), vendor chunk splitting (`aem-core`, `three-core`), version banner injection, and pre-build output cleanup; verify it loads without error via `npx vite build --config vite.config.ts` against an empty `src/blocks/`
- [x] 1.3 Add `vite.config-editor.ts` for the Universal Editor build, sharing the entry-discovery and alias logic with `vite.config.ts`; verify it loads without error via `npx vite build --config vite.config-editor.ts`
- [x] 1.4 Add `typescript`, `vite`, and related type packages as devDependencies in `package.json`; verify `npm install` completes without errors

## 2. Runtime and script migration

- [x] 2.1 Create `src/app/aem.ts` ported from `scripts/aem.js` with type annotations; verify `npx tsc --noEmit` passes for this file
- [x] 2.2 Create `src/app/scripts.ts` ported from `scripts/scripts.js`, preserving eager/lazy/delayed phase boundaries exactly; verify `npx tsc --noEmit` passes
- [x] 2.3 Port `scripts/delayed.js` logic into the delayed phase of `src/app/scripts.ts` (or a co-located `src/app/delayed.ts` invoked from the delayed phase); verify phase ordering is unchanged by reading the ported code against the original three-phase structure
- [x] 2.4 Build with `npm run build` (once scripts exist) and load the site via `aem up`; verify the browser console shows the eager, then lazy, then delayed phases executing in order with no console errors

## 3. Styles migration

- [x] 3.1 Move `styles/styles.css`, `styles/lazy-styles.css`, `styles/fonts.css` into `src/styles/` unchanged; verify Vite build copies them to the expected root `styles/` output paths
- [x] 3.2 Verify a page loaded via `aem up` renders with the same styling as before the move (visual spot check of header, hero, and one content block)

## 4. Block migration

- [x] 4.1 For each existing block under `blocks/<name>/` (e.g. `cards`, `columns`, `hero`, `header`, `footer`, etc.), create `src/blocks/<name>/<name>.ts` ported from `<name>.js` with type annotations, and move the block's CSS and its `_<name>.json` model fragment alongside it as one unit; verify each block builds via `npm run build` and its output bundle is emitted without editing `vite.config.ts`
- [x] 4.2 For blocks with additional helper `.js` files beyond the main entry (e.g. `turneo-proxy-test`'s `turneo-api.js`, `turneo-appbuilder-api.js`, `turneo-proxy-api.js`), port them to `.ts` and import them from the block's entry file; verify the build does NOT emit separate output bundles for the helper files
- [x] 4.3 Verify each migrated block renders and behaves correctly on a local `aem up` page containing that block, with no console errors
- [x] 4.4 Remove the corresponding legacy root-level `blocks/<name>/<name>.js` source file once its `src/` counterpart is verified working, keeping only the build output at that path

## 5. Add new block without config edits (verification)

- [x] 5.1 Add a temporary test block at `src/blocks/foundation-smoke-test/foundation-smoke-test.ts` without editing `vite.config.ts` or `vite.config-editor.ts`; verify `npm run build` produces its output bundle automatically, then remove the temporary block

## 6. Universal Editor JSON pipeline

- [x] 6.1 Move `models/_component-definition.json`, `models/_component-models.json`, `models/_component-filters.json` and the shared field fragments `_button.json`, `_image.json`, `_page.json`, `_section.json`, `_text.json`, `_title.json` into `src/models/`, keeping `src/models/` and `src/blocks/` as siblings (mirroring today's `models/`/`blocks/` relationship) so their relative and glob-based include paths keep resolving unchanged; verify their content is unchanged from the pre-move versions
- [x] 6.2 Update the `build:json:*` scripts in `package.json` to read fragments from `src/models/`; verify `npm run build:json` produces `component-definition.json`, `component-models.json`, and `component-filters.json` at the repo root
- [x] 6.3 Diff the newly generated root JSON files against the pre-migration versions; verify they are equivalent in content/shape
- [x] 6.4 Edit a fragment under `src/models/` and re-run `npm run build:json`; verify the edit is reflected in the corresponding root JSON file
- [x] 6.5 Introduce an intentionally invalid fragment JSON file temporarily and run `npm run build:json`; verify the command exits non-zero and the previously valid root JSON file is not overwritten, then revert the invalid fragment

## 7. package.json scripts

- [x] 7.1 Add `tsc:watch` script (`tsc --watch --noEmit` or equivalent); verify it starts and reports zero errors against the migrated source
- [x] 7.2 Update `build` script to run type-checking followed by the Vite production build (runtime + editor); verify `npm run build` completes successfully end-to-end
- [x] 7.3 Add `start` script that runs `tsc:watch`, Vite watch/dev, and `aem up` concurrently (e.g. via `npm-run-all -p` or `concurrently`); verify `npm run start` brings up a working local dev environment and a saved change under `src/` is reflected without a manual rebuild
- [x] 7.4 Remove now-superseded legacy scripts from `package.json` that duplicate the new toolchain; verify `npm run lint`, `npm run build`, `npm run build:json`, and `npm run start` are the canonical entry points

## 8. Code quality tooling

- [ ] 8.1 Add `typescript-eslint` and configure ESLint to lint `.ts` sources alongside the existing `eslint-plugin-xwalk` rules; verify `npm run lint` passes on the migrated codebase and fails when a rule is intentionally violated (then revert the violation)
- [ ] 8.2 Add Prettier configuration and a `format:check` script; verify `npm run format:check` passes on the migrated codebase and fails on an intentionally misformatted file (then revert)
- [ ] 8.3 Add `lint-staged` configuration scoping lint/format checks to staged files; verify `npx lint-staged` runs successfully against a staged change
- [ ] 8.4 Update the Husky pre-commit hook to run `lint-staged`; verify a commit with a failing staged file is blocked, and a commit with passing staged files succeeds
- [ ] 8.5 Document the Conventional Commits requirement in `CONTRIBUTING.md`; verify the section is present and describes the expected commit message format

## 9. Final verification

- [ ] 9.1 Run `npm run start` and confirm `tsc:watch`, Vite watch, and `aem up` all start successfully together
- [ ] 9.2 Run `npm run build` from a clean checkout and confirm it succeeds with output matching AEM EDS delivery conventions (`scripts/`, `styles/`, `blocks/*` populated at the repo root)
- [ ] 9.3 Run `npm run build:json`, `npm run lint`, and `npm run format:check` and confirm all three exit with status zero
- [ ] 9.4 Make a trivial staged edit and attempt a commit to confirm the Husky pre-commit hook runs `lint-staged` without errors
- [ ] 9.5 Load the local site end-to-end via `aem up` and confirm the eager/lazy/delayed loading order holds with no console errors
