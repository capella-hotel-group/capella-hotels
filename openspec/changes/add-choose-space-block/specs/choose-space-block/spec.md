## ADDED Requirements

### Requirement: Block authoring model

The `choose-space` block SHALL expose three block-level fields and a repeatable `space-option`
item, and its field names SHALL be chosen so that no field is lost to the cell-collapse rule.

Block-level fields, in order: `anchorId` (text), `title` (richtext), and an element group of
`exploreCta` (text) + `exploreCta_link` (aem-content) + `exploreCta_openInNewTab` (boolean).

Item `space-option` fields, in order: `label` (text), `thumbnail` (reference) + `thumbnailAlt`
(text), `media` (select `image`|`video`), `mediaAsset` (reference, required) + `mediaAssetAlt`
(text), `mediaAssetMobile` (reference, optional), `eyebrow` (text), `title` (richtext),
`description` (richtext), an element group of `primaryCta` + `primaryCta_link` +
`primaryCta_openInNewTab`, and an element group of `secondaryCta` + `secondaryCta_link` +
`secondaryCta_openInNewTab`.

#### Scenario: Block-level fields produce three rows

- **WHEN** a `choose-space` block is published with no items
- **THEN** the delivered markup contains exactly three rows, one per block-level field or element
  group

#### Scenario: Each item produces one row of ten cells

- **WHEN** a `space-option` item is authored
- **THEN** it is delivered as a single row whose cells are, in order: label, thumbnail, media type,
  desktop media, mobile media, eyebrow, title, description, primary CTA, secondary CTA

#### Scenario: Empty optional fields still occupy their cell

- **WHEN** an author leaves `mediaAssetMobile` empty
- **THEN** the row still contains an empty cell at that position
- **AND** the cells after it keep their original indexes

#### Scenario: Parsing does not depend on content shape

- **WHEN** the block script reads an item row
- **THEN** it SHALL address cells by fixed index counted from the start of the row
- **AND** it SHALL NOT identify cells by querying for `picture` elements or by counting child nodes

### Requirement: Hero panel and tab are generated from one item

Each `space-option` item SHALL render both a hero panel and a tab control, and the two SHALL remain
paired without depending on authoring order beyond the item's own position.

#### Scenario: Item renders in both regions

- **WHEN** three `space-option` items are authored
- **THEN** the block renders three hero panels and three tab controls
- **AND** the nth tab controls the nth panel

#### Scenario: Tab exposes the authored label and thumbnail

- **WHEN** an item supplies `label` and `thumbnail`
- **THEN** the tab control displays that label and that thumbnail image

#### Scenario: Thumbnail is always a still image

- **WHEN** an item sets `media` to `video`
- **THEN** its tab control still renders `thumbnail` as an image, never as a video

#### Scenario: Selector always renders

- **WHEN** exactly one `space-option` item is authored
- **THEN** the selector strip still renders, showing that single tab

### Requirement: Tab selection swaps the hero panel

The block SHALL behave as a tab set: exactly one panel is visible at a time and activating a tab
reveals its panel.

#### Scenario: First item is active on load

- **WHEN** the block finishes decorating
- **THEN** the first tab is marked selected and its panel is visible
- **AND** every other panel is hidden

#### Scenario: Activating a tab swaps the panel

- **WHEN** a visitor activates a tab that is not currently selected
- **THEN** that tab becomes selected and its panel becomes visible
- **AND** the previously selected tab is deselected and its panel is hidden

#### Scenario: Tabs are keyboard operable

- **WHEN** focus is on the tab list and the visitor presses the arrow keys
- **THEN** focus moves between tabs and the focused tab can be activated with Enter or Space

#### Scenario: Tab semantics are exposed to assistive technology

- **WHEN** the block is rendered
- **THEN** the tab list, tabs and panels carry the corresponding ARIA roles
- **AND** the selected tab is marked `aria-selected="true"` while the others are `false`

### Requirement: Hero media supports image and video

The `media` field SHALL select between an image and a video hero, and video playback SHALL be tied
to panel selection.

#### Scenario: Image media

- **WHEN** `media` is `image`
- **THEN** the panel renders a `picture` element sourced from `mediaAsset`
- **AND** its `alt` text comes from `mediaAssetAlt`

