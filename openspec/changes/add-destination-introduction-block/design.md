## Context

The Destination page design introduces an introduction section combining editorial copy with a set of supporting images. Two existing blocks are adjacent but neither fits:

- `section-intro` has `title`, `subtitle`, and `description` but no image list.
- `destination-cards` has an image list, but every image is bound to its own headline, CTA, and overlay settings.

The visual design for the gallery is not finalised. The immediate need is that authors can compose and populate this section in Universal Editor. Rendering is therefore split off into a follow-up change, and this change delivers the authoring model plus a non-visual stub.

Relevant repository constraints:

- Universal Editor fragments are hand-authored per block at `src/blocks/<name>/_<name>.json` and merged into the three root JSON files by `npm run build:json`. The `ue-json-pipeline` capability already guarantees new block fragments are picked up automatically.
- All eighteen existing blocks model repeatable content with child item components (`core/franklin/components/block/v1/block/item`) plus a filter. No block uses a `multi: true` reference field.
- `decorateButtons(main)` runs globally from `src/app/scripts.ts`, so anchors authored inside rich text are already promoted to buttons without block-specific code.

## Goals / Non-Goals

**Goals:**

- Authors can create the section and populate eyebrow, heading, body, closing CTA, and an arbitrary number of gallery images in Universal Editor.
- The block emits a stable, documented DOM contract that the follow-up rendering change can build on without renegotiating the content model.
- The model stays consistent with existing repository conventions so it is unsurprising to both authors and future maintainers.

**Non-Goals:**

- Gallery layout, carousel behaviour, responsive rules, image art direction.
- Anchor / deep-link support.
- Block style variants.
- Any change to shared scripts, styles, or existing blocks.

## Decisions

### Gallery as child items rather than a multi-value reference field

The gallery is modelled as a repeatable `destination-introduction-image` child item with `image` and `imageAlt` fields, registered through a `destination-introduction` filter.

The alternative was a single `reference` field with `multi: true`, which would let an author pick several assets in one pass through the asset picker. It was rejected because a multi-value picker yields no place to store per-image alternative text, which the project's accessibility guidance requires; because it diverges from the pattern used by all eighteen existing blocks; and because it cannot be extended later with per-image caption, link, or focal point without a content migration.

The cost is that authors click Add once per image. With an expected count below ten this is acceptable.

The shared `src/models/_image.json` fragment has exactly the same two fields, but its resource type is `core/franklin/components/image/v1/image`, which is a section-level component and cannot serve as a block child. The field names are mirrored instead of reused so the two stay recognisably the same shape.

### Title and footer CTA as rich text

`title` uses `richtext` rather than `text` so authors choose the heading level themselves rather than having the block hard-code one. This matches `destination-cards`, whose `title` is also rich text.

`footerCta` uses `richtext` rather than the structured `aem-content` + label pair used by `destination-cards`. The requested behaviour is one or more links sitting side by side, and the final composition is undecided. Rich text keeps that open and needs no block code, because global button decoration already handles anchors in rich text.

The trade-off is accepted deliberately: rich text gives no path picker validation and no open-in-new-tab control. If the CTA later settles into a single structured button, the field can be replaced then, when the requirement is actually known.

### Row addressing by fixed index from the start

An earlier draft of this design proposed identifying gallery rows by the presence of a `picture` element, on the assumption that no copy field could contain one. Inspecting delivered production markup disproved that assumption and produced a better rule.

The `hero-banner` block on `/test-pages/hero-banner` has six model fields and emits exactly six rows. Two of those rows are `picture` elements sitting at indices 1 and 2, in the middle of the table, so `picture` presence is not a general discriminator. Two further rows are empty, including rows for fields hidden by a `condition`, which shows that a row is emitted for every field regardless of what the author entered or whether the field was even visible to them.

The `awards-list` block on `/test-pages/awards-list` shows the two mechanisms that reduce the row count: `cta`, `cta_link`, and `cta_openInNewTab` collapse into a single cell through element grouping, and the field named `id` emits no row at all because the name is reserved and renders as the block's `id` attribute. That block's item rows also demonstrate that the number of child elements inside a single cell varies between items, so only row and cell indices are safe to address, never the index of a node inside a cell.

