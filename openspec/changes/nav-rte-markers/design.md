## Context

`src/blocks/header/header.ts` reads authored content from the `/nav` fragment
(chrome section: logo, language list, CTA; menu section: one `<ul>` per top-level
category, each with nested `<li>` regions) and rebuilds fresh DOM for the header UI
— it never reuses the source elements' text nodes directly, always setting
`textContent` explicitly from parsed fields. BE now appends `| <marker>` to the
end of labels/links in this source content (see proposal.md - Why).

**Note on the merge layout's history:** the Figma reference (node `6968:25912`
in file `Q6Euf4Qo9tlveuz4dNWtiJ`, "Capella Revamp 2026") shows a merged-in
region with **no visible label of its own** — its links simply pool into the
link list of the region it merges into. This implementation was built exactly
that way at one point. The user then explicitly reviewed that result and
decided — as an informed, deliberate override of the Figma reference for this
one detail — to keep **both regions' labels visible side by side** instead
(see Decision 3). The final implementation therefore intentionally diverges
from the Figma reference on label visibility, while everything else
(marker parsing, tab-target behavior, the pairwise merge direction, the fixed
4-column grid) still matches it.

## Goals / Non-Goals

**Goals:**

- Single parsing helper reused everywhere a marker can appear, so behavior is
  consistent regardless of whether the marker sits inside an anchor's own text
  (CTA) or as sibling text after an anchor (language/menu items).
- A merged pair of regions renders as one row with up to `MERGE_ROW_COLUMNS`
  (4) columns: each region keeps its own label above its first link; any
  additional links spill into the following column(s) of the same row without
  repeating a label. Applies identically at every viewport (no desktop-only
  branch in JS — the row simply stacks to one column per breakpoint via CSS).
- Minimize regression risk: the common single-region case keeps its exact
  current DOM/CSS path unchanged.

**Non-Goals:**

- No RTE/authoring UI changes (BE-owned).
- No fix for the pre-existing drift between `openspec/specs/header-nav-*` and the
  current header implementation (see proposal.md note) — out of scope here.
- No support for merge chains longer than 2 regions (explicitly confirmed with
  the user as pairwise-only).

## Decisions

**Decision 1: Parse markers from the closest container's full `textContent`, not the anchor's.**
The marker can be either inside the anchor's own text (`<a>Book | open-in-new-tab</a>`)
or a sibling text node after the anchor (`<a href="/en">English</a> | open-in-new-tab`).
Always splitting the enclosing `<li>`/`<p>` (via the existing `directText()` helper,
which already excludes nested `<ul>`/`<ol>`) on the last `|` handles both shapes
with one code path, since the anchor's own text is always a prefix of the
container's full text.

- Alternative considered: special-case "marker inside anchor" vs "marker as
  sibling" separately. Rejected — more code paths for no behavioral difference.

**Decision 2: `groupRegions()` merges a marked region with the region immediately after it only (pairwise).**
Confirmed with the user against the real two example categories on `/nav`
(`MIDDLE EAST` marked in one, `EUROPE` marked in the other) — see proposal.md's
stale-spec note; this is a product decision, not inferred from ambiguous wording.
A region already consumed as a merge partner has its own `merge-columns` marker
ignored, preventing 3+ region chains.

- Alternative considered: marked region merges backward into its preceding
  sibling's row (chains indefinitely for consecutive marks). Rejected per
  explicit user decision — simpler pairwise rule was chosen instead.
- Alternative considered: unbounded forward chaining (every marked region pulls
  in all following regions until an unmarked one is hit). Rejected — user
  explicitly scoped this to exactly one adjacent region.

**Decision 3 (final): merged pair renders as a shared row of labeled slots, both labels visible.**
`groupRegions()` returns groups of 1 or 2 regions. A group of 1 renders exactly
as today (`.header-menu-region` + `.header-menu-link-grid`, untouched). A group
of 2 is flattened into slots (`flattenMergeSlots`): each region contributes one
label+first-link slot, then one link-only slot per remaining link; slots are
chunked into rows of `MERGE_ROW_COLUMNS = 4` (`buildMergedRows`/`buildMergedCell`,
rendered as `.header-menu-merged-row > .header-menu-merged-cell`). A
link-only cell still renders an empty (non-breaking-space) label paragraph —
not just an omitted one — because a fully empty `<p>` collapses to zero height
and breaks link-row alignment across cells; the invisible placeholder reserves
the same vertical space as a real label so every cell's link lands on the same
row (`aria-hidden="true"` keeps it out of the accessibility tree).

- Alternative considered (built, then reverted, then restored): pool both
  regions' links into one flat list under a single surviving label, matching
  the Figma reference exactly and reusing `.header-menu-region`/
  `.header-menu-link-grid` with zero new markup. Rejected in the end — the
  user reviewed this against the Figma screenshot and explicitly decided to
  keep both labels visible instead (see Context note above), despite Figma
  showing otherwise.

**Decision 5: `.header-menu-link-grid` is a fixed 4-column grid at the desktop breakpoint, not fluid auto-fit.**
The pre-existing `repeat(auto-fit, minmax(150px, 1fr))` rule only fits 3 columns
in the rail's actual content-pane width at `>=1200px`, one short of the Figma
reference (node `6968:25912`), which shows every region — merged or not —
wrapping at exactly 4 items per row. Switched to `repeat(4, minmax(0, 1fr))` at
that breakpoint only; smaller breakpoints keep the fluid auto-fit (their
narrower single-column panel layout doesn't have the same fixed-column
reference to match). This is what makes "pack the next region's items into the
same row when there's room" (the user's stated mental model) land on the same
row _count_ as Figma, not just the same row-packing _behavior_.

**Decision 6: Cap each link's title to `max-width: 107px` at the desktop breakpoint, wrapping long labels onto a second line.**
Fixing the grid to 4 equal columns (Decisions 3 and 5) means a column's
rendered width is no longer guaranteed to fit an unbreakable long label (e.g.
"SHENZHEN(2029)") — without a width cap the text would overflow past the
column boundary into the next one instead of wrapping. `max-width: 107px`
(matching the effective rendered column width in the rail's content pane) plus
`overflow-wrap: break-word` forces long labels to wrap onto a second line
within their own column instead of overflowing sideways. Applies to link text
in both `.header-menu-link-grid` and `.header-menu-merged-cell`.

## Risks / Trade-offs

- [Risk] The merge _direction_ (Decision 2) was resolved by explicit user
  confirmation rather than an unambiguous statement from BE, since BE's written
  description and the actual authored sample content point in different
  directions → Mitigation: cross-checked against the Figma reference for the
  overall mechanism; if BE still intends a different direction, only
  `groupRegions()` needs to change — isolated function, no ripple into
  rendering or CSS.
- [Accepted trade-off] Showing both labels (Decision 3) is a deliberate,
  explicit deviation from the Figma reference, not an oversight — recorded here
  so a future reviewer doesn't "fix" it back to match Figma without checking
  with the user first.
- [Risk] `MERGE_ROW_COLUMNS = 4` and the `107px` link max-width are both
  hardcoded to match the current Figma reference's column proportions →
  Mitigation: named constant / single CSS value, trivial to change together if
  the reference changes.

## Migration Plan

Both files changed (`header.ts`, `header.css`) live in the same block; no
content-model or server-side changes. Rollback is reverting these two files —
existing `/nav` content with markers would then simply show the raw `| marker`
text again (same as today, pre-change), no data loss.

## Open Questions

- None outstanding — the merge direction and row/column mechanics are
  confirmed against the Figma reference (node `6968:25912`); label visibility
  is a deliberate user override of that same reference (see Context).
