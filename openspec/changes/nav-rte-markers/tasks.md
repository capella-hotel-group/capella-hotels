## 1. Marker parsing utility

- [x] 1.1 Add `NavMarker` type and `splitMarker(raw: string)` helper in `src/blocks/header/header.ts` (last `|`-separated token, exact case-insensitive match against `open-in-new-tab` / `open-in-same-tab` / `merge-columns`, else returns the text unchanged); verified by code review (no automated test suite for this block — Jest/`ts-jest` is broken in this repo's current dependency tree, unrelated to this change, and adding test infra was ruled out of scope)
- [x] 1.2 Add `openInNewTab: boolean` to `NavLink`, `NavLanguage`, `NavCategory`, and `mergeColumns: boolean` to `NavRegion`; verified `npm run build` (`tsc --noEmit`) has no type errors

## 2. Apply markers to logo link, CTA, languages, category link

- [x] 2.1 In `decorate()`, use the first authored button link for the logo and the last non-Close button link for Book; parse both labels and target markers and apply `target="_blank" rel="noopener"` when marked.
- [x] 2.2 Ignore authored links labeled `Close`; retain the built-in `CLOSE` menu control.
- [x] 2.3 Update `readLanguages` to parse each language item with `splitMarker(directText(item))` for both label and `openInNewTab`; update `buildLangZone` to set `target`/`rel` on the dropdown anchor when marked; verify against the sample content's 4 languages (2 marked new-tab, 2 same-tab)
- [x] 2.4 Update `readCategoryFromList` to parse the top-level category label/marker the same way; apply `openInNewTab` where `buildMenuCategories` builds a plain `<a>` for a link-only category; verified by code review (no top-level category in current sample content uses this path)

## 3. Apply markers to menu links and region labels

- [x] 3.1 Update `readLinkItem` to derive `{ label, openInNewTab }` via `splitMarker(directText(item))` instead of preferring `anchor.textContent`; verified by code review against a linked item with marker, a plain-text item with marker, and an item with no marker
- [x] 3.2 Update `buildLinkGrid` to set `target="_blank" rel="noopener"` on the anchor when `link.openInNewTab` is true; verify against `/nav.plain.html`'s destination lists (e.g. BANGKOK marked new-tab, HANOI marked same-tab)
- [x] 3.3 Update `readCategoryRegions` to parse each region's label via `splitMarker(directText(item))`, setting `label` and `mergeColumns`; verified by code review against a region label with `merge-columns`, one without, and the flat-links-grouped unlabeled region (which never carries a marker)

## 4. `merge-columns` grouping

- [x] 4.1 Implement `groupRegions(regions: NavRegion[]): NavRegion[][]` per design.md Decision 2/3 (pairwise-next merge, ignore a partner's own marker, no-op + `console.warn` when the last region is marked); verified by code review tracing: no markers, one marker mid-list, marker on the last region (warns), two independent marked pairs in one category, and a marker whose partner is also marked (partner's marker ignored)
- [x] 4.2 Verify `groupRegions` applied to the real `/nav` sample data produces `{MIDDLE EAST, UPCOMING}` merged (EUROPE alone) for "CAPELLA HOTELS AND RESORTS", and `{EUROPE, MIDDLE EAST}` merged (ASIA PACIFIC and UPCOMING alone) for "CAPELLA RESIDENCES" — the merge mechanism (both labels visible, shared row) was reviewed against the Figma reference (node `6968:25912`, file `Q6Euf4Qo9tlveuz4dNWtiJ`, which shows the merged-in label disappearing instead) and the user explicitly chose to keep both labels visible, an intentional divergence from that reference (see design.md Context)

## 5. Merged-row rendering and CSS

- [x] 5.1 Implement `flattenMergeSlots`/`chunk`/`buildMergedCell`/`buildMergedRows` and wire into `buildCategoryContent`: a group of 1 region renders exactly as before (unchanged `.header-menu-region` + `buildLinkGrid`); a group of 2 renders as `.header-menu-merged-row > .header-menu-merged-cell` with `MERGE_ROW_COLUMNS = 4`; every cell always renders a label paragraph (using `\u00a0` + `aria-hidden` when the slot has no real label) so link-only cells still align to the labeled cells' link row; verified by real-geometry DOM inspection at 1440px: all 4 cells' links share the same `top`
- [x] 5.2 Add `.header-menu-merged-row`/`.header-menu-merged-cell` CSS (block by default, `display:grid; grid-template-columns:repeat(4,minmax(0,1fr))` at `>=1200px`) and the shared `.header-menu-block` spacing class; switch `.header-menu-link-grid`'s `grid-template-columns` from fluid `auto-fit` to the same fixed `repeat(4, minmax(0,1fr))` at `>=1200px` (applies to every region, not just merged ones, matching the Figma reference's row-packing); add `max-width: 107px` + `overflow-wrap: break-word` to link/disabled-span text in both `.header-menu-link-grid` and `.header-menu-merged-cell` at that breakpoint, so a long label (e.g. "SHENZHEN(2029)") wraps instead of overflowing into the next column now that column width is fixed rather than content-driven; verified by real-geometry DOM inspection: `ASIA PACIFIC` wraps at 4 items/row, merged cells' computed `max-width` is `107px`

## 6. Build, lint, and full verification

- [x] 6.1 Run `npm run build` and `npm run lint`, fix any errors, and verify both pass
- [x] 6.2 Manually verify in the browser against `http://localhost:3000/nav.plain.html`-backed header: marked links open in a new tab, unmarked links stay same-tab, no "| marker" text is visible anywhere (CTA, Close, languages, menu links, region labels), both merged pairs show both labels side by side with links aligned to the same row, and long labels wrap instead of overflowing at desktop width
