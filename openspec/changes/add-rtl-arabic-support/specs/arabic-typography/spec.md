## ADDED Requirements

### Requirement: RTL typography CSS variables
`styles/styles.css` SHALL define a `[dir="rtl"]` block that overrides CSS custom properties for typography, using the existing font stack without adding new font dependencies.

#### Scenario: Line height override for Arabic
- **WHEN** `[dir="rtl"]` is set on `<html>`
- **THEN** `--body-line-height` (or equivalent) SHALL be at least `1.8` to accommodate Arabic diacritics

#### Scenario: Letter spacing reset for Arabic
- **WHEN** `[dir="rtl"]` is set on `<html>`
- **THEN** `letter-spacing` for body text SHALL be `0` — Arabic character connections (kashida) MUST NOT be broken by letter-spacing

#### Scenario: Font family unchanged
- **WHEN** `[dir="rtl"]` is set on `<html>`
- **THEN** the font family SHALL remain the existing project font stack (`Calibre`, `Goudy`) — no new Arabic-specific font SHALL be loaded

---

### Requirement: Directional icon flip
`styles/styles.css` SHALL define `[dir="rtl"]` rules to horizontally flip icons that imply direction, using `transform: scaleX(-1)`.

#### Scenario: Arrow and chevron icons are flipped
- **WHEN** `[dir="rtl"]` is set on `<html>`
- **THEN** elements matching `[class*="icon-arrow"]`, `[class*="icon-chevron"]`, `[class*="icon-back"]`, `[class*="icon-forward"]`, `[class*="icon-next"]`, `[class*="icon-prev"]` SHALL have `transform: scaleX(-1)` applied

#### Scenario: Neutral icons are not flipped
- **WHEN** `[dir="rtl"]` is set on `<html>`
- **THEN** close buttons, logos, star/heart icons, play/pause icons SHALL NOT have any flip transform applied
