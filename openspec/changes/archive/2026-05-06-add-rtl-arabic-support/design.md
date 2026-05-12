## Context

The codebase is AEM Edge Delivery Services + Universal Editor (Xwalk). All blocks render client-side, CSS is loaded via `loadCSS()`. `scripts.js` is the entry point — everything starts from `loadEager()`.

Current problems:
- `document.documentElement.lang` is hardcoded to `'en'` in `loadEager()` — does not reflect the actual page language
- No `dir` attribute on `<html>` — the browser does not know to render RTL
- CSS blocks use physical properties (`left`, `right`, `padding-left`...) — these will break layout in RTL

Key constraint: `dir="rtl"` **must be set before** any block is decorated, because CSS `[dir="rtl"]` selectors need to know the context at render time. Setting it later will cause a layout flash.

## Goals / Non-Goals

**Goals:**
- Set `lang` correctly from the URL path instead of hardcoding
- Set `dir="rtl"` on `<html>` before `decorateTemplateAndTheme()` and `decorateMain()`
- All CSS blocks use logical properties — auto-mirror without extra JS
- `[dir="rtl"]` overrides for cases where logical properties are insufficient (complex absolute positioning)
- RTL typography adjustments via CSS variables (line-height, letter-spacing)

**Non-Goals:**
- No new Arabic font — reuse existing font stack (`Calibre`, `Goudy`)
- No bidi text mixing (`<bdi>` tag) handling in this scope — that is the responsibility of content authors
- No language switching UI — the existing header already has a lang selector
- No number or date format handling — out of scope for CSS/JS

## Decisions

### 1. Lang detection from URL path

**Decision**: Parse lang from the URL path segment, fallback to `'en'`.

```js
const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

function getPageLang() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  // Convention: /global/<lang>/... or /<lang>/...
  // Find the first segment matching the BCP 47 pattern (2-5 chars, not 'global')
  const lang = segments.find((s) => s !== 'global' && /^[a-z]{2,5}(-[a-z]{2,4})?$/i.test(s));
  return lang || 'en';
}
```

**Why not `<meta name="lang">`**: AEM EDS does not guarantee this meta tag is present on every page. The URL is a more reliable source of truth.

**Why not `document.documentElement.lang` from HTML**: AEM EDS renders the HTML shell before content loads — this value may not be correct when `loadEager()` runs.

---

### 2. `applyDirection()` runs inside `loadEager()` before decoration

**Decision**: Call `applyDirection()` at the top of `loadEager()`, before `decorateTemplateAndTheme()`.

```js
async function loadEager(doc) {
  const lang = getPageLang();
  document.documentElement.lang = lang;
  applyDirection(lang);           // ← before all decoration
  decorateTemplateAndTheme();
  ...
}

function applyDirection(lang) {
  const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
  if (RTL_LANGS.includes(lang)) {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.classList.add('is-rtl');
  }
}
```

**Why not CSS `:lang(ar)` selector instead of JS**: CSS `:lang()` only works after the `lang` attribute is set — JS still needs to set `dir`. Also, `[dir="rtl"]` selectors are clearer in intent.

---

### 3. Logical properties in CSS — no JS to flip layout

**Decision**: Replace physical properties (`left`, `right`, `padding-left`...) with CSS logical properties (`inset-inline-start`, `padding-inline-start`...). Use `[dir="rtl"]` selectors only for complex cases (absolute positioning with calc, flex-direction reversal).

**Why not JS to swap classes/styles**: CSS logical properties are standard, zero-JS, with no reflow after `dir` is set. More performant and easier to maintain.

**Why not `transform: scaleX(-1)` on the entire block**: This would flip both text and images — not acceptable.

---

### 4. RTL typography via CSS variables, no new fonts

**Decision**: Override the `[dir="rtl"]` block in `styles.css` to adjust `line-height` (increase to ~1.8) and `letter-spacing: 0` (Arabic does not use letter-spacing). Reuse the existing font stack.

**Why**: Arabic text needs a higher line-height than Latin so diacritics are not clipped. `letter-spacing` on Arabic breaks character connections (kashida). `Calibre` and `Goudy` fonts have sufficient Unicode coverage for basic Arabic display.

---

### 5. Icon flip — directional icons only

**Decision**: Use `[dir="rtl"] [class*="icon-arrow"]`, `[class*="icon-chevron"]`... with `transform: scaleX(-1)`. Neutral icons (close, logo) are not flipped.

## Risks / Trade-offs

- **[Risk] URL convention not yet agreed upon** → Lang detection may parse incorrectly if Arabic page URL patterns differ from `/global/ar/`. Mitigation: Confirm URL pattern before shipping; the regex in `getPageLang()` is easy to adjust.

- **[Risk] `Calibre` font has no Arabic glyphs** → Browser will fall back to system Arabic font (typically Arial or system default) — layout may differ from expectations. Mitigation: Test directly on Arabic content; add a dedicated Arabic font in a later phase only if needed.

- **[Risk] `body.classList.add('is-rtl')` runs after `body` renders** → May cause a flash if other JS reads this class. Mitigation: `is-rtl` is used only for CSS `body.is-rtl` selectors when needed, not for JS logic.

- **[Trade-off] Logical properties do not support IE11** → Not a concern for AEM EDS — target is modern browsers.

## Migration Plan

1. Ship `scripts.js` changes first — this is the foundation; does not break LTR pages (if URL has no lang segment, falls back to `'en'`).
2. Ship `styles.css` changes — purely additive (`[dir="rtl"]` activates only when the attribute is present).
3. Ship each block CSS separately — can be merged independently, no interdependencies.
4. Rollback: Revert `scripts.js` to hardcoded `lang='en'` — `dir` attribute will not be set, RTL CSS will not activate.

## Open Questions

- What is the URL pattern for Arabic pages? `/ar/...` or `/global/ar/...`? → Affects the regex in `getPageLang()`.
- Does the `Calibre` font have Arabic glyph coverage? → Needs testing with real Arabic content.
