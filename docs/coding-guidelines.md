# Coding Guidelines

Mandatory coding style rules for this repository. Read this file before writing or modifying any TypeScript, CSS, or HTML — [AGENTS.md](../AGENTS.md) covers project structure, workflow, and deployment, and requires following these rules for every code change.

## JavaScript / TypeScript

- Source lives under `src/` (TypeScript, strict mode); Vite compiles it into the plain-JS `scripts/`, `styles/`, `blocks/*` output the AEM EDS runtime expects — never hand-edit those generated root files
- Use ES6+ features (arrow functions, destructuring, etc.)
- ESLint flat config (`eslint.config.js`) + Prettier (`prettier.config.js`) — no Airbnb config
- Use the `@/*` path alias (maps to `src/*`) for cross-module imports; omit `.ts` extensions
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

## Test Automation

Add `data-testid` attributes to support QA automation, scoped to:

- The root element of each block/component
- CTA buttons and links
- Form fields and submit actions
- Carousel controls (next/prev)
- Tabs, accordions, filters, search controls
- Other key interactive elements required for automation

Do not add `data-testid` to layout wrappers, decorative elements, or regular content/text elements.

Naming convention — lowercase kebab-case, prefixed with the exact block slug:

```
{block-name}
{block-name}-{element}
{block-name}-{action}
```

Examples:

```html
<section data-testid="hero-banner">
  <a data-testid="hero-banner-primary-cta">Book now</a>
</section>

<form data-testid="newsletter-form">
  <input data-testid="newsletter-form-email" type="email" />
  <button data-testid="newsletter-form-submit" type="submit">Subscribe</button>
</form>

<section data-testid="offers-carousel">
  <button data-testid="offers-carousel-previous" type="button">Previous</button>
  <button data-testid="offers-carousel-next" type="button">Next</button>
</section>
```

The value must describe a stable role, never CSS classes, translated/authored text, URLs, or render order/position. Use the block's actual source slug (e.g. `offers-carousel`, not `offer-carousel`).

When a page has multiple instances of the same block, do not make `data-testid` page-unique (no `-1`/`-2` suffixes) — instances share the same root test ID, and automation scopes child selectors to the chosen instance (e.g. Playwright's `getByTestId('offers-carousel').nth(0)`). Only add an author-provided key (e.g. `data-automation-key`) if QA needs to target one semantic instance regardless of position.
