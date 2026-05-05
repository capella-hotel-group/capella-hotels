## Why

The CSS custom properties `--heading-font-family` and `--heading-light-font-family` currently fall back directly to the generic `serif` keyword with no named fallback fonts. Adding `"Times"` and `"Times New Roman"` as intermediate fallbacks ensures more consistent rendering across browsers and operating systems when Goudy fonts are unavailable.

## What Changes

- Update `--heading-font-family` in `styles/styles.css` from `"Goudy Regular", serif` to `"Goudy Regular", "Times", "Times New Roman", serif`
- Update `--heading-light-font-family` in `styles/styles.css` from `"Goudy Light", serif` to `"Goudy Light", "Times", "Times New Roman", serif`

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `heading-font-tokens`: The fallback stack for heading font CSS custom properties is changing to include named serif fallbacks (`"Times"`, `"Times New Roman"`) before the generic `serif` keyword.

## Impact

- `styles/styles.css` — two CSS variable declarations modified
- All elements using `var(--heading-font-family)` or `var(--heading-light-font-family)` benefit from improved fallback rendering
- No breaking changes; purely additive to font stack
