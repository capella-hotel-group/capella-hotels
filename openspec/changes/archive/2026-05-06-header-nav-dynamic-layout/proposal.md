## Why

The current nav layout in `.header-nav` uses `position: absolute` with hardcoded `left: calc(50% - 250px)` / `right: calc(50% - 250px)` to place items around the centered emblem. This works for exactly 2 items (1 left, 1 right) but breaks when a third nav item is added — multiple items on the same side overlap at the same coordinate. The layout cannot accommodate a dynamic number of nav items without CSS changes.

## What Changes

- Replace the single flat `header-nav` with two sub-groups: `header-nav-left` and `header-nav-right`
- Each group uses `display: flex` with `gap: 20px` — items self-distribute dynamically
- A center dead zone of 30px is reserved around the emblem so no item can overlap it
- Remove hardcoded `left: calc(...)` / `right: calc(...)` positioning rules
- JS `buildNavZone()` routes items into left/right group based on `data-nav-side` (existing logic, unchanged)
- Result: adding or removing nav items requires no CSS changes

## Capabilities

### New Capabilities

- `header-nav-zones`: Two-group nav zone layout with dynamic item distribution and a protected center dead zone for the emblem

### Modified Capabilities

- `header-desktop-layout`: The nav positioning requirement changes — from absolute hardcoded coordinates to flex-based dynamic grouping

## Impact

- `blocks/header/header.js` — `buildNavZone()` needs to create left/right sub-groups instead of a flat nav
- `blocks/header/header.css` — remove `[data-nav-side]` absolute rules, add `.header-nav-left` / `.header-nav-right` flex rules, add dead zone
- `openspec/specs/header-desktop-layout/spec.md` — nav item positioning requirement updated
- No changes to fragment structure (`/nav` document) or authoring workflow
- No changes to mobile panel
