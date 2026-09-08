## Why

The `destination-introduction` block currently ships a stub: it establishes class hooks but implements no layout, so authors previewing the section see unstyled rows. The Figma design for the Destination page is now final across all three breakpoints, and it specifies an interaction the stub does not attempt — a master/detail gallery on desktop and a slider on smaller screens.

Auditing the design against `src/styles/tokens.css` also surfaced four token defects. Because Figma is the source of truth for this project's design tokens, those must be corrected before block CSS is written on top of them, otherwise the block would encode the wrong values.

## What Changes

- Implement the responsive rendering of `destination-introduction` against the Figma design (desktop `6047:27004`, tablet `6048:28574`, mobile `6048:30195`).
- Add gallery interaction: on desktop the block shows one large hero image plus a row of thumbnails, and selecting a thumbnail swaps the hero; on tablet and mobile the thumbnails are replaced by a slider with previous/next controls.
- Correct `src/styles/tokens.css` against Figma: add the missing `--dimension-layout-module-padding-inline-xs`, and fix `--dimension-layout-module-gutter-m`, `--dimension-layout-module-padding-top`, and `--component-button-padding-block` at the breakpoints where they diverge.
- Deliver the visual design that the `destination-introduction-block` capability's "Stub decoration without visual design" requirement explicitly deferred to a follow-up change.

No change to the authoring model. The block-level copy fields and the repeatable `destination-introduction-image` child item are unchanged, so no CMS redeployment of `component-*.json` is required for the content model, and existing authored content keeps working.

## Capabilities

### New Capabilities

- `destination-introduction-rendering`: the responsive layout, gallery interaction, and DOM output of the `destination-introduction` block across mobile, tablet, and desktop.

### Modified Capabilities

None. `destination-introduction-block` is still an in-flight change and has not been archived into `openspec/specs/`, so there is no published requirement to write a delta against. Its "Stub decoration without visual design" requirement explicitly deferred this work and is satisfied, not contradicted, by delivering it here. The two changes must be archived in order — `add-destination-introduction-block` first — and the stub requirement dropped at that point.

## Impact

- `src/blocks/destination-introduction/destination-introduction.ts` — stub decoration replaced with the full implementation.
- `src/blocks/destination-introduction/destination-introduction.css` — stub replaced with the responsive layout.
- `src/styles/tokens.css` — four token corrections. No block currently consumes any of the four, so the blast radius is limited to this change.
- Possible new icon asset for the slider arrow control under `icons/`.
- No change to `_destination-introduction.json`, `src/models/_section.json`, or the generated `component-*.json` files.
