## MODIFIED Requirements

### Requirement: Desktop nav item positioning by index
Nav items SHALL be positioned relative to the emblem based on their index in the nav list, not their content type. Items with index < `Math.ceil(total/2)` SHALL be positioned to the left of the emblem via `data-nav-side="left"`; remaining items SHALL be positioned to the right via `data-nav-side="right"`. CSS SHALL target `[data-nav-side]` attributes, not class names.

#### Scenario: First item is a dropdown trigger
- **WHEN** the first nav item has a nested `<ul>` (renders as `header-nav-drop-trigger`)
- **THEN** it SHALL receive `data-nav-side="left"` and render to the left of the emblem

#### Scenario: First item is a plain link
- **WHEN** the first nav item has no nested `<ul>` (renders as `header-nav-link`)
- **THEN** it SHALL receive `data-nav-side="left"` and render to the left of the emblem

#### Scenario: Type swap does not change position
- **WHEN** a nav item changes from plain link to dropdown (or vice versa)
- **THEN** its horizontal position SHALL remain the same as before the type change

### Requirement: Mobile nav accordion open state by data attribute
The mobile nav sub-list (`header-mobile-nav-list`) and lang list (`header-mobile-lang-list`) SHALL use a `data-open` attribute on the list element itself to control visibility. Setting `data-open="true"` SHALL reveal the list; `data-open="false"` or absent SHALL hide it. CSS SHALL target `[data-open="true"]`, not panel-level class names derived from nav label text.

#### Scenario: Nav item with dropdown opens accordion
- **WHEN** user taps a `header-mobile-nav-toggle` for any nav item with a sub-list
- **THEN** that item's `header-mobile-nav-list` SHALL have `data-open="true"` set and become visible

#### Scenario: Only one accordion open at a time
- **WHEN** user taps a second accordion toggle while one is already open
- **THEN** the previously open list SHALL have `data-open="false"` set and the newly tapped list SHALL have `data-open="true"` set

#### Scenario: Nav item label does not affect accordion behaviour
- **WHEN** a nav item with a dropdown has any label (e.g. "Destinations", "Experiences", "Offers")
- **THEN** its accordion SHALL open and close correctly regardless of the label text
