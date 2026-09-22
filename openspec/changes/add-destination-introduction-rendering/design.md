## Context

The `destination-introduction` block currently ships a stub that adds class hooks and nothing else. The Figma design is now final for all three breakpoints of the Destination page section:

| Frame   | Node         | Artboard |
| ------- | ------------ | -------- |
| Desktop | `6047:27004` | 1440     |
| Tablet  | `6048:28574` | 834      |
| Mobile  | `6048:30195` | 393      |

The block content model is unchanged: four block-level copy fields (`eyebrow`, `title`, `body`, `footerCta`) at row indices 0-3, then one row per gallery image. The design uses three images.

Constraints carried into this change:

- Figma is the source of truth for design tokens. Where `src/styles/tokens.css` diverges it is corrected, not worked around.
- The block must be insertable into any section on any page, so all CSS is scoped under `.destination-introduction` and all JavaScript is rooted at the block element.
- Multiple instances of the block may appear on one page, so no module-level mutable state, no `document`-level queries, and no generated element ids.
- Project breakpoints are mobile `<768`, tablet `768-1199`, desktop `>=1200`. Figma artboards are 393 / 834 / 1440, so tablet and desktop styles are authored to match the design at 834 and 1440 respectively while remaining fluid across their range.

## Goals / Non-Goals

**Goals:**

- Render the section faithfully at all three breakpoints without pixel-perfect obligation.
- Desktop master/detail gallery: one hero image plus a thumbnail row, selecting a thumbnail swaps the hero.
- Tablet and mobile slider with previous/next controls and native touch scrolling.
- Correct the four token defects found while auditing the design.
- Keep the block safe to use multiple times on one page.

**Non-Goals:**

- Changing the authoring model, the row order contract, or any `component-*.json` output.
- Autoplay, pagination dots, infinite looping, or lightbox behaviour. None appear in the design.
- Art direction via multiple sources per image. The design uses one asset per image at every breakpoint.

## Decisions

### Correct tokens rather than override them locally

Four divergences were found by comparing `get_variable_defs` output for the three frames against `src/styles/tokens.css`:

| Figma variable                              | Figma value  | Current token                          | Action               |
| ------------------------------------------- | ------------ | -------------------------------------- | -------------------- |
| `dimension/layout/module/padding/inline-XS` | 52 (desktop) | absent                                 | add at desktop       |
| `dimension/layout/module/gutter/M`          | 32 (desktop) | 24 at all breakpoints                  | add desktop override |
| `dimension/layout/module/padding/top`       | 112 (tablet) | 96 mobile, 120 desktop, no tablet step | add tablet override  |
| `component/button/padding-block`            | 8 (tablet)   | 16                                     | correct to 8         |

A grep confirmed no block currently consumes any of these four, so correcting them cannot regress existing pages. Each is added only at the breakpoint where Figma actually exposes a value; the alternative of inventing values for unsampled breakpoints was rejected because `tokens.css` already documents which values are sampled and which are not, and guessing would silently pollute that record.

`dimension/spacing/title-to-content` is Figma's current name for what the project calls `--dimension-spacing-heading-to-content`. The values match exactly at all three breakpoints (32 / 48 / 56), so this is a rename in Figma, not a defect. The token is not renamed here: it is consumed by nothing yet, but a rename is churn with no benefit inside this change and would be better done as a dedicated token-sync pass.

### One DOM, CSS Grid placement, no JavaScript reflow

The three layouts order the same content differently. Mobile and tablet run header, media, body, cta top to bottom. Desktop puts the media in a left column and stacks header, body, thumbnails, cta in a right column.

The block emits a single DOM in mobile/tablet source order and uses CSS Grid explicit placement to relocate the media into the left column at desktop. Two alternatives were rejected: moving nodes with JavaScript on resize, which is fragile, breaks Universal Editor instrumentation, and re-runs on every viewport change; and emitting duplicate markup per breakpoint, which doubles image requests and duplicates authored content in the accessibility tree.

Source order is the mobile/tablet order because that is the reading order the design intends, and it degrades correctly if CSS fails to load.

### Hero is the selected slide, not a separate element

The design's large left image is the currently selected one of the gallery images, not a fourth image. The same `<li>` elements therefore serve as both slider slides and desktop hero, and the CSS switches presentation:

- Mobile and tablet: the track is a horizontal scroll container with `scroll-snap-type: x mandatory`, all slides in flow.
- Desktop: slides are stacked in the same grid cell and only the selected one is visible.

