## Why

BE added new authoring conventions to the `/nav` RTE content — a `|` separator
followed by one of three marker keywords (`open-in-new-tab`, `open-in-same-tab`,
`merge-columns`) — to let authors control link tab-target behavior and group a
small mega-menu region onto a shared row with an adjacent region (e.g. "MIDDLE
EAST" + "UPCOMING" side by side) instead of each getting a full-width row of
its own. The header block currently has no concept of these markers, so they
render literally as visible text (e.g. "HANOI | open-in-same-tab") and have no
effect on link behavior or layout.

Note: `openspec/specs/header-nav-authoring-guide`, `header-desktop-layout`, and
`header-nav-zones` describe an earlier two-zone alternating-side nav layout that
does not match the current `src/blocks/header/header.ts` implementation (categories

- regions + rail/panel mega-menu). That drift predates this change and is out of
  scope here — this proposal introduces a new, self-contained capability rather than
  patching specs that no longer reflect the shipped header.

## What Changes

- Parse a trailing `| <marker>` from the last `|`-separated segment of the relevant
  text (CTA "Book" label, mobile "Close" label, each language link, each menu link,
  each region label, each top-level category link). Unrecognized trailing text is
  left as part of the label (only the 3 known keywords are treated as markers).
- Apply `target="_blank" rel="noopener"` to any link marked `open-in-new-tab`;
  `open-in-same-tab` (or no marker) leaves the default (no `target` attribute). The
  mobile "Close" label only has its marker stripped — it isn't a real link, so no
  tab-target behavior applies there.
- Implement `merge-columns`: a region marked `merge-columns` groups with the one
  region immediately after it (pairwise only, no chaining) into a shared row of
  up to 4 columns — both regions' labels stay visible, each above its own first
  link; extra links spill into the following column(s) without repeating a
  label. This is a deliberate, user-confirmed divergence from the Figma
  reference, which shows the merged-in region's label disappearing entirely
  (see design.md Context). A marked region with no following region is a
  no-op (renders normally, `console.warn`).
- Switch `.header-menu-link-grid` from a fluid `auto-fit` column count to a
  fixed 4-column grid at the desktop breakpoint, and cap each link's title to
  a `max-width` that wraps long labels onto a second line instead of
  overflowing into the next column — both needed once column count and width
  are fixed rather than content-driven.

## Capabilities

### New Capabilities

- `header-nav-markers`: parsing and stripping the `|`-separated marker convention
  from `/nav` content; applying `open-in-new-tab`/`open-in-same-tab` tab-target
  behavior to CTA/language/menu links; grouping `merge-columns`-marked regions
  onto a shared, fixed-4-column row with the adjacent region, both labels
  visible.

### Modified Capabilities

- (none — see the stale-spec note above; no existing spec file accurately
  describes current header.ts behavior to modify)

## Impact

- `src/blocks/header/header.ts`: marker parsing helper, updated `NavLink`/
  `NavLanguage`/`NavRegion`/`NavCategory` interfaces, `groupRegions()` +
  `flattenMergeSlots()`/`chunk()`/`buildMergedCell()`/`buildMergedRows()` for
  the shared-row layout, `target`/`rel` handling in
  `buildCtaZone`/`buildLangZone`/`buildLinkGrid`.
- `src/blocks/header/header.css`: new `.header-menu-merged-row`/`-cell` rules
  and shared `.header-menu-block` spacing class; `.header-menu-link-grid`
  switches from fluid `auto-fit` to a fixed 4-column grid at the `>=1200px`
  breakpoint; link titles capped to `max-width: 107px` with word-wrap at that
  same breakpoint.
- No content-model (`_*.json`) changes — markers are plain RTE text, not new
  authorable fields.
