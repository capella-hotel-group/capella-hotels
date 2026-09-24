## Why

The footer is being redesigned per the Figma "Capella Revamp 2026" file (`2AVYi5QIYXJhL72SkC31P7`; Desktop node 6512:19717, Tablet node 6512:20326). The current `footer` block only supports flat bullet lists laid out in a wrapping grid, has no divider treatment, no social links, and no newsletter signup — it cannot express the new design's four distinct content groups (nav columns, newsletter, contact + social, legal + copyright) or their responsive rearrangement (a single visual row on desktop assembled from four DOM groups via CSS Grid).

Separately, the new design calls for the existing `newsletter-form` block to appear directly inline inside the footer, with underline-style inputs, grouped field rows, a required consent checkbox, and a text-link submit — a visual and interaction mode the block does not currently support. The block today is modal-only: a trigger button opens an overlay containing boxed inputs and a text-only consent notice.

Both changes are scoped so existing authored content keeps working: the footer's fragment path resolution (`docs/header-footer-fragment-path-resolution.md`) is untouched, and the newsletter form's existing modal behavior, submit endpoint, hCaptcha logic, and property/source resolution are unchanged and only reachable through the new `layout` field's default value.

## What Changes

- Author a new 4-section content structure for the `/footer` fragment page (nav link columns, newsletter, contact + social, legal + copyright) and document it in a new `docs/footer-authoring-guide.md`, mirroring `docs/header-nav-authoring-guide.md`.
- Rewrite `src/blocks/footer/footer.ts` to parse the fragment as these 4 fixed sections by index, tolerating a missing/malformed section by skipping it, and to preserve decorated icon markup (from `decorateIcons()`) on social links instead of reducing them to plain text.
- Insert 3 `.footer-divider` elements between the 4 groups, styled with CSS borders rather than an image asset.
- Rewrite `src/blocks/footer/footer.css` using only `src/styles/tokens.css` tokens, with mobile/tablet stacking and a desktop `display: contents` reflow (the same technique used in `src/blocks/destination-introduction/destination-introduction.css`) that assembles the 4 groups into a single CSS Grid row via named `grid-area`s, independent of DOM order.
- Add a `layout` field (`Modal` / `Inline`, default `Modal`) to `src/blocks/newsletter-form/_newsletter-form.json`, extending the `ROW` index map in `newsletter-form.ts`.
- Branch `newsletter-form.ts` on `layout`: `Modal` keeps its exact current behavior; `Inline` renders the form in place with no trigger/overlay, underline-style inputs, grouped field rows (3-column Title/First name/Last name and 2-column Country/Email at tablet/desktop, stacked at mobile), a required consent checkbox gating the submit button, and a text-link-style "SIGN UP" submit button.
- Add `.newsletter-inline`-scoped rules to `newsletter-form.css` without modifying existing modal-scoped rules.
- Download `icons/facebook.svg`, `icons/instagram.svg`, and `icons/line.svg` from the Figma file to pixel-match the design (no hand-redrawing, no leftover Figma asset URLs).

Not in scope: header/nav blocks or their fragment path resolution, the newsletter form's submit endpoint/hCaptcha/property-resolution logic, and RTL-specific work beyond existing logical-property conventions.

## Capabilities

### New Capabilities

- `footer-block`: the 4-section authoring contract for the `/footer` fragment, the `footer.ts` decoration logic that parses it (nav columns, newsletter passthrough, contact + social with preserved icon markup, legal + copyright, dividers), and the responsive CSS layout (mobile/tablet stacking, desktop CSS Grid reflow via `display: contents`).
- `newsletter-form-block`: the `layout` field and its two rendering modes — the existing `Modal` behavior (documented as a stable baseline for the first time) and the new `Inline` behavior (underline inputs, grouped field rows, required consent checkbox gating, text-link submit).
- `footer-authoring-guide`: documentation guiding authors on the correct 4-section structure for the `/footer` fragment page, including the icon-shortcode convention for social links.

### Modified Capabilities

<!-- None. The `header-footer-lang-fallback` spec already governs footer fragment path resolution (metadata + URL fallback), which this change does not touch. -->

## Impact

- Rewritten `src/blocks/footer/footer.ts` and `src/blocks/footer/footer.css`.
- New `docs/footer-authoring-guide.md`.
- New `icons/facebook.svg`, `icons/instagram.svg`, `icons/line.svg`.
- Edit to `src/blocks/newsletter-form/_newsletter-form.json` (new `layout` field) and regenerated root `component-definition.json` / `component-models.json` / `component-filters.json` via `npm run build:json`.
- Edit to `src/blocks/newsletter-form/newsletter-form.ts` (new `ROW` entry, `layout` branch, inline rendering path) and `src/blocks/newsletter-form/newsletter-form.css` (new `.newsletter-inline` rules).
- Generated build output under `blocks/footer/` and `blocks/newsletter-form/`.
- No change to `src/blocks/header/`, `docs/header-footer-fragment-path-resolution.md`, or the newsletter form's submit/hCaptcha/property-resolution logic.
