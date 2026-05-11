## ADDED Requirements

### Requirement: Authoring guide for nav document structure
The repository SHALL contain `docs/header-nav-authoring-guide.md` documenting the correct HTML structure for the `/nav` document, with explicit ✅/❌ examples for each structural rule.

#### Scenario: Guide exists in repo
- **WHEN** a developer or author needs to understand the `/nav` document structure
- **THEN** `docs/header-nav-authoring-guide.md` SHALL exist and cover: Languages list, Destinations sub-categories (single nested list), Experiences (item in main list with `<p>` wrapper), CTA section, Logo section

---

## MODIFIED Requirements

### Requirement: Desktop nav item positioning by index
Nav items SHALL be collected from **all** `<ul>` elements directly under `sections[0]` (not only the first `<ul>`), then positioned relative to the emblem based on their index. Items at even index (`i % 2 === 0`) SHALL be assigned `data-nav-side="left"` and appended to `.header-nav-left`; items at odd index SHALL be assigned `data-nav-side="right"` and appended to `.header-nav-right`.

If no lang list or no nav items are found after collecting, the system SHALL log a `console.warn` with a `[header]` prefix and hide the header block.

#### Scenario: First item is a dropdown trigger
- **WHEN** the first nav item has a nested `<ul>` (renders as `header-nav-drop-trigger`)
- **THEN** it SHALL receive `data-nav-side="left"` and render inside `.header-nav-left`

#### Scenario: First item is a plain link
- **WHEN** the first nav item has no nested `<ul>` (renders as `header-nav-link`)
- **THEN** it SHALL receive `data-nav-side="left"` and render inside `.header-nav-left`

#### Scenario: Type swap does not change position
- **WHEN** a nav item changes from plain link to dropdown (or vice versa)
- **THEN** its side assignment SHALL remain the same as before the type change

#### Scenario: Nav items split across multiple root lists
- **WHEN** `sections[0]` contains multiple sibling `<ul>` elements (e.g. Destinations in `<ul>` 1, Experiences in `<ul>` 2)
- **THEN** items from all `<ul>` elements SHALL be collected in DOM order and processed as a single flat list
- **THEN** the header SHALL render all nav items, not only those in the first `<ul>`

#### Scenario: Missing lang list — warn and hide
- **WHEN** `sections[0]` contains no language nested list
- **THEN** `console.warn('[header] Nav structure invalid: missing language list. Check /nav document.')` SHALL be logged
- **THEN** the header block SHALL be hidden

---

## ADDITIONAL Requirements (discovered during implementation)

### Requirement: AEM EDS default-content-wrapper compatibility
`decorate()` SHALL locate the nav content root via `sections[0].querySelector('.default-content-wrapper') ?? sections[0]` before querying `':scope > ul'`. This is required because `decorateSections()` in `aem.js` wraps all section children inside a `div.default-content-wrapper` after fragment decoration.

#### Scenario: Fragment decorated by AEM EDS
- **WHEN** `loadFragment()` returns a fragment whose section children have been wrapped in `div.default-content-wrapper`
- **THEN** `decorate()` SHALL still find and collect all nav `<ul>` elements correctly

### Requirement: Active language detection in language trigger
`buildLangZone()` SHALL set the trigger label to the language option whose `href` matches the current page path, not always the first option.

#### Scenario: Current page is an Arabic page
- **WHEN** `window.location.pathname` starts with the `href` of the Arabic language option
- **THEN** the `header-lang-trigger` SHALL display the Arabic option label (e.g. `'Arabic'`)

#### Scenario: No href matches current path
- **WHEN** no language option href matches `window.location.pathname`
- **THEN** the trigger SHALL fall back to the first language option label

### Requirement: Plain nav item without `<p>` wrapper renders as link
A plain nav `<li>` that contains a direct `<a>` child with no `<p>` wrapper SHALL still render as a `header-nav-link`. Both `buildNavZone()` and `buildMobilePanel()` SHALL fall back to `srcItem.querySelector(':scope > a')` when no `<p>` is present.

#### Scenario: Nav item is `<li><a href>Label</a></li>` (no `<p>`)
- **WHEN** a plain nav item has a direct `<a>` child without a `<p>` wrapper
- **THEN** it SHALL render as a `header-nav-link` with the correct `href` and label on both desktop and mobile

### Requirement: Mobile accordion merges multiple nested lists
`buildMobilePanel()` SHALL apply the same `querySelectorAll(':scope > ul')` + `flatMap` merge as `buildDropdown()`. A nav item with multiple sibling `<ul>` children SHALL produce a mobile accordion with all sub-category items merged.

#### Scenario: Destinations with 3 `<ul>` siblings — mobile view
- **WHEN** Destinations contains 3 sibling `<ul>` elements
- **THEN** the mobile accordion list SHALL contain all sub-category headings and links from all 3 lists

### Requirement: Language option without `<a>` tag renders as clickable link
A language list item without an `<a>` tag (e.g. `<li>English</li>`) SHALL render as `<a href="#">English</a>` in the dropdown, making it keyboard-accessible and styleable consistently.

#### Scenario: Language item is plain text
- **WHEN** a language `<li>` contains only text content and no `<a>` element
- **THEN** the rendered dropdown item SHALL be an `<a href="#">` wrapping the text
