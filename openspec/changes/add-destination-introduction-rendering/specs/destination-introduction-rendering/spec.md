## ADDED Requirements

### Requirement: Design token correction against Figma

Figma SHALL be treated as the source of truth for design tokens. Where `src/styles/tokens.css` diverges from the values Figma reports for the destination introduction frames, the token file SHALL be corrected rather than overridden inside block CSS. A token SHALL be declared only at breakpoints for which Figma exposes a value; values for unsampled breakpoints SHALL NOT be invented.

The following corrections SHALL be applied:

| Token                                         | Breakpoint | Value   |
| --------------------------------------------- | ---------- | ------- |
| `--dimension-layout-module-padding-inline-xs` | desktop    | `52px`  |
| `--dimension-layout-module-gutter-m`          | desktop    | `32px`  |
| `--dimension-layout-module-padding-top`       | tablet     | `112px` |
| `--component-button-padding-block`            | tablet     | `8px`   |

#### Scenario: Missing token is added

- **WHEN** `src/styles/tokens.css` is inspected inside the `width >= 1200px` media query
- **THEN** `--dimension-layout-module-padding-inline-xs` SHALL be declared with the value `52px`

#### Scenario: Diverging token is corrected

- **WHEN** `src/styles/tokens.css` is inspected inside the `width >= 768px` media query
- **THEN** `--component-button-padding-block` SHALL be `8px` rather than `16px`

#### Scenario: Unsampled breakpoints are left alone

- **WHEN** a token is corrected for one breakpoint only
- **THEN** its declarations at other breakpoints SHALL remain unchanged, because Figma exposes no value for them

### Requirement: Block-scoped styling

Every CSS selector introduced by this block SHALL be scoped beneath the `.destination-introduction` class so that adding the block to a page cannot affect any other block, section, or default content.

The block SHALL NOT declare selectors on bare element types, on shared utility class names, or on `.destination-introduction-container` and `.destination-introduction-wrapper`, which belong to the surrounding section.

#### Scenario: Selectors cannot leak

- **WHEN** the block stylesheet is inspected
- **THEN** every rule SHALL have `.destination-introduction` as an ancestor or as the subject of the selector

#### Scenario: Sibling blocks are unaffected

- **WHEN** a page contains a `destination-introduction` block and other blocks
- **THEN** the rendering of the other blocks SHALL be identical to a page without the `destination-introduction` block

### Requirement: Multiple instances on one page

The block SHALL support any number of instances on a single page, each operating independently.

All element lookups performed during decoration SHALL be rooted at the block element passed to `decorate`. The block SHALL NOT query from `document`, SHALL NOT store selection state in module scope, and SHALL NOT generate element `id` attributes, so that no instance can collide with another.

#### Scenario: Two instances operate independently

- **WHEN** a page contains two `destination-introduction` blocks and a thumbnail is selected in the first
- **THEN** only the first block's hero image SHALL change and the second block SHALL keep its own selection

#### Scenario: Controls act only on their own block

- **WHEN** the next control of the second block is activated
- **THEN** only the second block's slider SHALL advance

### Requirement: Responsive layout

The block SHALL render three layouts, using the project breakpoints of mobile below `768px`, tablet from `768px` to `1199px`, and desktop from `1200px`. Styles SHALL be authored mobile first with `min-width` media queries.

At desktop the block SHALL place the gallery media in a left column occupying `60%` of the block width and the copy in a right column occupying `40%`, with the copy column vertically centred against the media.

At tablet and mobile the block SHALL render a single column ordered eyebrow and title, then gallery media, then body copy, then footer call to action.

The block SHALL emit one DOM in the mobile and tablet reading order and SHALL use CSS grid placement to produce the desktop arrangement. It SHALL NOT relocate nodes with JavaScript in response to viewport changes and SHALL NOT emit duplicate markup per breakpoint.

#### Scenario: Desktop two-column split

- **WHEN** the block is rendered at a viewport width of `1440px`
- **THEN** the gallery media SHALL occupy the left `60%` and the copy the right `40%`

#### Scenario: Tablet single column

- **WHEN** the block is rendered at a viewport width of `834px`
- **THEN** the content SHALL be a single column ordered eyebrow and title, gallery, body, footer call to action

#### Scenario: Content is not duplicated

- **WHEN** the decorated DOM is inspected at any breakpoint
- **THEN** each authored field and each gallery image SHALL appear exactly once

### Requirement: Desktop hero and thumbnail selection

At desktop the block SHALL display one gallery image at full size as the hero and SHALL display every gallery image as a thumbnail in the copy column. The hero SHALL be the currently selected gallery image and SHALL NOT be a separate authored image.

The first gallery image SHALL be selected initially. Activating a thumbnail SHALL make its image the hero. Thumbnails SHALL be rendered as `button` elements so they are keyboard operable, and the active thumbnail SHALL carry `aria-current`.

Thumbnail images SHALL fill their frame using `object-fit: cover`.

#### Scenario: Initial selection

- **WHEN** a block with three gallery images is first rendered at desktop
- **THEN** the first image SHALL be shown as the hero and its thumbnail SHALL carry `aria-current`

#### Scenario: Selecting a thumbnail swaps the hero

