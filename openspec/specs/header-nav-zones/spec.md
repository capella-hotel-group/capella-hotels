## Purpose

Specifies the two-group nav zone layout within `.header-nav`: left sub-group, center dead zone, right sub-group. Covers flex group structure, dead zone sizing, emblem protection, and mega-menu dropdown positioning.

## Requirements

### Requirement: Nav zone two-group layout
The `.header-nav` element SHALL render as a `position: relative` grid container (`grid-template-columns: 1fr 200px 1fr`) sitting in the natural grid flow of `.header-inner`. It contains two flex sub-groups — `.header-nav-left` and `.header-nav-right` — separated by a center dead zone column of **200px**. The dead zone SHALL coincide with the emblem's horizontal center so that no nav item can overlap the emblem. Items in each group SHALL be spaced with `gap: 20px`.

#### Scenario: Multiple items on the same side
- **WHEN** two or more nav items have `data-nav-side="left"`
- **THEN** they SHALL render side-by-side in `.header-nav-left` with `gap: 20px` between them, without overlapping

#### Scenario: Single item on one side
- **WHEN** only one nav item has `data-nav-side="right"`
- **THEN** it SHALL render at the leftmost position of `.header-nav-right`, adjacent to the dead zone

#### Scenario: Dead zone protects emblem
- **WHEN** any number of nav items are present on either side
- **THEN** no nav item SHALL overlap the 200px center dead zone where the emblem is positioned

#### Scenario: Items distribute without CSS change
- **WHEN** a nav item is added to either side via the fragment
- **THEN** existing items SHALL reflow with consistent `gap: 20px` spacing without any CSS modification

### Requirement: Desktop nav item positioning by index
Nav items SHALL be positioned relative to the emblem based on their index in the nav list, not their content type. Items at **even index** (`i % 2 === 0`: 0, 2, 4, …) SHALL be assigned `data-nav-side="left"` and appended to `.header-nav-left`; items at **odd index** (`i % 2 === 1`: 1, 3, 5, …) SHALL be assigned `data-nav-side="right"` and appended to `.header-nav-right`. This produces an alternating left/right assignment (item 0 → left, item 1 → right, item 2 → left, …). Positioning SHALL be determined by flex group membership, not by absolute CSS coordinates.

#### Scenario: First item is a dropdown trigger
- **WHEN** the first nav item has a nested `<ul>` (renders as `header-nav-drop-trigger`)
- **THEN** it SHALL receive `data-nav-side="left"` and render inside `.header-nav-left`

#### Scenario: First item is a plain link
- **WHEN** the first nav item has no nested `<ul>` (renders as `header-nav-link`)
- **THEN** it SHALL receive `data-nav-side="left"` and render inside `.header-nav-left`

#### Scenario: Type swap does not change position
- **WHEN** a nav item changes from plain link to dropdown (or vice versa)
- **THEN** its side assignment SHALL remain the same as before the type change

### Requirement: Mega-menu dropdown is full viewport width
The `.header-nav-dropdown` panel SHALL use `position: fixed` (not `position: absolute`) so that it spans the full viewport width (`width: 100%`) regardless of the width of its parent nav container. It SHALL appear directly below the sticky header (`top: var(--site-header-height, 70px)`). Background color and box-shadow SHALL be applied directly on `.header-nav-dropdown` (no `::before` pseudo-element hack needed).

#### Scenario: Dropdown wider than nav container
- **WHEN** the nav container is narrower than the viewport
- **THEN** the open dropdown SHALL still span the full viewport width, not be clipped to the nav container
