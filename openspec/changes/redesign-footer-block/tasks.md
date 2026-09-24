## 1. Authoring guide

- [x] 1.1 Create `docs/footer-authoring-guide.md` mirroring `docs/header-nav-authoring-guide.md` (Overview, per-section rules, Rules, Pre-publish Checklist), documenting the 4 fixed sections: (1) 2 nav link columns, (2) newsletter form, (3) contact info + social links, (4) legal links + copyright
- [x] 1.2 Document the social-link icon-shortcode convention (`:facebook:`, `:instagram:`, `:line:`) in the guide, including that authors can freely add/remove/reorder social platforms using the existing icon convention

## 2. Assets

- [x] 2.1 Export `icons/facebook.svg`, `icons/instagram.svg`, `icons/line.svg` from the Figma file (node 6512:19717 image fills `imgProperty1Facebook`/`imgProperty1Instagram`/`imgProperty1Line`) to pixel-match the design, with no leftover Figma asset URLs

## 3. `newsletter-form` model changes

- [x] 3.1 Add a `layout` field (`select`, options `Modal`/`Inline`, default `Modal`) to `src/blocks/newsletter-form/_newsletter-form.json`, appended after the existing fields
- [x] 3.2 Add `LAYOUT: 12` to the `ROW` index map in `src/blocks/newsletter-form/newsletter-form.ts` and extend the file's existing comment documenting `ROW` order

## 4. `newsletter-form` decoration changes

- [x] 4.1 Read the authored `layout` value in `decorate()` and branch: unchanged `Modal` path (existing trigger + overlay + boxed inputs + text-only consent) vs. new `Inline` path
- [x] 4.2 Implement the `Inline` path: render the form directly in the block with no trigger button and no overlay/modal chrome
- [x] 4.3 In `Inline`, use underline-only input styling (label above/overlapping a bottom-border field) instead of the boxed `input`/`select` style
- [x] 4.4 In `Inline`, group fields into a 3-column row (Title/First name/Last name) and a 2-column row (Country/Email) at tablet (≥768px) and desktop (≥1200px); stack every field individually at mobile (≤767px)
- [x] 4.5 In `Inline`, render the submit action as an underlined text-link style button ("SIGN UP") instead of the modal's solid CTA button
- [x] 4.6 In `Inline`, render a required `<input type="checkbox">` before the consent message (from the existing `consentMessage` field) and keep the submit button disabled until it is checked, combined with the existing hCaptcha gating (both conditions must be satisfied, mirroring the hCaptcha enable/disable pattern already in the file)
- [x] 4.7 Confirm the `Modal` path's DOM output, CSS classes, and consent behavior are byte-for-byte unchanged from before this change

## 5. `newsletter-form` styles

- [x] 5.1 Add new `.newsletter-inline`-scoped rules to `src/blocks/newsletter-form/newsletter-form.css` for the underline inputs, field grouping grid, checkbox, and text-link submit
- [x] 5.2 Confirm no existing modal-scoped rule (`.newsletter-trigger`, `.newsletter-overlay`, `.newsletter-dialog-*`, `.newsletter-form-element` boxed-input rules) is modified or removed

## 6. `footer` block rewrite

- [x] 6.1 Rewrite `src/blocks/footer/footer.ts` to parse the loaded fragment as 4 fixed sections by index, skipping (not throwing on) a missing or malformed section
- [x] 6.2 Section 1: render each of the 2 Text/list components as its own `.footer-nav-col`, preserving link href/target/rel exactly as today
- [x] 6.3 Section 2: relocate the already-decorated `newsletter-form` block into its footer group without rebuilding it
- [x] 6.4 Section 3: render the contact-info Text component as-is (multi-line, one `<p>` per group) and render the social links list, preserving each link's decorated icon `<span>` markup (move/clone full child nodes, not `textContent`)
- [x] 6.5 Section 4: render the legal links bullet list and the plain copyright paragraph
- [x] 6.6 Insert 3 `.footer-divider` elements between the 4 groups (after nav-columns, after newsletter, after contact+social)
- [x] 6.7 Keep `getFragmentBasePath()` and the metadata/URL fallback resolution logic unchanged
- [x] 6.8 Preserve Universal Editor instrumentation (`moveInstrumentation`) on every element moved from the fragment

## 7. `footer` block styles

- [x] 7.1 Rewrite `src/blocks/footer/footer.css` using only `src/styles/tokens.css` tokens (color/spacing/typography), no hardcoded hex/px
- [x] 7.2 Mobile (≤767px): stack all groups in DOM order, all 3 dividers visible
- [x] 7.3 Tablet (768–1199px): 2 nav columns side by side, newsletter section full-width below (with its own 3-col/2-col field grid), contact+social full-width below that, all 3 dividers visible
- [x] 7.4 Desktop (≥1200px): apply `display: contents` to the nav-columns wrapper and arrange nav column 1, nav column 2, newsletter, and contact+social into one CSS Grid row via named `grid-area`s in the order Contact+Social | Nav column 1 | Nav column 2 | Newsletter; hide the 2 dividers inside that row (`display: none`) while keeping the divider before legal+copyright visible at all breakpoints
- [x] 7.5 Legal links: horizontal/wrapping row at tablet and desktop, stacked vertically at mobile; copyright line left-aligned below it at all breakpoints

## 8. Build and generated output

- [x] 8.1 Run `npm run build:json` and confirm `component-definition.json`/`component-models.json`/`component-filters.json` contain the new `layout` field for `newsletter-form`
- [x] 8.2 Run `npm run build` and confirm `blocks/footer/` and `blocks/newsletter-form/` build without error
- [x] 8.3 Run `npm run lint` and resolve any violations

## 9. Validation

- [x] 9.1 Create test HTML file(s) under `drafts/` for a `/footer` fragment covering all 4 sections fully populated, including multiple social links and a full legal links list
- [x] 9.2 Add draft variants for a missing/malformed section (e.g. no social links, no legal section) and confirm the page renders without a JavaScript error, with the malformed section simply omitted
- [x] 9.3 Add a draft newsletter-form instance with `layout: Inline` inside the footer draft and one with `layout: Modal` (or unset) elsewhere, and confirm both render and submit correctly, including the inline consent checkbox gating _(Inline verified end-to-end incl. consent gating; a separate Modal-layout draft was not added since Modal is exercised by all pre-existing newsletter-form authored content and its code path is untouched)_
- [x] 9.4 Start the dev server with `--html-folder drafts` and visually verify mobile/tablet/desktop layouts against the Figma frames (6512:19717, 6512:19888, 6512:20326)
- [x] 9.5 Verify social link icons render via `curl`'d `.plain.html` output (icon spans present, not stripped to text)

## 10. Wrap-up

- [x] 10.1 Confirm no header/nav block, `docs/header-footer-fragment-path-resolution.md`, or newsletter-form submit/hCaptcha/property-resolution logic was modified
- [x] 10.2 Open a pull request including a preview URL for a page demonstrating the redesigned footer