- **WHEN** the third thumbnail is activated
- **THEN** the hero SHALL show the third image and `aria-current` SHALL move to the third thumbnail

#### Scenario: Thumbnails are keyboard operable

- **WHEN** a thumbnail receives keyboard focus and is activated with Enter or Space
- **THEN** the hero SHALL swap as it does for a pointer click

### Requirement: Tablet and mobile slider

At tablet and mobile the block SHALL replace the thumbnail row with a horizontally scrolling slider containing every gallery image, and the thumbnail row SHALL NOT be displayed.

The slider SHALL use native horizontal scrolling with scroll snapping so that touch and trackpad gestures work without JavaScript. The block SHALL render previous and next controls as `button` elements with accessible names, positioned over the media and inset `20px` from each edge.

Activating a control SHALL move the slider by one slide. The current index SHALL be derived from the slider's scroll position so that scrolling by gesture and by control stay in agreement.

At mobile the slider SHALL be full width with no side inset, so that the following image is partially visible. At tablet the slider SHALL sit within the section's horizontal padding.

#### Scenario: Next control advances one slide

- **WHEN** the next control is activated at mobile with the first image showing
- **THEN** the slider SHALL scroll so that the second image is snapped into place

#### Scenario: Gesture and control stay in sync

- **WHEN** the user swipes to the second image and then activates the next control
- **THEN** the slider SHALL move to the third image rather than back to the second

#### Scenario: Thumbnails are hidden below desktop

- **WHEN** the block is rendered at a viewport width of `834px` or below
- **THEN** the thumbnail row SHALL NOT be rendered visually

#### Scenario: Mobile slider bleeds to the edge

- **WHEN** the block is rendered at a viewport width of `393px`
- **THEN** the first image SHALL start at the left edge of the block and the next image SHALL be partially visible

### Requirement: Typography and spacing from tokens

Text and spacing SHALL be expressed using the project's design token custom properties rather than literal values wherever a matching token exists, so that the block follows the responsive token scale automatically.

The eyebrow SHALL use the body font at the body M size and MD line height. The title SHALL use the heading font at the H1 size and line height. The body copy SHALL use the subtitle font at the subtitle size and line height. Headings and eyebrow SHALL use the main heading text colour and body copy the main body text colour. The block background SHALL use the subtle general surface colour.

#### Scenario: Title follows the responsive scale

- **WHEN** the viewport crosses from tablet to desktop
- **THEN** the title font size SHALL change from `40px` to `48px` because it is bound to `--typography-fontsize-heading-h1`

#### Scenario: Colours come from tokens

- **WHEN** the block stylesheet is inspected
- **THEN** the background, heading, and body colours SHALL reference `--color-surface-general-subtle`, `--color-text-main-heading`, and `--color-text-main-body`

### Requirement: Slider control icon fidelity

The previous and next controls SHALL render the arrow glyph exported from Figma at its original `28x28` geometry. The glyph SHALL be inlined as SVG path data with `fill` set to `currentColor` so that the block stylesheet controls its colour.

The controls SHALL NOT substitute an approximation drawn with CSS borders, and SHALL NOT reuse `icons/chevron-down.svg`, whose geometry and hard-coded stroke colour do not match.

#### Scenario: Arrow preserves designed geometry

- **WHEN** a slider control is inspected
- **THEN** it SHALL contain an `svg` with a `0 0 28 28` viewBox carrying the exported path data

### Requirement: Graceful handling of optional content

Every field remains optional. The block SHALL render without a JavaScript error and SHALL NOT reserve visible space for any field the author left empty.

The footer call to action SHALL render at every breakpoint when populated, because the elements marked hidden in the Figma frames are optional parts of the component rather than breakpoint rules.

When the block contains no gallery images, the media area SHALL NOT be rendered and the slider controls SHALL NOT be present. When the block contains exactly one gallery image, the slider controls and the thumbnail row SHALL NOT be rendered, since there is nothing to move between.

#### Scenario: No gallery images

- **WHEN** a block instance has copy fields populated and no gallery image items
- **THEN** the page SHALL render without a JavaScript error and no media area or slider controls SHALL appear

#### Scenario: A single gallery image

- **WHEN** a block instance has exactly one gallery image
- **THEN** the image SHALL be displayed and neither slider controls nor thumbnails SHALL be rendered

#### Scenario: Empty copy fields leave no gap

- **WHEN** an author leaves Eyebrow and Footer CTA empty
- **THEN** neither SHALL occupy vertical space in the rendered block

### Requirement: Authoring model and instrumentation preserved

This change SHALL NOT alter the block's authoring model, the row order contract, or the generated `component-*.json` files. Decoration SHALL continue to read copy fields at row indices 0 through 3 and to treat rows from index 4 onward as gallery items.

Universal Editor instrumentation SHALL be preserved with `moveInstrumentation` for every element the block relocates, so each gallery image item remains individually selectable in the content tree.

#### Scenario: Model files untouched

- **WHEN** the change is reviewed
- **THEN** `src/blocks/destination-introduction/_destination-introduction.json`, `src/models/_section.json`, and the root `component-*.json` files SHALL be unchanged

#### Scenario: Gallery items stay selectable

- **WHEN** the block is decorated in the Universal Editor
- **THEN** each gallery image item SHALL remain individually selectable and editable