Taken together: the number of rows equals the number of model fields after collapsing suffixed fields, merging underscore groups, and excluding reserved names, and it does not depend on authored content. Copy fields therefore have constant indices counted from the start, and child items are always appended after them. Addressing by index from the start is stable; content sniffing is not.

`data-aue-*` attributes were also evaluated as a discriminator and rejected: the delivered `.plain.html` for this project contains none, so any rule based on them would work in the Universal Editor and fail in production.

Two consequences are written into the spec. Fields named `id` or `classes` must not be added to this model, since they would not emit a row and would silently shift every later index. And changing the field list is a contract change that must update the decoration indices in the same commit.

The residual risk is that trailing empty rows may be trimmed when the markup round-trips through markdown. This is harmless here: trimming can only affect the end of the table, and whenever gallery items exist they sit after the copy rows and prevent trimming from reaching them. When no items exist, the slice that reads them is empty anyway. Reading a row defensively and tolerating a missing one covers both branches.

### No required fields

Every field is optional, per the explicit decision to defer field-level validation. This forces the follow-up rendering work to handle every empty combination from the start, which is the correct posture for Edge Delivery blocks in any case, since authors routinely omit fields.

### Stub rather than model-only

Shipping only the JSON fragment would leave the block rendering as raw nested `div` elements on the page. A stub `.ts` and `.css` establishes the class hook and keeps the section from looking broken while the design is finalised. The stub deliberately implements no layout.

## Risks / Trade-offs

- **Rich text footer CTA produces unvalidated hrefs and no new-tab control** → Accepted for now; revisit when the CTA composition is decided. If it settles on a single button, migrate to `aem-content` plus a label field.
- **A stub block on a live page may look unstyled to authors previewing content** → Keep the stub minimal but ensure it does not overflow or collapse the surrounding section; communicate that visual design lands in the follow-up change.
- **The block name is tied to the Destination page while the block is generic** → Accepted; the name follows the design and matches the existing `destination-cards` naming. Reuse elsewhere is possible but the name will read slightly off.
- **A very large gallery could hurt page weight once rendering lands** → Not a concern for the model, but the follow-up change should apply lazy loading to gallery images beyond the fold.

## Migration Plan

No migration. The block is new, no existing content references it, and no existing block or shared file changes behaviour. Rollback is deleting the block directory, reverting the `src/models/_section.json` filter entry, and re-running `npm run build:json`.

## Open Questions

- Final gallery layout and whether it needs carousel behaviour, which determines whether the follow-up change reuses the `culturist-carousel` / `offers-carousel` pattern or implements a CSS-only grid.
- Whether the footer CTA ultimately needs structured link fields.
- Whether the block will ever need anchor / deep-link support like `destination-cards`. If so it must use a non-reserved field name such as `anchorId`.

## Deferred

These were explored while shaping this change and deliberately left out. They are recorded so the follow-up work does not have to rediscover them.

- **A shared `gallery-image` item reusable across blocks.** Definitions, models, and filters are aggregated by glob into flat global lists, so an item id declared once can be listed in any block's filter. Worth extracting when a second block needs a gallery; premature now.
- **A `readBlockRows` helper in `src/utils/`** that maps rows to named fields from a declared field list, replacing magic indices across blocks. Useful once several blocks follow the same contract; out of scope for a single block.
- **Supporting two galleries in one block.** Two sibling item models cannot be told apart in production markup. The workable approach is a single item model carrying a discriminator field whose value is authored content. Not modelled here because this block has one gallery; adding the field later will not break stored content, since AEM persists by field name.
- **Nested child items** (`filters-grid` declares a two-level filter chain). No page in the project uses it and its delivered markup has never been verified, so it cannot be relied on without a spike.
- **Composite multi-field** (`container` with `multi: true`), which would render the whole gallery as a single `ul` cell. Rejected because it is early-access and requires Adobe to enable it, which is outside the frontend team's scope.