This keeps a single source of truth for selection at every breakpoint and means no images are duplicated between hero and thumbnails.

### Arrows scroll the track; selection derives from scroll position

Previous/next buttons call `scrollBy` on the track rather than animating a transform. Native scrolling keeps touch, trackpad, and keyboard scrolling working for free and matches the pattern already used by `culturist-carousel`. The selected index is derived from the track's scroll position so that swiping and pressing an arrow stay in sync without a second source of truth.

At desktop the track does not scroll, so selection is driven only by thumbnail clicks.

### Arrow icons come from the exported Figma assets

The arrow is a filled 28x28 glyph, not a stroked chevron, so the CSS border-rotation trick used by `culturist-carousel` would not reproduce it and `icons/chevron-down.svg` (40x14, hard-coded white stroke) does not match either. The exported path data is inlined into the generated `<svg>` at its original `0 0 28 28` viewBox with `fill: currentColor`, so the geometry is preserved exactly while the colour stays controllable from the block CSS.

### The desktop hero fills the section height rather than holding a ratio

In Figma the desktop hero is 864x691.2 and the section is 691.2 tall: the image is exactly as tall as the section, so its proportion is a consequence of the composition rather than a rule. The hero is therefore stretched to the section height and cropped with `object-fit: cover`, and the section height is decided by the copy column alone.

An earlier attempt pinned the media to a `5:4` aspect ratio. That made its height definite, so it stopped stretching and its bottom edge sat 135px above the bottom of the copy column. Removing the ratio without further change swung the error the other way: the media's intrinsic height became the natural height of the image (1282px), which then drove the whole section.

The fix is to take the desktop track out of flow with `position: absolute; inset: 0` inside a `position: relative` media element. Absolutely positioned content contributes nothing to grid track sizing, so the image can neither shrink nor stretch the section, and the media resolves to exactly the grid height. The stacked slides need `grid-template-rows: 100%` on the track for `height: 100%` to resolve, since a percentage height against an `auto` row falls back to the image's intrinsic height.

Tablet and mobile keep the track in normal flow, because there it is a scroll container whose height comes from the slide aspect ratio.

### The footer CTA renders at every breakpoint

`text-links` is flagged `hidden` in the desktop frame, and the tablet and mobile frames additionally hide a second button, a divider, a location list, and a profile block. These are optional parts of the component that the designer switched off for this composition, not breakpoint rules. Hiding an authored field at one breakpoint would mean an author fills in Footer CTA and watches it disappear on desktop, so the field renders wherever it is populated and simply occupies no space when empty.

### Per-instance scoping

`decorate` receives the block element and every query is rooted at it. Selection state lives in a closure per invocation. No element ids are generated, so `aria-controls` is not used; the relationship between thumbnails and the hero is conveyed with `aria-current` on the active thumbnail instead. This is what makes two instances on one page independent.

## Risks / Trade-offs

- **Scroll-derived selection can drift mid-scroll** → the index is computed by rounding against slide width plus gap, and arrow presses target the computed neighbour rather than accumulating offsets, so a partial scroll snaps to a whole slide.
- **`scroll-snap` plus `scrollBy` behaves inconsistently in older Safari** → snapping is a progressive enhancement; if it misbehaves the track still scrolls and the arrows still move by one slide width.
- **The desktop section height is decided entirely by the copy column** → the hero stretches to match it, so a very short copy column yields a short hero; the grid keeps the Figma block padding as a floor on the outer rows, and unusually long copy grows the section rather than clipping the image.
- **Correcting `--component-button-padding-block` at tablet changes a shared token** → no block consumes it today, so the change is inert until something does; recorded here so it is not mistaken for an unrelated edit.
- **Figma reports tablet inconsistently** → `get_design_context` for node `6048:28574` returned the mobile variant's structure while `get_metadata` for the same node returned tablet geometry. Tablet values in this change come from `get_metadata` plus `get_variable_defs`, which agree with each other. Tablet rendering should be visually checked against the Figma frame before merge.

## Migration Plan

No content migration. The authoring model, the stored content, and the generated `component-*.json` files are untouched, so no CMS redeployment is required and existing authored instances pick up the new rendering as soon as the code ships.

Rollback is reverting the block's `.ts` and `.css` and the `tokens.css` edit.

## Open Questions

- Should the desktop thumbnail row scroll or wrap if an author adds more than three images? The design only shows three and the content model allows any number.
- Does the tablet slider need thumbnails restored at the upper end of its range (approaching 1199) or does the arrow-only treatment hold?
