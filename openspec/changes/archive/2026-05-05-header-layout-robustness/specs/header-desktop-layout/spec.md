## MODIFIED Requirements

### Requirement: Header inner zone layout
The `.header-inner` element SHALL use CSS Grid with three columns (`1fr auto 1fr`) so that the language zone (col 1), nav zone (col 2), and CTA zone (col 3) are independently anchored. Removing either the language zone or the CTA zone SHALL NOT affect the position of the remaining zone.

#### Scenario: Both lang and CTA present
- **WHEN** both `.header-lang` and `.header-cta` are rendered
- **THEN** lang SHALL be left-aligned in col 1, nav SHALL be centered in col 2, CTA SHALL be right-aligned in col 3

#### Scenario: Lang zone absent
- **WHEN** `.header-lang` is not rendered
- **THEN** nav SHALL remain centered and CTA SHALL remain right-aligned

#### Scenario: CTA zone absent
- **WHEN** `.header-cta` is not rendered
- **THEN** lang SHALL remain left-aligned and nav SHALL remain centered
