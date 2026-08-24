## Context

See [proposal.md](proposal.md) - Why. Today `blocks/`, `scripts/`, `styles/`, `models/` live at the repo root as plain JS/CSS/JSON with no bundler and no type checking; `package.json` only runs `eslint`, `stylelint`, and `merge-json-cli` directly. This design covers moving that source into `src/`, introducing a Vite + TypeScript build, and wiring code-quality gates, while keeping the AEM EDS three-phase loading contract and the UE JSON pipeline's root output files unchanged from the outside.

## Goals / Non-Goals

**Goals:**
- Single source of truth under `src/`, compiled by Vite into the existing AEM EDS root-level delivery layout (`scripts/`, `styles/`, block folders as build output).
- Zero manual config edits when adding a new block (`src/blocks/<name>/<name>.ts`).
- Keep `component-definition.json`, `component-models.json`, `component-filters.json` byte-shape-compatible with today's merge output.
- Pre-commit enforcement that is fast enough not to disrupt normal commit flow (lint-staged scoped to staged files only).

**Non-Goals:**
- Rewriting block business logic or visual behavior - this is a toolchain/type migration, not a feature change.
- Migrating away from `aem up` / Adobe Helix CLI for local dev.
- Introducing a test runner or test suite (out of scope for this change).
- Changing the UE JSON output *content*, only its build source location.

## Decisions

**Vite over webpack/esbuild-direct**: Vite's native glob-based `import.meta.glob`-style entry discovery and dev server fit the "auto-discover blocks" requirement with minimal config, and it has first-class TS support without a separate loader chain. Alternative considered: raw esbuild scripts - rejected because it would require hand-rolling watch/dev-server and multi-entry orchestration that Vite provides out of the box.

**Two separate Vite configs (`vite.config.ts` / `vite.config-editor.ts`) instead of one config with a mode flag**: Runtime and Universal Editor builds have different output targets and, in practice, different chunking/externalization needs (UE loads blocks in an authoring iframe context). Keeping them as separate config files keeps each simpler than a single config branching heavily on `mode`. Alternative considered: one config gated by `--mode editor` - rejected because block-entry discovery and vendor-chunk rules would need conditional logic in every section.

**Entry discovery via filesystem glob (`src/blocks/<name>/<name>.ts`, not `src/blocks/*/*.ts`) computed at config-load time**: Matching only the file whose name equals its parent directory avoids treating every `.ts` file in a block folder as an independent Vite entry. This matters because at least one existing block (`turneo-proxy-test`) ships helper modules (`turneo-api.js`, `turneo-appbuilder-api.js`, `turneo-proxy-api.js`) alongside its real entry (`turneo-proxy-test.js`) - those must remain plain imported modules, not separate bundle outputs. Alternative considered: a manifest file listing blocks - rejected because it reintroduces the manual registration step this change is meant to remove.

**`src/models/` as the fragment source for `build:json`, keeping `merge-json-cli`, and preserving `src/models/` + `src/blocks/` as siblings**: The root fragments (`_component-definition.json`, `_component-models.json`, `_component-filters.json`) use `merge-json-cli`'s `"...": "./_x.json#/..."` spread syntax to pull in shared field fragments (`_button.json`, `_image.json`, `_page.json`, `_section.json`, `_text.json`, `_title.json`) and a relative glob (`../blocks/*/_*.json`) that auto-includes every block's own `_<name>.json` model file. Keeping `src/models/` and `src/blocks/` in the same relative position as today's `models/` and `blocks/` means these existing relative paths keep resolving with no rewrite. Alternative considered: rewriting the includes to absolute/aliased paths - rejected as unnecessary since `merge-json-cli` only supports relative/glob paths and the sibling layout already satisfies the requirement.

**Husky + lint-staged for pre-commit, Prettier as a separate formatter from ESLint**: Standard, low-maintenance combination; lint-staged limits checks to staged files so hook runtime scales with commit size, not repo size. Alternative considered: running full `npm run lint` on every commit - rejected as too slow once the block library grows.

**Legacy root `scripts/`, `styles/` remain present as build output, not hand-edited source**: Adobe Helix/EDS expects these paths at delivery time; Vite's build step writes into them (after the pre-build clean step) rather than the project maintaining two parallel copies by hand.

## Risks / Trade-offs

- [Risk] Build writes into paths (`scripts/`, `styles/`, `blocks/`) that also currently hold hand-edited source, risking accidental overwrite or confusion about "which file is the source of truth" during migration → Mitigation: migrate and delete the corresponding hand-edited root files in the same change per block/module, and call out in `docs/` that `src/` is the only editable source going forward.
- [Risk] Pre-build "clean output root" step could delete files that are not build artifacts if the output root is scoped too broadly → Mitigation: scope the clean step to only the specific generated paths (block bundles, compiled scripts/styles), never the whole repo root.
- [Risk] Two Vite configs can drift out of sync (e.g. a vendor-chunk rule added to one but not the other) → Mitigation: share common option objects (entry discovery glob, alias resolution) between the two config files instead of duplicating literals.
- [Risk] Strict TypeScript migration of existing JS may surface latent type errors that block the build → Mitigation: migrate block-by-block, verifying each block still builds and loads correctly before moving to the next.
- [Risk] A block's per-block model fragment (`_<name>.json`) or a shared field fragment gets moved out of sync with the root fragments that include it via relative path, silently breaking `build:json` → Mitigation: move each block's `.ts`, `.css`, and `_<name>.json` together as one unit (task 4.1), move all shared field fragments together with the root fragments in one step (task 6.1), and diff merged output before/after (task 6.3).

## Migration Plan

1. Add `tsconfig.json`, `vite.config.ts`, `vite.config-editor.ts` alongside the existing JS setup (no behavior change yet).
2. Port `scripts/aem.js` → `src/app/aem.ts` and `scripts/scripts.js` → `src/app/scripts.ts`, preserving the eager/lazy/delayed phase boundaries exactly.
3. Port blocks and styles into `src/blocks/*`, `src/styles/*` incrementally; verify each with `aem up` before moving on.
4. Point `build:json` fragment sources at `src/models/` and confirm merged root JSON files are unchanged.
5. Update `package.json` scripts (`start`, `build`, `tsc:watch`) to the new toolchain; remove now-superseded legacy scripts.
6. Add ESLint TS config, Prettier config, `lint-staged`, and the Husky pre-commit hook last, once source has moved, so hooks lint the final file set.
7. Rollback strategy: each step is a separate commit; reverting to the prior commit restores the plain-JS root-level setup since legacy root files are removed only after their `src/` counterpart is verified working.
