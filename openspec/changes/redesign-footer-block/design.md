## Context

The redesign follows the Figma "Capella Revamp 2026" file (`2AVYi5QIYXJhL72SkC31P7`), reviewed at three frames: Desktop (node 6512:19717), Tablet (node 6512:19888), Mobile (node 6512:20326). Relevant repository constraints:

- The footer is a "system" block: it has no `_footer.json` / Universal Editor model and is auto-injected on every page. Its content is a shared fragment page resolved via `loadFragment()` at `/{site}/{lang}/footer`, per `docs/header-footer-fragment-path-resolution.md`. That resolution mechanism (metadata `<meta name="footer">`, falling back to URL-derived site/lang segments) is already fully specified under the `header-footer-lang-fallback` capability and is unchanged here.
- `loadFragment()` (`src/blocks/fragment/fragment.ts`) runs `decorateMain` + `loadSections` on the fragment before returning it, so any block inside `/footer` (e.g. `newsletter-form`) is already fully decorated and JS-executed by the time `footer.ts` sees the fragment DOM. `decorateIcons()` also already ran, converting `:iconname:` shortcodes into `<span class="icon icon-iconname"><img src="/icons/iconname.svg"></span>`. `footer.ts` therefore only relocates/rearranges already-built DOM — it does not rebuild the newsletter block or re-run icon decoration.
- Design tokens in `src/styles/tokens.css` mirror this Figma file 1:1, including the three breakpoints used everywhere else in the codebase: mobile ≤767px, tablet 768–1199px, desktop ≥1200px.
- The current `footer.ts` collects every `<ul>` in the fragment and flattens every `<li>` into a `.footer-item`, discarding any icon markup inside a link (`a.textContent = srcA.textContent?.trim()`). This is the one behavior that must NOT carry over: it would strip the social icon spans.
- `src/blocks/destination-introduction/destination-introduction.css` already uses `display: contents` on a wrapper to lift DOM children out of their wrapper and into an ancestor's CSS Grid at a given breakpoint — the same technique this change reuses for the desktop footer reflow.
- `newsletter-form.ts` documents its authored row order as a `ROW` index map (`src/blocks/newsletter-form/newsletter-form.ts`), consumed by `rowText`/`rowHTML`/`rowLink` helpers reading fixed indices from `[...block.children]`. Its current fields, in order: `title, salutationLabel, salutationOptions, firstNameLabel, lastNameLabel, emailLabel, countryLabel, countryOptions, consentMessage, submitLabel, propertyOptions, triggerLabel`.

## Goals / Non-Goals

**Goals:**

- Authors can compose the new footer fragment in Universal Editor as 4 fixed sections (nav columns, newsletter, contact + social, legal + copyright) and see it rendered per the Figma design at all three breakpoints.
- Social links keep their icon markup through decoration, so authors use the existing icon-shortcode convention instead of a new mechanism.
- The `newsletter-form` block can be placed inline in the footer with the new visual treatment, while every existing modal-mode page keeps rendering exactly as before.
- All new CSS is token-driven, matching the rest of the codebase's convention of never hardcoding Figma hex/px values.

**Non-Goals:**

- Any change to header/nav blocks or fragment path resolution.
- Any change to the newsletter form's submit endpoint, hCaptcha logic, or property/source resolution — only `layout` branching and inline-specific rendering/consent gating.
- RTL-specific work beyond the logical-property conventions already used in the codebase.
- A divider image asset — a CSS border is used instead (see Decisions).

## Decisions

### Footer fragment parsed as 4 fixed sections by index, not by tag/content sniffing

`footer.ts` reads `fragment` sections in author order and treats section 0 as nav columns, section 1 as the newsletter passthrough, section 2 as contact + social, and section 3 as legal + copyright. This mirrors the same "fixed index, not content sniffing" principle already established for block field rows (see the `destination-introduction` design), applied here at the section level because the footer fragment is a page, not a block: fragment content is section-addressable (`fragment.children` / `<div>` per section from `decorateMain`), and there is no other stable discriminator across the 4 groups since each contains ordinary Text/list/newsletter-form content.

A missing or malformed section (e.g. wrong child count, no list found) is skipped rather than throwing, matching the existing fail-soft posture of the current `footer.ts` (which already returns silently when no fragment is found at all).

### Preserve decorated icon markup on social links instead of `textContent`

The current code does `a.textContent = srcA.textContent?.trim()` for every link, which is correct for plain nav links but would delete the `<span class="icon ...">` markup `decorateIcons()` already produced for `:facebook:`-style shortcodes in the social list. The rewrite special-cases the contact + social section's link list: it clones/moves the source anchor's full child nodes (icon span + any trailing label text) instead of re-deriving `textContent`, while the nav-columns section (section 0) keeps the existing plain-text-link behavior since those links have no icons.

### Divider as CSS border, not an image asset

The Figma divider is a 1px line SVG. A plain `.footer-divider { border-top: 1px solid var(--color-stroke-...) }` element is visually equivalent and avoids an unnecessary network request and an extra icon asset to maintain. This is a deliberate approved deviation from using the literal Figma line-SVG asset.

### Desktop layout via `display: contents` reflow, matching `destination-introduction`

