## MODIFIED Requirements

### Requirement: Heading font fallback stack
The `--heading-font-family` CSS custom property SHALL include `"Times"` and `"Times New Roman"` as named fallback fonts between the primary font and the generic `serif` keyword, providing consistent cross-platform rendering when Goudy Regular is unavailable.

#### Scenario: Font stack includes named fallbacks
- **WHEN** the `--heading-font-family` custom property is declared
- **THEN** its value SHALL be `"Goudy Regular", "Times", "Times New Roman", serif`

### Requirement: Heading light font fallback stack
The `--heading-light-font-family` CSS custom property SHALL include `"Times"` and `"Times New Roman"` as named fallback fonts between the primary font and the generic `serif` keyword, providing consistent cross-platform rendering when Goudy Light is unavailable.

#### Scenario: Light font stack includes named fallbacks
- **WHEN** the `--heading-light-font-family` custom property is declared
- **THEN** its value SHALL be `"Goudy Light", "Times", "Times New Roman", serif`
