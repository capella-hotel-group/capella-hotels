## Why

The Destination page design calls for an introduction section that pairs editorial copy (eyebrow, heading, body, closing call-to-action) with a set of supporting images. No existing block covers this shape: `section-intro` has the copy fields but no image list, and `destination-cards` couples every image to its own headline and CTA. Authors currently have no way to compose this section in Universal Editor.

This change delivers the authoring model only. The visual treatment of the gallery has not been designed yet, so the frontend rendering is deliberately deferred to a follow-up change.

## What Changes

- Add a new generic block `destination-introduction` with a Universal Editor model exposing four block-level fields: `eyebrow` (text), `title` (richtext), `body` (richtext), and `footerCta` (richtext).
- Add a child item component `destination-introduction-image` (`core/franklin/components/block/v1/block/item`) with `image` (reference) and `imageAlt` (text), allowing authors to add an arbitrary number of gallery images. Expected real-world usage is fewer than ten.
- Register the child item against the block through a `destination-introduction` filter so the Add button appears in Universal Editor.
- Register `destination-introduction` in the shared `section` filter so the block can be inserted into any section.
- Ship a stub `destination-introduction.ts` and `destination-introduction.css` so the block emits a stable class hook and does not break page layout, without implementing the final visual design.
- No field is marked `required`. Every field is optional and the block must tolerate any combination of empty values.

Not in scope: gallery layout, carousel behaviour, responsive rules, image art direction, anchor/deep-link support, and block style variants. These are follow-up work once the design is finalised.

## Capabilities

### New Capabilities

- `destination-introduction-block`: the Universal Editor authoring model for the destination introduction block, including its block-level copy fields, its repeatable image child item, filter registration, and the DOM contract the future rendering work will consume.

### Modified Capabilities

<!-- None. The `ue-json-pipeline` spec already requires new block fragments under src/blocks/<name>/_<name>.json to be picked up automatically, so adding this block exercises existing behaviour rather than changing it. -->

## Impact

- New directory `src/blocks/destination-introduction/` containing `_destination-introduction.json`, `destination-introduction.ts`, and `destination-introduction.css`.
- Edit to `src/models/_section.json` to add `destination-introduction` to the `section` filter's component list.
- Regenerated root `component-definition.json`, `component-models.json`, and `component-filters.json` via `npm run build:json`.
- Generated build output under `blocks/destination-introduction/`.
- No change to shared scripts, styles, or any existing block. Existing authored content is unaffected.