On desktop the visual order (Contact+Social | Nav column 1 | Nav column 2 | Newsletter) does not match the authored DOM order (Nav columns wrapper, containing both nav columns | Newsletter | Contact+Social | Legal). Rather than reordering the DOM (which would fight the natural authoring order — nav columns first reads naturally in Universal Editor) or duplicating markup per breakpoint, the nav-columns wrapper gets `display: contents` at the desktop breakpoint only, so its two `.footer-nav-col` children become direct grid items of the outer footer grid and can be placed with named `grid-area`s alongside the newsletter and contact+social groups. This is the same technique already in production in `destination-introduction.css`.

Two of the three dividers (the ones between nav-columns/newsletter and newsletter/contact+social in DOM order) sit inside the reflowed row and are hidden (`display: none`) at desktop only, since the Figma desktop frame shows no dividers within that row. The third divider (before legal + copyright) is a full-width separator at every breakpoint and is never hidden.

### `newsletter-form` gets a `layout` field instead of a second block

A new `layout` (select: `Modal` | `Inline`, default `Modal`) field is added to the existing block rather than creating a separate `newsletter-form-inline` block. The form-building logic (option fetching, property resolution, submit handling, hCaptcha) is identical between layouts; only the DOM shape, CSS classes, and consent-gating differ. A second block would duplicate all of that logic and require authors to pick the right block up front instead of a single toggle. `Modal` is the default so every existing authored `newsletter-form` instance (with no `layout` value populated) keeps its current behavior with no re-authoring.

Adding `layout` as a new authored field means it lands after the existing fields (following the file's own convention of appending new fields rather than inserting them, which would shift every later index). `ROW` gains a `LAYOUT: 12` entry; the file's existing block comment documenting `ROW` order is extended to mention it.

### Inline consent uses the same enable/disable gating pattern as hCaptcha

The `Inline` layout needs a required checkbox (not present in `Modal`, which uses text-only consent). Rather than inventing a new gating mechanism, the submit button's `disabled` state is driven by the checkbox's `change` event exactly the way `setupCaptcha`'s callback already toggles `submitBtn.disabled` for the hCaptcha widget — both hCaptcha (if configured) and the consent checkbox (if `Inline`) must be satisfied before the button is enabled, so the two conditions are combined with a shared re-check rather than each one unconditionally setting `disabled = false`.

### Field grouping breakpoints reuse the footer's own breakpoint tokens

The 3-column (Title/First name/Last name) and 2-column (Country/Email) grouping applies at tablet (≥768px) and desktop (≥1200px); mobile (≤767px) stacks every field. These are the same three breakpoints already defined in `src/styles/tokens.css` and used throughout the codebase, so no new breakpoint values are introduced.

### Social icons are downloaded assets, not hand-drawn

`icons/facebook.svg`, `icons/instagram.svg`, `icons/line.svg` are exported directly from the Figma node's image fills (`imgProperty1Facebook`, `imgProperty1Instagram`, `imgProperty1Line`) rather than redrawn, per the project's standing figma-design-to-code asset rule: use exported assets as-is, never leave a temporary Figma asset URL in code.

## Risks / Trade-offs

- **Section-index parsing breaks if an author reorders or merges the 4 fragment sections** → Accepted, matching the same trade-off already made for `/nav`'s fixed 2-section contract; mitigated by the new `docs/footer-authoring-guide.md` and a skip-not-throw fallback per section.
- **Preserving icon markup on social links (rather than `textContent`) means a plain-text link with stray inline markup would also be preserved verbatim** → Acceptable since the social list is documented as icon-shortcode links only; the nav-columns section keeps the stricter `textContent`-based behavior where no icons are expected.
- **`display: contents` has known quirks with certain CSS properties (e.g. it does not establish a containing block, and historically had accessibility bugs in some browsers)** → Accepted; the same technique is already shipping in `destination-introduction.css` with no reported issues.
- **Sharing one block for both layouts means a future `Modal`-only change must be careful not to affect `Inline` and vice versa** → Mitigated by keeping the two rendering paths in clearly separate functions/branches and CSS class namespaces (`.newsletter-overlay`/`.newsletter-dialog-*` for Modal, `.newsletter-inline` for Inline).

## Migration Plan

No migration for code: `footer.ts`/`footer.css` are rewritten in place (the footer has no author-facing model to version), and `newsletter-form`'s new `layout` field defaults to `Modal`, so every existing authored instance keeps rendering identically without any content edit. The `/footer` fragment content itself must be re-authored by content authors to the new 4-section structure per `docs/footer-authoring-guide.md`; until it is, sections that don't match the expected shape are skipped rather than causing an error, so the page keeps rendering (with fewer footer groups) rather than breaking.

Rollback is reverting the `footer.ts`/`footer.css`/`newsletter-form.ts`/`newsletter-form.css`/`_newsletter-form.json` changes, removing the 3 new icon assets and `docs/footer-authoring-guide.md`, and re-running `npm run build:json`.

## Open Questions

None outstanding — all decisions above were confirmed with the stakeholder during brainstorming. Judgment calls made without an explicit prior answer are called out in the proposal/PR for review:

- The exact `ROW.LAYOUT` index value (12) is a judgment call following the file's existing "append, don't insert" convention; if a different position is preferred, the index must be updated in the same commit as any reordering per the model-change rule already established for indexed blocks.
- Whether the consent checkbox's `required` attribute alone (native HTML validation) is sufficient or whether the submit button must ALSO stay disabled until checked (belt-and-braces, matching the hCaptcha pattern) — this design assumes both, matching the explicit gating requirement in the brainstorming notes.