#### Scenario: Video media

- **WHEN** `media` is `video`
- **THEN** the panel renders a `video` element that is muted, looping, inline and has `preload`
  set to `none`
- **AND** the item's `thumbnail` is used as the video poster

#### Scenario: Video plays only while its panel is active

- **WHEN** a video panel becomes the selected panel
- **THEN** the video starts playing
- **WHEN** that panel is deselected
- **THEN** the video pauses and its playback position resets to the start

#### Scenario: Reduced motion suppresses autoplay

- **WHEN** the visitor's system requests reduced motion
- **THEN** no video autoplays
- **AND** the poster image remains visible

#### Scenario: Mobile media override

- **WHEN** `mediaAssetMobile` is supplied
- **THEN** it is used at viewport widths of 767px and below
- **WHEN** `mediaAssetMobile` is empty
- **THEN** `mediaAsset` is used at every viewport width

### Requirement: Tab list becomes a carousel only when it overflows

The tab list SHALL be measured rather than assumed, and carousel affordances SHALL exist only while
the tabs do not fit.

#### Scenario: No carousel when tabs fit

- **WHEN** the tab list content fits within its available width
- **THEN** no carousel controls are rendered

#### Scenario: Carousel appears on overflow

- **WHEN** the tab list content is wider than its available width
- **THEN** carousel controls are rendered and the tab list becomes horizontally scrollable with
  snap positions

#### Scenario: Resize crossing the threshold initialises and tears down

- **WHEN** the available width shrinks so the tabs no longer fit
- **THEN** the carousel initialises
- **WHEN** the available width grows so the tabs fit again
- **THEN** the carousel is destroyed, its controls are removed, its listeners are detached and the
  scroll position is reset

#### Scenario: Repeated measurements do not duplicate state

- **WHEN** the overflow condition is measured many times in succession
- **THEN** the carousel initialises at most once
- **AND** no event listener is bound more than once

#### Scenario: Measurement is debounced

- **WHEN** a resize produces a rapid burst of measurements
- **THEN** initialisation or teardown runs once after the burst settles, not once per measurement

#### Scenario: Activating an off-screen tab scrolls it into view

- **WHEN** a tab outside the visible scroll area becomes selected
- **THEN** the tab list scrolls that tab into view

### Requirement: Responsive layout matches the design at each breakpoint

The block SHALL present the selector as a stacked column on mobile and tablet and as a two-column
row on desktop, using a single DOM structure.

#### Scenario: Stacked order below desktop

- **WHEN** the viewport is narrower than 1200px
- **THEN** the selector shows the section title, then the tab list, then the "Explore all" link, in
  that visual order

#### Scenario: Two-column layout on desktop

- **WHEN** the viewport is 1200px or wider
- **THEN** the section title and the "Explore all" link occupy a left column and the tab list
  occupies the remaining width beside them

#### Scenario: The "Explore all" link is not duplicated

- **WHEN** the block is rendered at any viewport width
- **THEN** exactly one "Explore all" anchor exists in the DOM

#### Scenario: Layout is direction-agnostic

- **WHEN** the page direction is right-to-left
- **THEN** the module's inline offsets, scroll direction and column order mirror correctly

### Requirement: Universal Editor authoring remains usable

Instrumentation SHALL be attached so that inline editing works and items are not counted twice.

#### Scenario: Instrumentation is attached to the panel

- **WHEN** an item row is decorated
- **THEN** its authoring instrumentation is moved onto the hero panel

#### Scenario: Tab controls carry no authoring attributes

- **WHEN** an item row is decorated
- **THEN** the generated tab control contains no `data-aue-*` attributes

#### Scenario: Selecting an item reveals its panel

- **WHEN** an author selects a `space-option` item in the editor
- **THEN** the corresponding panel becomes the active panel

### Requirement: Block degrades gracefully on incomplete authoring

The block SHALL render without script errors when optional fields are missing.

#### Scenario: Missing optional CTA

- **WHEN** an item has no `secondaryCta` label or link
- **THEN** no second CTA anchor is rendered and the panel still displays correctly

#### Scenario: No items authored

- **WHEN** the block contains no `space-option` items
- **THEN** the block renders without throwing and shows no empty hero region
