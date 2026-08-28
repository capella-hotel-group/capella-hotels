## ADDED Requirements

### Requirement: Block registration and section availability

The system SHALL define a `destination-introduction` block whose Universal Editor definition, model, and filter are authored in `src/blocks/destination-introduction/_destination-introduction.json`, and SHALL register the block id in the `section` filter in `src/models/_section.json` so authors can insert it into any section.

The block definition SHALL use resource type `core/franklin/components/block/v1/block` and SHALL reference both its model and its filter from the block template.

#### Scenario: Block appears in the section component list

- **WHEN** an author opens the Add Component dialog for a section in Universal Editor
- **THEN** "Destination Introduction" SHALL be offered as an insertable component

#### Scenario: Block definition reaches the generated root files

- **WHEN** `npm run build:json` is executed after the block fragment is added
- **THEN** `component-definition.json`, `component-models.json`, and `component-filters.json` SHALL each contain the `destination-introduction` entries from the block fragment

### Requirement: Block-level copy fields

The `destination-introduction` model SHALL expose exactly four block-level fields, in this order: `eyebrow` (`text`), `title` (`richtext`), `body` (`richtext`), and `footerCta` (`richtext`). Each field SHALL declare `valueType` of `string`.

`title` SHALL use the `richtext` component rather than `text` so that authors control the heading level of the rendered element.

`footerCta` SHALL use the `richtext` component so that authors can place one or more links side by side within a single field.

#### Scenario: Author edits all four copy fields

- **WHEN** an author selects a `destination-introduction` block in Universal Editor
- **THEN** the properties panel SHALL present Eyebrow as a single-line text input, and Title, Body, and Footer CTA as rich text editors

#### Scenario: Author sets the heading level of the title

- **WHEN** an author formats the Title rich text as a level-2 heading
- **THEN** the delivered markup for the title cell SHALL contain an `h2` element

#### Scenario: Author places multiple links in the footer CTA

- **WHEN** an author enters two links in the Footer CTA rich text field
- **THEN** the delivered markup for the footer CTA cell SHALL contain two anchor elements

### Requirement: Repeatable gallery image item

The system SHALL define a child component `destination-introduction-image` using resource type `core/franklin/components/block/v1/block/item`, with exactly two fields: `image` (`reference`, `multi` set to `false`) and `imageAlt` (`text`). Field names SHALL match the shared image fragment in `src/models/_image.json` for consistency.

A filter with id `destination-introduction` SHALL list `destination-introduction-image` as its only allowed component, so authors can add an unbounded number of gallery images to a single block instance.

#### Scenario: Author adds gallery images

- **WHEN** an author selects a `destination-introduction` block in the Universal Editor content tree
- **THEN** an Add action SHALL be available that inserts a "Destination Introduction Image" child item

#### Scenario: Author adds several gallery images

- **WHEN** an author adds nine gallery image items to one block instance
- **THEN** all nine items SHALL be persisted and SHALL each render as a separate single-cell row appended after the block-level copy rows

#### Scenario: Author supplies alternative text per image

- **WHEN** an author picks an asset for a gallery image item and enters alternative text
- **THEN** the delivered `img` element for that item SHALL carry the authored alternative text as its `alt` attribute

### Requirement: All fields optional

No field in the `destination-introduction` model or the `destination-introduction-image` model SHALL be marked `required`. The block SHALL be authorable and SHALL render without error for any combination of populated and empty fields, including a block instance with no gallery images and a block instance with no copy fields.

#### Scenario: Block with only gallery images

- **WHEN** an author creates a block instance with three gallery images and leaves Eyebrow, Title, Body, and Footer CTA empty
- **THEN** the page SHALL render without a JavaScript error and SHALL NOT display placeholder text for the empty fields

#### Scenario: Block with only copy and no images

- **WHEN** an author creates a block instance with Eyebrow, Title, Body, and Footer CTA populated and no gallery image items
- **THEN** the page SHALL render without a JavaScript error

### Requirement: Row order contract

The delivered block markup SHALL place the four block-level copy fields as rows 0 through 3, in model field order, each containing a single cell, followed by one row per gallery image item.

Because `imageAlt` ends in the reserved `Alt` suffix, field collapse SHALL merge it into the `image` value, so each gallery item row SHALL contain exactly one cell holding a `picture` element whose `img` carries the authored alternative text.

A row SHALL be emitted for every block-level field regardless of whether the author populated it, so the index of each copy field SHALL be constant.

Decoration logic SHALL address copy fields by their fixed index counted from the start of the block, and SHALL treat all rows from index 4 onward as gallery items. Decoration logic SHALL NOT identify rows by the presence of a `picture` element, SHALL NOT identify rows by cell count, and SHALL NOT rely on `data-aue-*` attributes, which are absent from delivered production markup.

#### Scenario: Copy field indices are stable when fields are empty

- **WHEN** an author leaves Eyebrow and Body empty but populates Title and Footer CTA
- **THEN** the block SHALL still emit four copy rows, and Title SHALL remain at index 1 and Footer CTA at index 3

#### Scenario: Gallery items follow the copy fields

- **WHEN** decoration logic inspects the rows of a `destination-introduction` block
- **THEN** rows 0 through 3 SHALL be treated as block-level copy fields and every row from index 4 onward SHALL be treated as a gallery image item

#### Scenario: Gallery item row carries image and alt in one cell

- **WHEN** an author supplies an asset and alternative text for a gallery image item
- **THEN** that item's row SHALL contain a single cell whose `picture` element wraps an `img` carrying the authored alternative text

### Requirement: Model changes that shift row indices

Adding, removing, or reordering block-level fields SHALL be treated as a change to the row order contract, and the decoration logic's field indices SHALL be updated in the same change.

Fields named `id` or `classes` SHALL NOT be added to this model, because those names are reserved and do not emit a row, which would silently desynchronise the indices. A user-defined anchor, if ever required, SHALL use a non-reserved name such as `anchorId`.

Field names ending in `Title`, `Type`, `MimeType`, `Alt`, or `Text`, and field names sharing an underscore-separated group prefix, SHALL be counted as part of the field they collapse into rather than as separate rows.

#### Scenario: A reserved field name is rejected

- **WHEN** a field named `id` or `classes` is proposed for the block model
- **THEN** it SHALL be renamed to a non-reserved name before the model is accepted

### Requirement: Stub decoration without visual design

The block SHALL ship a `destination-introduction.ts` exporting a default `decorate` function and a `destination-introduction.css`, both built into `blocks/destination-introduction/` by the existing build pipeline. The stub SHALL establish the block class hook and SHALL NOT implement gallery layout, carousel behaviour, responsive rules, or art direction, which are deferred to a follow-up change.

The stub SHALL NOT remove or reorder authored content, and SHALL preserve Universal Editor instrumentation on any element it moves.

#### Scenario: Block renders without breaking page layout

- **WHEN** a page containing a `destination-introduction` block is loaded
- **THEN** the block SHALL render its authored content within the block element without overflowing or collapsing the surrounding section layout

#### Scenario: Universal Editor instrumentation survives decoration

- **WHEN** the block is decorated in the Universal Editor
- **THEN** each gallery image item SHALL remain individually selectable and editable in the content tree
