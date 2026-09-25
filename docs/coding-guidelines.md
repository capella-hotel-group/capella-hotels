# Coding Guidelines

Mandatory coding style rules for this repository. Read this file before writing or modifying any TypeScript, CSS, or HTML — [AGENTS.md](../AGENTS.md) covers project structure, workflow, and deployment, and requires following these rules for every code change.

## JavaScript / TypeScript

- Source lives under `src/` (TypeScript, strict mode); Vite compiles it into the plain-JS `scripts/`, `styles/`, `blocks/*` output the AEM EDS runtime expects — never hand-edit those generated root files
- Use ES6+ features (arrow functions, destructuring, etc.)
- ESLint flat config (`eslint.config.js`) + Prettier (`prettier.config.js`) — no Airbnb config
- Use the `@/*` path alias (maps to `src/*`) for cross-module imports; omit `.ts` extensions
- Resolve every DAM asset URL you put into a `src`/`href` through `resolveDAMUrl()` (`src/utils/env.ts`) — authored references arrive as AEM paths and only the publish origin in `src/configs/env.ts` serves them; the EDS origin returns 404. Applies to video `<source>`s in particular, since images come through the pipeline already optimized
- Use Unix line endings (LF)

## CSS

- Formatted with Prettier (4-space indent); no Stylelint — keep selectors and features consistent with existing blocks
- Use modern CSS features (CSS Grid, Flexbox, CSS Custom Properties)
- Maintain responsive design principles
  - Declare styles mobile first, use `min-width` media queries at the agreed breakpoints: mobile up to 767px, tablet 768–1199px (`min-width: 768px`), desktop 1200px+ (`min-width: 1200px`) — see `--breakpoint-*` tokens in `src/styles/tokens.css`.
  - Some older blocks still use ad-hoc `min-width: 600px`/`900px` queries predating this convention; don't copy them into new work, but don't silently rewrite them either unless the task calls for it.
- Ensure all selectors are scoped to the block.
  - Bad: `.item-list`
  - Good: `.{blockname} .item-list`
- Avoid classes `{blockname}-container` and `{blockname}-wrapper` as those are used on sections and could be confusing.

## HTML

- Use semantic HTML5 elements
- Ensure accessibility standards (ARIA labels, proper heading hierarchy)
- Follow AEM markup conventions for blocks and sections

## Universal Editor

Two rules govern every `decorate()`:

1. **Decoration must not change the content tree.** What the author sees in the UE content tree and in `component-definition.json` is the contract; the DOM work is presentation only.
2. **The editor must render the real UI.** The same scripts and styles apply in UE as on the live site — no stripped-down "editor mode" markup.

Concretely:

- Never drop an authored row. A row carrying `data-aue-model="<item-model>"` is a real item even when every field is still empty — render it (with a placeholder label if needed) so a freshly added item is visible and selectable. Silently returning `null` makes "Add item" look broken.
- Identify item rows by `data-aue-model` first, falling back to cell shape or index for published content. Never rely on row position alone.
- Preserve instrumentation. Move authored elements into new wrappers instead of copying their text out — an element carrying `data-aue-prop` must survive, or the field loses inline editing. Use `moveInstrumentation()` when transferring `data-aue-*` to an element you build, and strip it from clones so UE does not count an item twice.
- Decorate in place. `block.replaceChildren()` / rebuilding the DOM from parsed strings breaks inline editing; add classes to the authored elements and only re-parent them.
- Keep every item reachable. If the design hides inactive items (carousel, tabs, accordion), they are unreachable on the UE canvas — reveal them under `.adobe-ue-edit` in CSS rather than shipping different markup, and handle `aue:ui-select` so selecting an item in the rail shows it.
- Enforce item limits in `decorate()`, not in the model — xwalk has no min/max item count.
- UE loads code from the `*.aem.page` origin, not localhost: push the branch before testing a fix in the editor.

## Block Identity Fields

Every block model starts with the same two authorable fields, in this order, before any content field:

| Order | `name`       | Component | Label        | Effect                                                                                  |
| ----- | ------------ | --------- | ------------ | --------------------------------------------------------------------------------------- |
| 1     | `id`         | `text`    | Block ID     | Sets `id` on the block element (anchor target). Leading `#` is stripped.                |
| 2     | `dataTestId` | `text`    | Data Test ID | Sets `data-test-id` on the block element. No attribute when the author leaves it empty. |

Rules:

- Add both fields to every new block model unless the task explicitly says otherwise, and keep them as the first two fields — row indices in `decorate()` depend on that order, so inserting them into an existing model means shifting every content row index by two.
- Keep the field names `id` and `dataTestId`; only the labels are for authors. Never rename `id` to something else, and never add a `classes` field in this slot — `classes` is reserved by xwalk and emits no row, which would desynchronise the row indices.
- Consume them with `applyBlockIdentity()` (`src/utils/block-identity.ts`), passing the number of non-item content rows the model emits. It splits from the tail, so pages authored before the model gained these fields keep working; it hides the identity rows with the block's own hidden class and returns the remaining content rows:

```ts
import { applyBlockIdentity } from '@/utils/block-identity.js';

const [eyebrowRow, titleRow] = applyBlockIdentity(block, rows, {
  hiddenClass: 'offers-carousel-hidden',
  contentRows: 2,
});
```

- Filter repeatable item rows out before calling it — `contentRows` counts only the block-level rows.

- The hidden class must be block-scoped CSS (`.offers-carousel .offers-carousel-hidden { display: none; }`) — the rows are hidden, never removed, so the Universal Editor keeps them selectable.
- Authors leave both fields empty by default; the block must render identically when they are.

## Test Automation

QA automation hooks on `data-test-id`, and that attribute is authored, never hardcoded:

- It is written only by the `dataTestId` field of the block model (see "Block Identity Fields"), applied by `applyBlockIdentity()`.
- It lands only on the block's root element. Never set `data-test-id` on inner elements — CTAs, form fields, carousel controls, wrappers, or anything else.
- When the author leaves the field empty, no attribute is rendered. Do not fall back to the block slug or any other default.
- If QA needs to reach an element inside a block, they scope from the block root through its stable classes or roles.

Values are authored, so guide authors towards lowercase kebab-case names that describe a stable role — never CSS classes, translated text, URLs, or render order:

```html
<div class="offers-carousel block" data-test-id="offers-carousel">…</div>
```

Playwright needs `testIdAttribute: 'data-test-id'` in its config for `getByTestId()` to match. Multiple instances of the same block may share a value; automation scopes by position (`.nth(0)`) or the authors give each instance a distinct one.
