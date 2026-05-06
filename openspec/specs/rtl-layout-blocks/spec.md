## Purpose

CSS logical properties and RTL-specific overrides across all blocks (`header`, `hero-banner`, `section-intro`, `text-with-image`). Ensures layout mirrors automatically in RTL without additional JavaScript.

## Requirements

### Requirement: CSS logical properties in all blocks
All blocks (`header`, `hero-banner`, `section-intro`, `text-with-image`) SHALL replace physical directional CSS properties with CSS logical equivalents so layout mirrors automatically when `dir="rtl"` is set, without additional JavaScript.

Physical properties that MUST NOT appear in block CSS:
- `margin-left` / `margin-right` → `margin-inline-start` / `margin-inline-end`
- `padding-left` / `padding-right` → `padding-inline-start` / `padding-inline-end`
- `text-align: left` / `text-align: right` → `text-align: start` / `text-align: end`
- `left: <value>` / `right: <value>` on positioned elements → `inset-inline-start` / `inset-inline-end`

Exception: `left: 50%` used together with `transform: translateX(-50%)` for centering is acceptable and SHALL NOT be changed.

#### Scenario: LTR layout unchanged after migration
- **WHEN** `dir` attribute is absent from `<html>` (LTR pages)
- **THEN** all block layouts SHALL render identically to before the logical property migration

#### Scenario: RTL layout mirrors automatically
- **WHEN** `[dir="rtl"]` is set on `<html>`
- **THEN** inline-start and inline-end spacing SHALL swap sides without any additional CSS or JS

---

### Requirement: Header block RTL overrides
`blocks/header/header.css` SHALL include `[dir="rtl"]` scoped overrides for layout cases where logical properties are insufficient.

#### Scenario: Language dropdown opens on correct side in RTL
- **WHEN** `[dir="rtl"]` is set and the language trigger is clicked
- **THEN** the `.header-lang-dropdown` SHALL align to `inset-inline-start: 0` (right side in RTL)

#### Scenario: Desktop nav dropdown close button in correct position
- **WHEN** `[dir="rtl"]` is set
- **THEN** `.header-nav-dropdown-close` SHALL use `inset-inline-end: 35px` instead of `right: 35px`

#### Scenario: Mobile menu text alignment
- **WHEN** `[dir="rtl"]` is set
- **THEN** mobile nav links, toggles, and lang list items SHALL use `text-align: start`

---

### Requirement: Hero-banner block RTL overrides
`blocks/hero-banner/hero-banner.css` SHALL use logical properties for the CTA button and content overlay positioning.

#### Scenario: CTA button position in RTL
- **WHEN** `[dir="rtl"]` is set
- **THEN** `.hero-banner-cta` SHALL appear on the inline-end side (left side in RTL) using `inset-inline-end`

#### Scenario: Content overlay spans full width
- **WHEN** `[dir="rtl"]` is set
- **THEN** `.hero-banner-content` with `left: 0; width: 100%` SHALL be replaced with `inset-inline-start: 0; width: 100%` and render correctly

---

### Requirement: Section-intro block logical properties
`blocks/section-intro/section-intro.css` SHALL use logical properties for all horizontal spacing.

#### Scenario: Wrapper centering in RTL
- **WHEN** `[dir="rtl"]` is set
- **THEN** `.section-intro-wrapper` and `.section-intro` SHALL use `margin-inline: auto` and render centered

#### Scenario: Mobile subtext and desc padding in RTL
- **WHEN** `[dir="rtl"]` is set on a mobile viewport
- **THEN** `.subtext` and `.desc` padding SHALL be mirrored — what was `padding-left` becomes `padding-inline-start` and appears on the right in RTL

---

### Requirement: Text-with-image block logical properties
`blocks/text-with-image/text-with-image.css` SHALL use logical properties for description and CTA link indentation.

#### Scenario: Description indentation mirrors in RTL
- **WHEN** `[dir="rtl"]` is set
- **THEN** `.description` and `.cta-link` indentation SHALL shift to the inline-start side (right side in RTL)
