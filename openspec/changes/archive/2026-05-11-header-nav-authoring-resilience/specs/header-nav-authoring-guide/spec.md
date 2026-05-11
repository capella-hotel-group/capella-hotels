## Purpose

Authoring rules for the `/nav` document used by the header block. Covers correct HTML structure for each section.

## Requirements

### Requirement: Nav document section structure
The `/nav` document SHALL have exactly 3 sections in order: (1) nav list, (2) CTA link, (3) logo picture.

#### Scenario: All sections present
- **WHEN** the `/nav` document is authored correctly
- **THEN** `sections[0]` SHALL contain a `<ul>` with Languages as `li[0]` and nav items as `li[1+]`
- **THEN** `sections[1]` SHALL contain an `<a>` for the CTA button
- **THEN** `sections[2]` SHALL contain a `<picture>` for the logo

### Requirement: Languages list is a nested list under first nav item
The first `<li>` in the main `<ul>` SHALL be the Languages item, containing a nested `<ul>` of language options. Each language option SHALL be an `<li>` containing an `<a>` with the correct `href`.

#### Scenario: Language item with links
- **WHEN** the Languages item is authored with nested `<li><a href>` entries
- **THEN** the language selector dropdown SHALL render all language options with correct hrefs

### Requirement: Destinations sub-categories are items in one nested list
The Destinations `<li>` SHALL contain exactly **one** `<ul>`, with each sub-category group as a `<li>` inside that `<ul>`. Multiple sibling `<ul>` elements under the same Destinations `<li>` are incorrect authoring.

#### Scenario: Single nested list with multiple sub-categories
- **WHEN** Destinations contains one `<ul>` with three `<li>` sub-category items
- **THEN** all three sub-categories SHALL appear as tabs in the mega-menu dropdown

#### Scenario: Multiple nested lists — partially recovered
- **WHEN** Destinations contains multiple sibling `<ul>` elements
- **THEN** `buildDropdown()` SHALL merge all `<li>` items from all `<ul>` siblings into the dropdown
- **THEN** a `console.warn(`[header] "${label}": multiple nested lists detected — merge applied. Fix authoring in /nav.`)` SHALL be logged (using the nav item's label, not hardcoded `'Destinations'`)

### Requirement: Plain nav items (e.g. Experiences) are items in the main list with paragraph wrapper
A plain nav item WITHOUT sub-categories SHALL be a `<li>` in the main `<ul>`, containing a `<p>` element. The `<p>` may contain a plain text label or an `<a>` for a linked nav item.

#### Scenario: Plain nav link authored correctly
- **WHEN** a plain nav item is authored as `<li><p><a href>Label</a></p></li>` in the main list
- **THEN** it SHALL render as a `header-nav-link` anchor in the correct nav side

#### Scenario: Plain nav item in separate list — recovered
- **WHEN** a plain nav item is placed in a second sibling `<ul>` outside the main list
- **THEN** `decorate()` SHALL collect it along with items from the first `<ul>`
- **THEN** it SHALL render in the header as expected
