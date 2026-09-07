## 1. Design tokens

- [ ] 1.1 Add `--dimension-spacing-title-to-content` (32 / 48 / 56px) to `src/styles/tokens.css`
- [ ] 1.2 Add `--dimension-viewport-width` (393 / 834 / 1440) to `src/styles/tokens.css`
- [ ] 1.3 Add `--dimension-layout-margin-m` (40 / 40 / 80px) to `src/styles/tokens.css`
- [ ] 1.4 Add `--dimension-layout-carousel-item-gap-xl` (32 / 40 / 40px) to `src/styles/tokens.css`
- [ ] 1.5 Add `--typography-paragraph-spacing-body-m` (16px, all breakpoints) to `src/styles/tokens.css`
- [ ] 1.6 Add the missing desktop declaration `--component-button-padding-block: 16px`
- [ ] 1.7 Implement the text link without an explicit height: `padding-block` from the token, cap trim applied, then measure the rendered box against the 40px Figma frame
- [ ] 1.8 Visually check `destination-introduction` buttons at desktop after 1.6 and note the result in the change
- [ ] 1.9 Add a comment in `tokens.css` recording the `heading-to-content` 56px vs Figma 48 discrepancy as out of scope, and open a follow-up ticket

## 2. Fluid desktop scaling

- [ ] 2.1 Declare `--fluid-unit: 1px` at `:root` in `src/styles/tokens.css`
- [ ] 2.2 Override `--fluid-unit: calc(100vw / 1440)` inside the `@media (width >= 1200px)` block
- [ ] 2.3 Add a short comment explaining why `vw` is used instead of `cqi` and that the unit must never feed `width`
- [ ] 2.4 Verify at 1200 / 1440 / 1920px that `calc(296 * var(--fluid-unit))` computes to 246.7 / 296 / 394.7px
- [ ] 2.5 Confirm no horizontal scrollbar appears at any width, including with classic scrollbars

## 3. Content model

- [ ] 3.1 Create `src/blocks/choose-space/_choose-space.json` with the `choose-space` and `space-option` definitions
- [ ] 3.2 Add the block-level model: `anchorId`, `title`, and the `exploreCta` element group
- [ ] 3.3 Add the `space-option` item model with all ten cells in the order fixed by the design
- [ ] 3.4 Add the filter allowing `space-option` inside `choose-space`
- [ ] 3.5 Register the block id in the section filter so authors can insert it
- [ ] 3.6 Run `npm run build:json` and confirm the aggregated root component JSON picks up both ids
- [ ] 3.7 Run `npm run lint` and resolve any `eslint-plugin-xwalk` model findings

## 4. Test content

- [ ] 4.1 Create a static page under `drafts/` exercising the block with three items
- [ ] 4.2 Add a fourth and fifth item variant to force tab list overflow
- [ ] 4.3 Add an item with `media = video` and an item with `mediaAssetMobile` set
- [ ] 4.4 Add an item with the secondary CTA left empty
- [ ] 4.5 Verify the delivered row and cell layout with `curl .../page.plain.html` and confirm it matches the model in design.md

## 5. Block markup and decoration

- [ ] 5.1 Create `src/blocks/choose-space/choose-space.ts` with the default `decorate` export
- [ ] 5.2 Parse the three block-level rows by fixed index
- [ ] 5.3 Parse each item row by fixed cell index, without probing for `picture` or counting children
- [ ] 5.4 Build the hero panel: media, eyebrow, title, description, CTA links
- [ ] 5.5 Build the tab control: thumbnail image plus label, with no `data-aue-*` attributes
- [ ] 5.6 Assemble the selector with the head wrapper, tab list and single "Explore all" anchor; the selector renders even with a single item
- [ ] 5.7 Apply `anchorId` to the block element
- [ ] 5.8 Handle missing optional fields without throwing, including the zero-item case

## 6. Tab behaviour

- [ ] 6.1 Wire ARIA roles, ids and `aria-controls` between tabs and panels
- [ ] 6.2 Mark the first item active during decoration, before any event fires
- [ ] 6.3 Implement click activation with panel show/hide
- [ ] 6.4 Implement roving tabindex and arrow key navigation
- [ ] 6.5 Scroll a newly activated off-screen tab into view

## 7. Media handling

- [ ] 7.1 Render `picture` for `media = image` with alt text from `mediaAssetAlt`
- [ ] 7.2 Render `video` for `media = video` with muted, loop, playsinline, `preload="none"` and the thumbnail as poster
- [ ] 7.3 Attach `mediaAssetMobile` as a mobile `source`, falling back to `mediaAsset` when absent
- [ ] 7.4 Play the video when its panel activates; pause and reset `currentTime` when it deactivates
- [ ] 7.5 Suppress autoplay under `prefers-reduced-motion: reduce` and keep the poster visible

## 8. Conditional carousel

- [ ] 8.1 Implement the overflow measurement `scrollWidth > clientWidth + 1`
- [ ] 8.2 Observe the tab list with `ResizeObserver` and debounce the callback by 150ms trailing
- [ ] 8.3 Implement `init()` guarded by an `inited` flag, adding controls to a sibling element
- [ ] 8.4 Implement `destroy()` removing controls, detaching the exact listener references and resetting scroll position
- [ ] 8.5 Disconnect the observer when the block is removed from the DOM
- [ ] 8.6 Test resizing across the threshold in both directions repeatedly and confirm no duplicated controls or listeners

## 9. Styling

- [ ] 9.1 Create `src/blocks/choose-space/choose-space.css` with every selector scoped to the block
- [ ] 9.2 Write mobile styles first against the 393px artboard
- [ ] 9.3 Add the tablet layer at `min-width: 768px` against the 834px artboard
- [ ] 9.4 Add the desktop layer at `min-width: 1200px` using `calc(N * var(--fluid-unit))` for spacing
- [ ] 9.5 Implement the `display: contents` reorder so the "Explore all" anchor is never duplicated
- [ ] 9.6 Use flexbox only, no CSS Grid
- [ ] 9.7 Use logical properties throughout and verify the module under RTL
- [ ] 9.8 Style tab selected, hover and focus-visible states
- [ ] 9.9 Style the hero overlay so the text stays legible over both image and video media
- [ ] 9.10 Apply `text-box-trim: trim-both` and `text-box-edge: cap alphabetic` to every text element in the block
- [ ] 9.11 Verify vertical spacing by measuring the rendered boxes against the artboard, not by computing from `line-height`

## 10. Verification

- [ ] 10.1 Compare desktop, tablet and mobile against the Figma nodes `6047:27021`, `6048:28586` and `6048:30207`
- [ ] 10.2 Confirm desktop padding measures exactly 296px and 80px at a 1440px viewport
- [ ] 10.3 Keyboard-only pass: reach the tabs, switch panels, reach both CTAs and the "Explore all" link
- [ ] 10.4 Screen reader pass: tab list, selected state and panel association are announced
- [ ] 10.5 Verify authoring in the Universal Editor: inline text edit, item add, item reorder, item delete
- [ ] 10.6 Confirm selecting an item in the editor activates its panel and that items are not double-counted
- [ ] 10.7 Run `npm run lint` and `npm run format:check`
- [ ] 10.8 Run a PageSpeed Insights check on the feature preview URL and address regressions
- [ ] 10.9 Open the PR with a link to the preview page demonstrating the block
