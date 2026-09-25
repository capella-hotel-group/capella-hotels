## ADDED Requirements

### Requirement: Token file mirrors the Figma variable set

`src/styles/tokens.css` SHALL name and value-match the Figma "Capella Revamp 2026" variables 1:1,
with the Figma variable path lowercased and `/` replaced by `-`.

#### Scenario: A design value used by a block has a token

- **WHEN** a block needs a spacing, colour or typography value that exists as a Figma variable
- **THEN** that value is consumed through the corresponding token
- **AND** the value is not written as a literal inside the block stylesheet

#### Scenario: Differing values mean different tokens

- **WHEN** two Figma variables resolve to different values at the same breakpoint
- **THEN** they are represented as two separate tokens
- **AND** neither token's value is overwritten with the other's

### Requirement: Tokens required by Choose Space are declared

The following tokens SHALL exist with the values Figma resolves at the 393px, 834px and 1440px
artboards.

| Token                                     | mobile | tablet | desktop |
| ----------------------------------------- | ------ | ------ | ------- |
| `--dimension-spacing-title-to-content`    | 32px   | 48px   | 56px    |
| `--dimension-viewport-width`              | 393    | 834    | 1440    |
| `--dimension-layout-margin-m`             | 40px   | 40px   | 80px    |
| `--dimension-layout-carousel-item-gap-xl` | 32px   | 40px   | 40px    |
| `--typography-paragraph-spacing-body-m`   | 16px   | 16px   | 16px    |

#### Scenario: New tokens resolve per breakpoint

- **WHEN** the page is rendered at 393px, 834px and 1200px or wider
- **THEN** each token above resolves to the mobile, tablet and desktop value respectively

#### Scenario: New tokens do not disturb existing blocks

- **WHEN** these tokens are added
- **THEN** no existing block changes its rendering, because none of them previously existed

### Requirement: Button padding token is complete at desktop

`--component-button-padding-block` SHALL declare the desktop value defined by the shared Figma
Button component, completing the existing mobile and tablet declarations.

#### Scenario: Desktop value is present

- **WHEN** the viewport is 1200px or wider
- **THEN** `--component-button-padding-block` resolves to 16px

#### Scenario: Mobile and tablet values are unchanged

- **WHEN** the viewport is narrower than 1200px
- **THEN** `--component-button-padding-block` resolves to 4px on mobile and 8px on tablet, as before

#### Scenario: Consuming blocks are verified after the correction

- **WHEN** the desktop declaration is added
- **THEN** every block that consumes the token is visually checked at desktop

#### Scenario: The text link carries no height of its own

- **WHEN** a text link styled after `Button/text-standard` is implemented
- **THEN** `--component-button-height` is not applied to it, because the Figma component sets no
  height and stretches to fill its container

#### Scenario: Rendered height is verified rather than derived

- **WHEN** a text element uses `text-box-trim: trim-both` with `text-box-edge: cap alphabetic`
- **THEN** its border box equals padding plus cap height, not padding plus line height
- **AND** its spacing is confirmed by measuring the rendered element against the Figma artboard

### Requirement: Known token mismatches are recorded rather than silently fixed

A token whose declared value disagrees with Figma SHALL be corrected only by a change that needs that token; otherwise the discrepancy SHALL be documented and deferred to its own change.

#### Scenario: heading-to-content discrepancy is deferred

- **WHEN** this change ships
- **THEN** `--dimension-spacing-heading-to-content` retains its current values
- **AND** the discrepancy between its declared desktop value of 56px and Figma's
  `dimension/spacing/heading-to-content` value of 48 is recorded for a follow-up change
- **AND** it is documented as a distinct variable from `dimension/spacing/title-to-content`

#### Scenario: Unverified breakpoints block a correction

- **WHEN** a token's Figma value has only been confirmed at one artboard
- **THEN** the token is not corrected until the remaining breakpoints are sampled
