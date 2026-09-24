## ADDED Requirements

### Requirement: Footer fragment section contract

The `/footer` fragment page SHALL have exactly 4 sections in order: (1) nav link columns, (2) newsletter, (3) contact + social, (4) legal + copyright. `src/blocks/footer/footer.ts` SHALL address each section by its fixed index and SHALL skip (not throw on) a section that is missing or does not match its expected shape.

#### Scenario: All 4 sections present and well-formed

- **WHEN** the `/footer` fragment has 4 sections matching the documented shape
- **THEN** the footer SHALL render nav columns, newsletter, contact + social, and legal + copyright groups, in that order in the DOM

#### Scenario: A section is missing or malformed

- **WHEN** one of the 4 sections is absent, empty, or does not contain the expected component shape
- **THEN** the footer SHALL render the remaining well-formed sections and SHALL NOT throw a JavaScript error

### Requirement: Nav link columns rendering

Section 1 SHALL contain exactly 2 Text/list components, each rendered as its own `.footer-nav-col` element. Each link's `href`, `target`, and `rel` SHALL be preserved exactly as authored.

#### Scenario: Two nav columns render side by side

- **WHEN** section 1 contains 2 flat bullet lists
- **THEN** the footer SHALL render 2 `.footer-nav-col` elements, each containing the links from its source list with `href`/`target`/`rel` preserved

### Requirement: Newsletter section passthrough

Section 2 SHALL contain the `newsletter-form` block, already fully decorated by `loadFragment()` before `footer.ts` runs. `footer.ts` SHALL relocate the already-built newsletter DOM into its footer group without rebuilding or re-decorating it.

#### Scenario: Newsletter form is relocated intact

- **WHEN** section 2 contains a decorated `newsletter-form` block
- **THEN** the footer SHALL move that block's existing DOM into the newsletter footer group without altering its structure or re-running its decoration

### Requirement: Contact + social section rendering

Section 3 SHALL contain one Text component for contact info (rendered as authored, one `<p>` per line/group) and one Text component authored as a bullet list of social links. Each social link's decorated icon markup (the `<span class="icon icon-*">` produced by `decorateIcons()`) SHALL be preserved in the rendered link — `footer.ts` SHALL move or clone the link's full child nodes rather than reducing it to `textContent`.

#### Scenario: Social link icon markup survives decoration

- **WHEN** a social link is authored using an icon shortcode (e.g. `:facebook:`) and already converted by `decorateIcons()` into an icon `<span>` before `footer.ts` runs
- **THEN** the rendered social link SHALL contain that icon `<span>` element, not a stripped-to-text label

#### Scenario: Authors reorder or add social links

- **WHEN** an author adds, removes, or reorders items in the social links bullet list
- **THEN** the rendered social links SHALL reflect the same count and order without any code change

### Requirement: Legal + copyright section rendering

Section 4 SHALL contain one Text bullet list of legal links and one plain paragraph for the copyright line. Both SHALL be rendered as authored.

#### Scenario: Legal links and copyright render

- **WHEN** section 4 contains a legal links list and a copyright paragraph
- **THEN** the footer SHALL render the legal links list followed by the copyright paragraph

### Requirement: Section dividers

The footer SHALL insert 3 `.footer-divider` elements between the 4 rendered groups (after nav columns, after newsletter, after contact + social). Dividers SHALL be plain CSS-styled elements (a top border), not an image asset.

#### Scenario: Dividers render between each group

- **WHEN** all 4 sections are present
- **THEN** the footer SHALL contain 3 `.footer-divider` elements positioned between the 4 groups

### Requirement: Fragment path resolution unchanged

`footer.ts` SHALL continue to resolve the fragment path exactly as documented in `docs/header-footer-fragment-path-resolution.md` (metadata `<meta name="footer">`, falling back to `getFragmentBasePath()`), unmodified by this change.

#### Scenario: Metadata-driven and URL-fallback resolution still work

- **WHEN** the footer path is resolved via either the `footer` metadata tag or the URL-derived fallback
- **THEN** the resolution behavior SHALL be identical to before this change

### Requirement: Responsive layout

The footer SHALL lay out its 4 groups per breakpoint:

- Mobile (≤767px): all groups stack in DOM order; all 3 dividers are visible.
- Tablet (768–1199px): the 2 nav columns sit side by side; the newsletter section renders as its own full-width row below them; the contact + social section renders as a full-width row below that; all 3 dividers are visible.
- Desktop (≥1200px): the nav-columns wrapper uses `display: contents` so its 2 columns become items of an outer CSS Grid, arranged via named `grid-area`s into a single row in the order Contact+Social | Nav column 1 | Nav column 2 | Newsletter; the 2 dividers that sit between these groups in DOM order are hidden at this breakpoint only, while the divider before legal + copyright remains visible.

Legal links SHALL wrap horizontally at tablet and desktop and SHALL stack vertically at mobile. The copyright line SHALL sit below the legal links, left-aligned, at every breakpoint.

All new footer CSS SHALL use only colors, spacing, and typography values defined in `src/styles/tokens.css`, and SHALL NOT hardcode hex or pixel values copied directly from Figma.

#### Scenario: Desktop reflow ignores DOM order

- **WHEN** the footer is viewed at a desktop viewport (≥1200px)
- **THEN** the visual order SHALL be Contact+Social, Nav column 1, Nav column 2, Newsletter, regardless of their DOM order

#### Scenario: Only the legal divider survives at desktop

- **WHEN** the footer is viewed at a desktop viewport (≥1200px)
- **THEN** the divider before the legal + copyright group SHALL be visible and the other 2 dividers SHALL be hidden

#### Scenario: Tablet stacks nav-columns row above newsletter and contact+social rows

- **WHEN** the footer is viewed at a tablet viewport (768–1199px)
- **THEN** the 2 nav columns SHALL render side by side in one row, followed by the newsletter section as its own full-width row, followed by the contact + social section as its own full-width row, with all 3 dividers visible

#### Scenario: Mobile stacks everything in DOM order

- **WHEN** the footer is viewed at a mobile viewport (≤767px)
- **THEN** all 4 groups SHALL stack vertically in DOM order with all 3 dividers visible
