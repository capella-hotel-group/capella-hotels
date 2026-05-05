## Purpose

Specifies the three-zone desktop layout of `.header-inner`: language selector (left), brand nav + emblem (center), CTA (right). Covers grid structure and nav item positioning.

## Requirements

### Requirement: Header inner zone layout
The `.header-inner` element SHALL use CSS Grid with three columns (`1fr auto 1fr`) so that the language zone (col 1), nav zone (col 2), and CTA zone (col 3) are independently anchored. Removing either the language zone or the CTA zone SHALL NOT affect the position of the remaining zone.

#### Scenario: Both lang and CTA present
- **WHEN** both `.header-lang` and `.header-cta` are rendered
- **THEN** lang SHALL be left-aligned in col 1, nav SHALL be centered in col 2, CTA SHALL be right-aligned in col 3

#### Scenario: Lang zone absent
- **WHEN** `.header-lang` is not rendered
- **THEN** nav SHALL remain centered and CTA SHALL remain right-aligned

#### Scenario: CTA zone absent
- **WHEN** `.header-cta` is not rendered
- **THEN** lang SHALL remain left-aligned and nav SHALL remain centered

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
