## Why

The header block has three layout coupling bugs that cause silent visual breakage when content changes:

1. **Desktop — zone positioning**: `.header-inner` uses `flex + space-between` with only two in-flow items (lang + CTA). Removing either one causes the remaining item to jump to the wrong position.
2. **Desktop — nav item positioning**: Nav item positions (`left`/`right` of emblem) are hardcoded per CSS class (`header-nav-link` vs `header-nav-drop-trigger`). Swapping a plain link to a dropdown (or vice versa) causes items to overlap or move to the wrong side.
3. **Mobile — accordion coupling**: The CSS rule that opens the mobile nav sub-list is hardcoded to `.is-destinations-expanded`. Any nav item with a dropdown other than "Destinations" will show a toggle but the list will never open.

## What Changes

- Replace `flex + space-between` on `.header-inner` with a CSS Grid 3-column layout so lang and CTA zones are independently anchored
- Replace class-based nav item positioning with `data-nav-side` attribute set by JS based on index, not content type
- Replace `is-{label}-expanded` class-on-panel pattern with `data-open` attribute set directly on the list element, making mobile accordions content-agnostic

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `header-desktop-layout`: `.header-inner` layout model changes from flex to grid; nav item positioning changes from type-coupled to index-based
- `header-mobile-accordion`: Mobile accordion open/close state moves from panel-level class to list-level data attribute

## Impact

- `blocks/header/header.css` — `.header-inner` layout rules, nav link/trigger positioning rules, mobile nav-list and lang-list open-state rules
- `blocks/header/header.js` — `buildNavZone()` sets `data-nav-side`; `buildMobilePanel()` uses `data-open` instead of `expandedClass` on panel
- No changes to fragment structure (`index.html`) or other blocks
- No breaking changes to visual design — layout appearance stays identical
