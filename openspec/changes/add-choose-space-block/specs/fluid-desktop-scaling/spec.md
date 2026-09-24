## ADDED Requirements

### Requirement: Fluid desktop spacing unit

The stylesheet SHALL provide a `--fluid-unit` custom property that resolves to `1px` up to the
tablet range and to `calc(100vw / 1440)` from the desktop breakpoint of 1200px, so that a value
written as `calc(<figma-px> * var(--fluid-unit))` renders the literal Figma pixel value at a 1440px
viewport.

#### Scenario: Exact match at the design viewport

- **WHEN** the viewport is exactly 1440px wide
- **THEN** `calc(296 * var(--fluid-unit))` computes to 296px
- **AND** `calc(80 * var(--fluid-unit))` computes to 80px

#### Scenario: Proportional scaling below the design viewport

- **WHEN** the viewport is 1200px wide
- **THEN** `calc(296 * var(--fluid-unit))` computes to approximately 246.7px

#### Scenario: Unbounded scaling above the design viewport

- **WHEN** the viewport is wider than 1440px
- **THEN** the computed value continues to grow proportionally with no upper clamp

#### Scenario: Inert below the desktop breakpoint

- **WHEN** the viewport is narrower than 1200px
- **THEN** `--fluid-unit` equals `1px`
- **AND** spacing falls back to the fixed token values for mobile and tablet

### Requirement: The unit is derived from viewport width, not container width

`--fluid-unit` SHALL be defined using `vw` so that it reflects the device viewport width including
any classic scrollbar, matching the width of the Figma artboard.

#### Scenario: Scrollbar does not shrink the unit

- **WHEN** the page is rendered at a 1440px viewport on a platform with classic scrollbars
- **THEN** `--fluid-unit` still resolves to `1px`
- **AND** desktop padding still computes to the specified Figma value rather than a scrollbar-reduced one

### Requirement: The unit is only consumed by spacing properties

To avoid horizontal overflow, `--fluid-unit` SHALL be used for padding, margin and gap, and SHALL
NOT be used to set element width.

#### Scenario: No horizontal overflow is introduced

- **WHEN** a block applies `--fluid-unit` based padding at any viewport width
- **THEN** the document does not gain a horizontal scrollbar as a result

### Requirement: Adoption is opt-in

Declaring `--fluid-unit` SHALL NOT alter the rendering of any block that does not reference it.

#### Scenario: Existing blocks are unaffected

- **WHEN** `--fluid-unit` is added to the global stylesheet
- **THEN** blocks that never reference it render identically to before

#### Scenario: Scoped to one block in this change

- **WHEN** this change ships
- **THEN** `choose-space` is the only block that consumes `--fluid-unit`

### Requirement: No preprocessor is introduced

The mechanism SHALL be plain CSS.

#### Scenario: Dependency set is unchanged

- **WHEN** this change ships
- **THEN** no Sass, PostCSS or other CSS preprocessor is added to the project dependencies
- **AND** no additional build step is required to resolve `--fluid-unit`
