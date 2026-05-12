## Why

The project currently has no RTL or Arabic support — `lang` is hardcoded to `en`, there is no `dir` detection, and many CSS blocks use physical properties (`left`, `right`, `padding-left`...) that will break layout when rendering Arabic. RTL foundations need to be in place before launching the Arabic market.

## What Changes

- **`scripts/scripts.js`**: Replace `lang='en'` hardcode with dynamic detection from the URL path. Add `applyDirection()` to set `dir="rtl"` and the `is-rtl` class on `<html>` based on lang, called before `decorateTemplateAndTheme()`.
- **`styles/styles.css`**: Add `[dir="rtl"]` CSS variable overrides for font, size, line-height using the existing font stack. Add global icon flip rules.
- **`blocks/header/header.css`**: Fix physical properties (`padding-left`, `left`, `right`, `text-align: left`) to logical equivalents. Add `[dir="rtl"]` overrides for nav dropdown and mobile menu.
- **`blocks/hero-banner/hero-banner.css`**: Fix `right` on CTA button and `left: 0` on content overlay to logical properties.
- **`blocks/section-intro/section-intro.css`**: Fix `margin-left/right` and `padding-left/right` to logical properties.
- **`blocks/text-with-image/text-with-image.css`**: Fix `padding-left` to `padding-inline-start`.

## Capabilities

### New Capabilities
- `rtl-direction-setup`: Runtime lang detection from URL and `dir="rtl"` injection into `<html>` before blocks are decorated.
- `arabic-typography`: Dedicated CSS variables for Arabic text reusing the existing font stack, with increased line-height and letter-spacing reset to 0 appropriate for Arabic.
- `rtl-layout-blocks`: All blocks (`header`, `hero-banner`, `section-intro`, `text-with-image`) use CSS logical properties, mirroring automatically in RTL without JS.

### Modified Capabilities
<!-- No existing specs have requirement changes -->

## Impact

- **`scripts/scripts.js`**: `loadEager()` logic changes — breaking if any code assumes `lang` is always `'en'`.
- **CSS blocks**: Physical properties replaced with logical equivalents — backward compatible with LTR, auto-mirrors in RTL.
- **Dependencies**: No new font dependencies — reusing existing font stack (`Calibre`, `Goudy`).
- **URL convention**: Arabic page URL pattern needs to be agreed upon (e.g. `/ar/` or `/global/ar/`) for lang detection to parse correctly.
