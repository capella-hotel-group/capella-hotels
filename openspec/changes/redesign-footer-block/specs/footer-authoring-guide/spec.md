## ADDED Requirements

### Requirement: Footer authoring guide document

The repository SHALL contain `docs/footer-authoring-guide.md`, mirroring the structure of `docs/header-nav-authoring-guide.md` (Overview, per-section rules, Rules, Pre-publish Checklist), documenting the `/footer` fragment page's 4 fixed sections in order: (1) nav link columns, (2) newsletter, (3) contact + social, (4) legal + copyright.

#### Scenario: Guide documents all 4 sections

- **WHEN** an author or developer consults `docs/footer-authoring-guide.md`
- **THEN** it SHALL describe the required shape of each of the 4 sections, in order, including field/component types expected in each

### Requirement: Guide documents the social-link icon-shortcode convention

The guide SHALL document that social links in section 3 are authored as a bullet list where each link's text uses an icon shortcode (e.g. `:facebook:`, `:instagram:`, `:line:`), using the existing EDS icon convention, so authors can freely add, remove, or reorder social platforms without a code change.

#### Scenario: Guide explains the icon shortcode convention

- **WHEN** an author reads the social links section of the guide
- **THEN** it SHALL show an example of an icon-shortcode-based social link and state that any supported icon shortcode may be used
