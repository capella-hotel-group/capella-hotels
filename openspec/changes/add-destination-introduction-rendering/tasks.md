## 1. Design tokens

- [x] 1.1 Add `--dimension-layout-module-padding-inline-xs: 52px` to the `width >= 1200px` block in `src/styles/tokens.css`, with a comment noting Figma exposes it only on the 1440 artboard
- [x] 1.2 Add a desktop override `--dimension-layout-module-gutter-m: 32px`, leaving the `24px` base untouched
- [x] 1.3 Add a tablet override `--dimension-layout-module-padding-top: 112px`
- [x] 1.4 Correct the tablet `--component-button-padding-block` from `16px` to `8px`
- [x] 1.5 Update the "Not modeled yet" note at the top of `tokens.css` so it no longer lists `padding-inline-xs`

## 2. Slider control icon

- [x] 2.1 Inline the exported Figma arrow path data into the block source at its `0 0 28 28` viewBox with `fill: currentColor`, one path for previous and one for next
- [x] 2.2 Remove the downloaded `icons/carousel-arrow-*.svg` files so no unused asset is committed

## 3. Block markup

- [x] 3.1 Rewrite `destination-introduction.ts` to build the DOM in mobile/tablet reading order: header (eyebrow, title), media, body, thumbnails, footer CTA
- [x] 3.2 Read copy fields at fixed indices 0 to 3 and gallery items from `rows.slice(4)`, preserving the existing row order contract
- [x] 3.3 Render gallery images once as slider slides in a list, reused as the desktop hero, and render a separate thumbnail button per image
- [x] 3.4 Call `moveInstrumentation` for every relocated element, including each gallery item
- [x] 3.5 Skip the media area entirely when there are no gallery images, and skip controls and thumbnails when there is exactly one
- [x] 3.6 Omit any wrapper for a copy field the author left empty

## 4. Block behaviour

- [x] 4.1 Keep selection state in a per-invocation closure and root every query at the block element; no `document` queries, no module-level state, no generated ids
- [x] 4.2 Wire thumbnail buttons to set the selected index and move `aria-current`
- [x] 4.3 Wire previous and next buttons to scroll the track by one slide using `scrollBy`
- [x] 4.4 Derive the current index from the track's scroll position so gestures and controls stay in sync
- [x] 4.5 Give both controls accessible names and render thumbnails as `button` elements

## 5. Block styles

- [x] 5.1 Scope every selector under `.destination-introduction`; avoid `-container` and `-wrapper` suffixes
- [x] 5.2 Author mobile first: single column, full-bleed slider with `280x350` slides, `4px` gap, controls inset `20px`, section padding `24px` inline and `48px` block
- [x] 5.3 Add the tablet layer at `min-width: 768px`: `48px` inline padding, `112px` padding top, slider constrained to the content width at a `5:4` ratio, thumbnails hidden
- [x] 5.4 Add the desktop layer at `min-width: 1200px`: grid with a `60%` media column and a `40%` copy column, copy vertically centred, `52px` / `80px` inline padding, hero shows only the selected slide, thumbnail row of `4:5` items with `4px` gap
- [x] 5.5 Bind typography, colour, and spacing to the token custom properties rather than literals wherever a token exists
- [x] 5.6 Style the footer CTA link as an uppercase underlined text link using the CTA font tokens

## 6. Build and validation

- [x] 6.1 Run `npm run build` and confirm `blocks/destination-introduction/` output is regenerated
- [x] 6.2 Run `npm run lint` and resolve any findings
- [x] 6.3 Extend the draft page under `drafts/` with a three-image instance plus a two-instance case on one page
- [x] 6.4 Verify in the browser at `393`, `834`, and `1440` that the rendering matches the Figma frames
- [x] 6.5 Verify two instances on one page operate independently
- [x] 6.6 Verify the no-image and single-image cases render without a JavaScript error

## 7. Wrap-up

- [x] 7.1 Confirm `_destination-introduction.json`, `src/models/_section.json`, and the root `component-*.json` files are unchanged
- [x] 7.2 Confirm no block other than `destination-introduction` changed, and that the only shared file touched is `src/styles/tokens.css`
