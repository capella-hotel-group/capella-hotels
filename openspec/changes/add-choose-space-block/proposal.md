## Why

The Capella Revamp 2026 design introduces a "Choose Space" module that lets a visitor browse
accommodation types (Manors, Villas, Suites, …) without leaving the page: picking a thumbnail
swaps a full-bleed hero showing that space's media, copy and CTAs. No existing block covers this
tab-style pattern, and the design also exercises design tokens that were never transcribed into
`src/styles/tokens.css`, so the module cannot be built accurately today.

Figma references (file `2AVYi5QIYXJhL72SkC31P7`):

- desktop 1440 — node `6047:27021`
- tablet 834 — node `6048:28586`
- mobile 393 — node `6048:30207`

## What Changes

### New block `choose-space`

- New block source at `src/blocks/choose-space/` (`choose-space.ts`, `choose-space.css`,
  `_choose-space.json`) plus registration in the aggregated component JSON.
- Content model: a `choose-space` block (anchor id, section title, "Explore all" CTA) containing
  repeatable `space-option` items (tab label, thumbnail, media type, desktop media, optional
  mobile media, eyebrow, title, description, primary CTA, secondary CTA).
- Runtime behaviour: tab list drives a set of hero panels; the first item is active on decorate;
  panel media may be an image or a video that autoplays only while active and stops when inactive.
- The tab list becomes a carousel **only when the items overflow**, decided by measurement and
  re-evaluated on resize with debounce, init guard and a real teardown path.

### New fluid desktop scaling mechanism

- Introduce a `--fluid-unit` custom property that equals `1px` up to the tablet range and
  `calc(100vw / 1440)` from the desktop breakpoint, so desktop spacing written as
  `calc(<figma-px> * var(--fluid-unit))` renders the exact Figma number at a 1440px viewport and
  scales proportionally either side of it, with no upper cap.
- Adopted by `choose-space` only in this change; available for other blocks to opt into later.
- Uses `vw` rather than container query units on purpose: `cqi` subtracts the classic scrollbar
  width and would render 292.9px instead of the specified 296px on a 1440px device.

### Design token additions

Add tokens that exist in Figma but are absent from `src/styles/tokens.css`. All are new
declarations, so no existing block changes behaviour:

| Token                                     | mobile | tablet | desktop              |
| ----------------------------------------- | ------ | ------ | -------------------- |
| `--dimension-spacing-title-to-content`    | 32px   | 48px   | 56px                 |
| `--dimension-viewport-width`              | 393    | 834    | 1440                 |
| `--dimension-layout-margin-m`             | 40px   | 40px   | 80px                 |
| `--dimension-layout-carousel-item-gap-xl` | 32px   | 40px   | 40px                 |
| `--typography-paragraph-spacing-body-m`   | 16px   | 16px   | 16px                 |
| `--fluid-unit`                            | 1px    | 1px    | `calc(100vw / 1440)` |

### Design token correction

- Add the missing desktop declaration `--component-button-padding-block: 16px`. Figma's shared
  Button component (`Button/text-standard`, used by this block) defines 16 at 1440; `tokens.css`
  stops at the tablet value of 8, which is a transcription gap rather than a second token.
- `destination-introduction` also consumes this token and will render with the corrected desktop
  value. That is the intended correction, not a regression to work around.

## Capabilities

### New Capabilities

- `choose-space-block`: authoring model, DOM contract, tab/panel behaviour, media handling and
  conditional carousel for the Choose Space module.
- `fluid-desktop-scaling`: the `--fluid-unit` viewport-proportional spacing mechanism and the rules
  for when a block may use it.
- `design-token-parity`: the requirement that `src/styles/tokens.css` mirrors the Figma variable
  set 1:1, plus the tokens added and corrected by this change.

### Modified Capabilities

None. No existing spec in `openspec/specs/` defines the block, the spacing mechanism or the
component button tokens touched here.

## Impact

- **New files**: `src/blocks/choose-space/{choose-space.ts,choose-space.css,_choose-space.json}`.
- **Modified files**: `src/styles/tokens.css` (token additions plus the button desktop
  declaration), `src/models/_component-{definition,filters,models}.json` if the aggregation entry
  points need the new ids, and the generated root `component-*.json` via `npm run build:json`.
- **Behavioural impact outside the block**: `src/blocks/destination-introduction/destination-introduction.css`
  renders desktop buttons with `padding-block: 16px` instead of `8px` once the token is completed.
  Needs a visual check but no code change.
- **Known issue, explicitly out of scope**: `--dimension-spacing-heading-to-content` is declared as
  `56px` at desktop while Figma's `dimension/spacing/heading-to-content` resolves to `48`. It is a
  distinct variable from `title-to-content` (which is genuinely 32/48/56), it is consumed only by
  `destination-introduction`, and its mobile and tablet values are still unverified. Track and fix
  it in a separate change.
- **No new dependencies.** No SCSS or PostCSS is introduced; `--fluid-unit` is plain CSS.
