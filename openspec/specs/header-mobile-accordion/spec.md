## Purpose

Specifies the mobile accordion behaviour in the slide-down panel: open/close state management for nav sub-lists and the language list.

## Requirements

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
