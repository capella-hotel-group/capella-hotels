## Purpose

Defines the `|`-separated marker convention authors use in `/nav` RTE content to
control link tab-target behavior and to merge small mega-menu regions onto a
shared visual row, and how the header block must interpret it.

## ADDED Requirements

### Requirement: Header button role selection

The first authored button link in the header bar SHALL provide the logo's accessible
label, destination, and target marker. If it is absent, the logo SHALL link to the active
language URL and use the default accessible label. The last authored button link not
labeled `Close` SHALL provide the Book CTA's label, destination, and target marker.
Authored links labeled `Close` SHALL be ignored; the menu SHALL use its built-in Close
control.

#### Scenario: Logo and Book links use their authored values

- **WHEN** the first header button link is authored for the logo and the last non-Close button link is authored for Book
- **THEN** each rendered link SHALL use its authored label, href, and target marker

### Requirement: Marker parsing and stripping

Any label, link text, or region heading authored in `/nav` MAY end with a trailing
`| <marker>` segment, where `<marker>` is exactly one of `open-in-new-tab`,
`open-in-same-tab`, `merge-columns` (case-insensitive, surrounding whitespace
ignored). The header block SHALL strip this trailing segment from the rendered
label and SHALL NOT display it as visible text. If the text after the last `|`
does not exactly match one of these three keywords, the header block SHALL leave
the text unchanged (no stripping, no marker applied).

#### Scenario: Recognized marker on a linked item

- **WHEN** a menu item is authored as `<li><a href="/x">BANGKOK</a> | open-in-new-tab</li>`
- **THEN** the rendered link text SHALL be exactly "BANGKOK", with no visible "|" or marker text

#### Scenario: Recognized marker on a plain-text item

- **WHEN** a menu item is authored as `<li>HANOI | open-in-same-tab</li>` with no link
- **THEN** the rendered label SHALL be exactly "HANOI"

#### Scenario: Marker embedded in the anchor's own text

- **WHEN** the header CTA is authored as `<a href="...">Book | open-in-new-tab</a>`
- **THEN** the rendered CTA label SHALL be exactly "Book"

#### Scenario: Marker embedded in the logo link

- **WHEN** the logo link is authored as `<a href="/home">Home | open-in-new-tab</a>`
- **THEN** its accessible label SHALL be exactly "Home", with no visible marker text

#### Scenario: Unrecognized trailing token is not stripped

- **WHEN** an item's text ends with `| some-other-text` that does not match any of the 3 known keywords
- **THEN** the full original text SHALL render unchanged, including the `|`

### Requirement: Tab-target behavior from marker

A link whose closest container text carries the `open-in-new-tab` marker SHALL
render with `target="_blank" rel="noopener"`. A link marked `open-in-same-tab`, or
with no marker at all, SHALL render with no `target` attribute (default same-tab
navigation). This applies to the header CTA, every language switcher link, every
top-level category link, every menu link, and the logo link. The menu Close control is
built in and is not an authored navigation link.

#### Scenario: Language link marked open-in-new-tab

- **WHEN** a language item is authored as `<a href="/jp">日本語</a> | open-in-new-tab`
- **THEN** the rendered language link SHALL have `target="_blank"` and `rel="noopener"`

#### Scenario: Menu link marked open-in-same-tab

- **WHEN** a menu link is authored with `| open-in-same-tab`
- **THEN** the rendered link SHALL have no `target` attribute

#### Scenario: Authored Close link is ignored

- **WHEN** an authored header button link is labeled `Close`
- **THEN** it SHALL be ignored when selecting the Book CTA, and the built-in menu Close control SHALL remain in use

### Requirement: Region merge-columns grouping

A mega-menu region whose label carries the `merge-columns` marker SHALL be
grouped with the ONE region immediately following it in that category's region
list only when flattening the pair produces 4 or fewer column slots (pairwise
merge only — no chaining beyond one adjacent region). If the pair produces more
than 4 slots, the marker SHALL be ignored and both regions SHALL render separately
with all links preserved. Both regions keep their own visible label. If the region
immediately following an already-merged partner also carries `merge-columns`,
that marker SHALL be ignored (a region can be consumed as a merge partner at
most once). If a region marked `merge-columns` is the last region in its
category (no following region), it SHALL render as an ordinary, unmerged
region (with its own label), and a `console.warn` SHALL be logged. Merging
SHALL NOT cross category boundaries.

#### Scenario: Marked region groups with the next region, both labels kept

- **WHEN** a category's regions are `EUROPE`, `MIDDLE EAST (merge-columns)`, `UPCOMING`
- **THEN** `MIDDLE EAST` and `UPCOMING` SHALL render together in a shared row, both labels visible
- **THEN** `EUROPE` SHALL render as its own, separate labeled region

#### Scenario: Marked region is the last region

- **WHEN** the last region in a category carries `merge-columns`
- **THEN** it SHALL render as its own, unmerged region with its own label
- **THEN** a `console.warn` SHALL be logged

#### Scenario: Merge partner also marked

- **WHEN** regions are `A (merge-columns)`, `B (merge-columns)`, `C`
- **THEN** `A` and `B` SHALL render together in a shared row, both labels visible (B's own `merge-columns` marker is ignored)
- **THEN** `C` SHALL render as its own, unmerged region

### Requirement: Merged row column layout

A merged pair of regions SHALL render as a row of 4 or fewer columns: each region
contributes one column carrying its own label above its first link; any
additional links belonging to a region in the pair SHALL occupy the following
column(s) of the same row without repeating that region's label. A column
with no label (an extra link from the region on its left) SHALL still reserve
the same vertical space a label would occupy, so every column's link lands on
the same row.

#### Scenario: Both regions' labels appear side by side

- **WHEN** two regions are merged
- **THEN** both regions' labels SHALL appear in the same row, each above its own first link

#### Scenario: A merged region's extra links spill into following columns

- **WHEN** a merged region has more than one link
- **THEN** its first link SHALL appear in the column under its label, and each additional link SHALL occupy the next column in the same row, without a repeated label, and SHALL align to the same row as the labeled columns' links

### Requirement: Link title width cap on desktop

At the desktop breakpoint, each link's rendered title SHALL be capped to a
maximum width matching its grid column, wrapping onto a second line instead of
overflowing into an adjacent column when the label is long and unbreakable.

#### Scenario: Long label wraps instead of overflowing

- **WHEN** a link's label (e.g. "SHENZHEN(2029)") is wider than its column at the desktop breakpoint
- **THEN** the label SHALL wrap onto a second line within its own column
- **THEN** the label SHALL NOT visually overflow into the neighboring column
