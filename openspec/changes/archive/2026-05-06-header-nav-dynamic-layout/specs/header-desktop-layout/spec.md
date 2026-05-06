## MODIFIED Requirements

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
