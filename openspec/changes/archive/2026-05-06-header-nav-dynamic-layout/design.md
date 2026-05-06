## Context

The header nav zone (`header-nav`) currently renders items with `position: absolute` and hardcoded coordinates (`left: calc(50% - 250px)` / `right: calc(50% - 250px)`). Nav items receive a `data-nav-side="left"/"right"` attribute assigned by index, but the CSS rule pins all left-side items to the same `left` value and all right-side items to the same `right` value — causing overlap when more than one item occupies the same side.

The previous change (`header-layout-robustness`) introduced `data-nav-side` as a type-decoupled mechanism. This change replaces the positioning model entirely while keeping `data-nav-side` as the routing signal.

## Goals / Non-Goals

**Goals:**
- Support any number of nav items on each side without CSS changes
- Maintain the centered emblem as a visual anchor that nav items never overlap
- Keep `gap: 20px` between items on the same side
- Preserve `data-nav-side` assignment logic in JS (no fragment changes)
- RTL-compatible: use logical CSS properties

**Non-Goals:**
- Changing the fragment structure (`/nav` document sections)
- Changing mobile panel layout
- Supporting more than one row of nav items (wrapping)
- Automated balancing of items between sides (author controls via fragment order + index split)

## Decisions

**Decision: Two flex sub-groups with a center dead zone**

Replace the flat `position: absolute` nav items with:

```
.header-nav (position: relative; display: grid; grid-template-columns: 1fr 200px 1fr; pointer-events: none)
├── .header-nav-left  (display: flex; justify-content: flex-end; gap: 20px; padding-inline-end: 20px; pointer-events: auto)
└── .header-nav-right (display: flex; justify-content: flex-start; gap: 20px; padding-inline-start: 20px; pointer-events: auto)
```

The center column is **200px** — wide enough to give the emblem clear breathing room on both sides. `.header-nav` uses `position: relative` (in normal grid flow of `.header-inner`) rather than `position: absolute; inset: 0`, because the outer `1fr auto 1fr` grid already centers the nav block symmetrically. Left group pushes items to the right edge of col 1; right group starts at the left edge of col 3. Gap between items is natural flex `gap`.

`pointer-events: none` on the nav container with `auto` on sub-groups ensures the dead zone doesn't block emblem click events if the emblem becomes interactive later.

JS change: `buildNavZone()` creates two `<div>` sub-groups inside `<nav>`. Items with `data-nav-side="left"` append to `.header-nav-left`, items with `"right"` append to `.header-nav-right`.

Alternatives considered:
- **Keep absolute + multi-position by index** (e.g., `data-nav-index` → `left: calc(50% - Xpx)` per index): requires updating CSS for every new item count; hardcodes N positions
- **Flex nav with `margin-inline: auto` spacers**: emblem not guaranteed to stay centered if content widths differ
- **CSS subgrid with named lines**: overkill for this use case; browser support edge cases in older Safari

**Decision: Alternating left/right item split**

Items are assigned to left/right groups by alternating index: `i % 2 === 0` → left, `i % 2 === 1` → right. This gives: item 0 → left, item 1 → right, item 2 → left, item 3 → right, etc. This is preferred over the `Math.ceil(total/2)` first-half/second-half split because it keeps each side balanced regardless of total item count, and mirrors author intent more intuitively ("every odd item goes right").

**Decision: Dropdown uses `position: fixed` for full-viewport width**

The `.header-nav-dropdown` panel uses `position: fixed` instead of `position: absolute`, so it spans the full viewport width (`left: 0; width: 100%`) regardless of how wide the `.header-nav` container is. This removes the need for the `::before` pseudo-element 2500px background hack. Background color and box-shadow are applied directly on `.header-nav-dropdown`. `top: var(--site-header-height, 70px)` keeps it flush below the sticky header.

**Decision: `padding-inline-end/start: 20px` as clearance from dead zone**

The 30px dead zone column provides structural separation. An additional `padding-inline-end: 20px` on the left group and `padding-inline-start: 20px` on the right group ensures the last item on each side has visual breathing room from the emblem, beyond just the column boundary.

## Risks / Trade-offs

- [Risk] Emblem is `width: 32px` but dead zone is 30px — emblem visually bleeds 1px into each group's padding area → Mitigation: 20px padding on each group provides sufficient clearance; visual overlap is imperceptible at this scale
- [Risk] If author adds many long-label items to one side, the group may push the other side's group out of view → Mitigation: nav labels are controlled content (short uppercase strings); acceptable for scope
- [Risk] `display: grid` on `.header-nav` adds a second grid context inside the outer `header-inner` grid → Mitigation: `.header-nav` sits in the `auto` column of the outer `1fr auto 1fr` grid; because col 1 = col 3 the nav block is naturally centered; no conflict

## Migration Plan

CSS and JS changes are confined to `blocks/header/`. No fragment or authoring changes required. Rollback by reverting the two files.
