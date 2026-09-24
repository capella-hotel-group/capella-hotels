## ADDED Requirements

### Requirement: `layout` field selects rendering mode

The `newsletter-form` model SHALL include a `layout` field (`select` component, options `Modal` and `Inline`, default `Modal`). `newsletter-form.ts` SHALL read this field at a fixed `ROW` index appended after the existing fields and SHALL branch its rendering on its value.

#### Scenario: Author leaves `layout` unset

- **WHEN** a `newsletter-form` block instance has no authored `layout` value
- **THEN** the block SHALL render using the `Modal` behavior

#### Scenario: Author selects `Inline`

- **WHEN** an author sets `layout` to `Inline`
- **THEN** the block SHALL render using the `Inline` behavior described below

### Requirement: `Modal` layout is unchanged

When `layout` is `Modal` or unset, the block SHALL render exactly as before this change: an on-page trigger button that opens an overlay containing the form, boxed `input`/`select` styling, a text-only consent notice (no checkbox), and the existing modal open/close behavior (✕ button, backdrop click, Escape key).

#### Scenario: Existing authored content keeps working

- **WHEN** a page authored before this change (with no `layout` field value) is rendered after this change ships
- **THEN** the newsletter form SHALL render and behave identically to before this change

### Requirement: `Inline` layout renders in place

When `layout` is `Inline`, the block SHALL render the form directly in place with no trigger button and no overlay/modal chrome.

#### Scenario: No trigger or overlay in inline mode

- **WHEN** `layout` is `Inline`
- **THEN** the rendered block SHALL NOT contain a `.newsletter-trigger` button or a `.newsletter-overlay` element

### Requirement: `Inline` layout uses underline-style inputs and grouped field rows

In `Inline` mode, inputs SHALL use an underline-only visual style (label above/overlapping a bottom-border field), not the boxed `input`/`select` style used in `Modal`. At tablet (≥768px) and desktop (≥1200px), Title/First name/Last name SHALL group into one 3-column row and Country/Email SHALL group into one 2-column row. At mobile (≤767px), every field SHALL stack in its own row.

#### Scenario: Fields group into rows at tablet and desktop

- **WHEN** `layout` is `Inline` and the viewport is ≥768px
- **THEN** Title, First name, and Last name SHALL render in one 3-column row, and Country and Email SHALL render in one 2-column row

#### Scenario: Fields stack at mobile

- **WHEN** `layout` is `Inline` and the viewport is ≤767px
- **THEN** every field SHALL render in its own row

### Requirement: `Inline` layout submit is a text-link style button

In `Inline` mode, the submit action SHALL render as an underlined text-link style button labeled "SIGN UP" (or the authored submit label), not the modal's solid CTA button.

#### Scenario: Submit renders as a text link

- **WHEN** `layout` is `Inline`
- **THEN** the submit control SHALL be styled as an underlined text link, not a solid filled button

### Requirement: `Inline` layout requires a consent checkbox

In `Inline` mode, the block SHALL render a required `<input type="checkbox">` immediately before the consent message (from the existing `consentMessage` field). The submit button SHALL remain disabled until the checkbox is checked, combined with any existing hCaptcha gating — both conditions SHALL be satisfied before the submit button is enabled. The `Modal` layout's text-only consent notice (no checkbox) SHALL remain unchanged.

#### Scenario: Submit is disabled until consent is checked

- **WHEN** `layout` is `Inline` and the consent checkbox is unchecked
- **THEN** the submit button SHALL be disabled

#### Scenario: Submit enables once consent is checked (and captcha solved, if configured)

- **WHEN** `layout` is `Inline`, the consent checkbox becomes checked, and hCaptcha (if configured) is solved
- **THEN** the submit button SHALL become enabled

#### Scenario: Unchecking consent re-disables submit

- **WHEN** `layout` is `Inline` and a previously checked consent checkbox is unchecked
- **THEN** the submit button SHALL become disabled again

### Requirement: `Inline`-specific CSS is scoped separately from `Modal` CSS

New CSS for the `Inline` layout SHALL be added under a distinct scope (e.g. `.newsletter-inline`) in `newsletter-form.css`, and SHALL NOT modify or remove any existing `Modal`-scoped rule (`.newsletter-trigger`, `.newsletter-overlay`, `.newsletter-dialog-*`, or the boxed `input`/`select` rules).

#### Scenario: Modal CSS rules are untouched

- **WHEN** this change is applied
- **THEN** every CSS selector that existed for the `Modal` layout before this change SHALL still exist with unchanged declarations
