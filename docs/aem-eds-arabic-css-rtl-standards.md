# AEM EDS + Universal Editor — CSS / RTL & Arabic Site Standards

> **Scope:** CSS/RTL Styling Rules + Arabic Site Standards  
> **Stack:** AEM Edge Delivery Services + Universal Editor (Xwalk)  
> **Version:** 1.0

---

## Table of Contents

1. [CSS / RTL Styling Rules](#1-css--rtl-styling-rules)
   - 1.1 [Direction Setup](#11-direction-setup)
   - 1.2 [Logical Properties — Mandatory](#12-logical-properties--mandatory)
   - 1.3 [RTL Selector Pattern](#13-rtl-selector-pattern)
   - 1.4 [Font Rules](#14-font-rules)
   - 1.5 [Icon Handling](#15-icon-handling)
   - 1.6 [CSS Checklist](#16-css-checklist)
2. [Arabic Site Standards](#2-arabic-site-standards)
   - 2.1 [HTML Document Rules](#21-html-document-rules)
   - 2.2 [Typography Rules](#22-typography-rules)
   - 2.3 [Number & Date Format](#23-number--date-format)
   - 2.4 [Image & Media Rules](#24-image--media-rules)
   - 2.5 [QA / Testing Checklist](#25-qa--testing-checklist)

---

## 1. CSS / RTL Styling Rules

### 1.1 Direction Setup

Set `dir="rtl"` on the `<html>` element only — **never** on individual blocks or components.

Detect language and apply direction in `scripts/scripts.js` before any block is decorated:

```js
// scripts/scripts.js
const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

function applyDirection() {
  const lang =
    document.documentElement.lang ||
    document.querySelector('meta[name="lang"]')?.content ||
    window.location.pathname.split('/')[1];

  if (RTL_LANGS.includes(lang)) {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.classList.add('is-rtl');
  }
}

applyDirection();
```

> **Rule:** `applyDirection()` must run before `loadBlocks()` — direction must be known at decoration time.

---

### 1.2 Logical Properties — Mandatory

**Never hardcode `left` / `right` in any CSS file.** Use CSS logical properties so layout mirrors automatically when `dir="rtl"` is set.

| ❌ Avoid | ✅ Use instead |
|---|---|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `border-left` | `border-inline-start` |
| `border-right` | `border-inline-end` |
| `text-align: left` | `text-align: start` |
| `text-align: right` | `text-align: end` |
| `float: left` | `float: inline-start` |
| `float: right` | `float: inline-end` |
| `left: 0` | `inset-inline-start: 0` |
| `right: 0` | `inset-inline-end: 0` |

**Example — correct block CSS:**

```css
/* blocks/cards/cards.css */

/* ✅ Logical — auto-mirrors in RTL */
.cards .cards-item {
  margin-inline-start: 1rem;
  padding-inline-end: 1.5rem;
  border-inline-start: 3px solid var(--color-brand);
}
```

---

### 1.3 RTL Selector Pattern

Use `[dir="rtl"]` selectors for cases where logical properties are not enough (flex order, absolute positioning, complex layouts). Always scope to the block.

**Global overrides** go in `styles/styles.css`:

```css
/* styles/styles.css */

[dir="rtl"] {
  font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
  letter-spacing: 0;
  word-spacing: 0;
}

[dir="rtl"] * {
  text-align: start;
}
```

**Block-level overrides** go in the block's own CSS file:

```css
/* blocks/header/header.css */

/* LTR default */
.header nav {
  display: flex;
  gap: 1rem;
}

/* RTL override — scoped to block */
[dir="rtl"] .header nav {
  flex-direction: row-reverse;
}

[dir="rtl"] .header .nav-dropdown {
  inset-inline-start: 0;
  inset-inline-end: auto;
}
```

> **Rule:** Never write `[dir="rtl"]` overrides in a global file for block-specific layouts. Keep them inside the block's CSS file.

---

### 1.4 Font Rules

Define fonts via CSS custom properties and override for RTL — do not hardcode `font-family` across multiple selectors.

```css
/* styles/styles.css */

@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;700&display=swap');

:root {
  --body-font-family: 'Helvetica Neue', Arial, sans-serif;
  --heading-font-family: 'Helvetica Neue', Arial, sans-serif;
  --body-font-size: 16px;
  --body-line-height: 1.5;
}

[dir="rtl"] {
  --body-font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
  --heading-font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
  --body-font-size: 17px;      /* Arabic needs ~10% larger to match visual weight */
  --body-line-height: 1.9;     /* Arabic needs more line height than Latin */
}
```

**Font rules:**

- Primary: `Cairo` — clean, modern, excellent for UI
- Fallback: `Noto Sans Arabic` — covers all Arabic Unicode ranges
- Final fallback: `Arial` — always available
- Never use `letter-spacing` on Arabic text — it breaks character connections (kashida)
- Never use `font-style: italic` on Arabic — most Arabic fonts do not have true italics

---

### 1.5 Icon Handling

Icons that have a directional meaning must be flipped in RTL. Icons that are neutral must not be flipped.

```css
/* styles/styles.css — global icon flip rules */

/* Directional icons — MUST flip */
[dir="rtl"] [class*="icon-arrow"],
[dir="rtl"] [class*="icon-chevron"],
[dir="rtl"] [class*="icon-back"],
[dir="rtl"] [class*="icon-forward"],
[dir="rtl"] [class*="icon-next"],
[dir="rtl"] [class*="icon-prev"] {
  transform: scaleX(-1);
}
```

| Icon type | Flip in RTL? | Examples |
|---|---|---|
| Navigation arrows | ✅ Yes | chevron, back, forward, next, prev |
| Breadcrumb separator | ✅ Yes | `>` becomes `<` |
| Quote mark | ✅ Yes | opening/closing quotes |
| Close / X | ❌ No | modal close button |
| Star / heart / like | ❌ No | rating, favorites |
| Logo | ❌ No | keep per brand guideline |
| Play / pause | ❌ No | media controls |
| Checkmark | ❌ No | status icons |

---

### 1.6 CSS Checklist

- [ ] No `margin-left`, `margin-right`, `padding-left`, `padding-right` anywhere in codebase
- [ ] No `text-align: left` or `text-align: right` hardcoded — use `start` / `end`
- [ ] No `float: left` or `float: right` — use `float: inline-start` / `inline-end`
- [ ] All `position: absolute` elements use `inset-inline-start` / `inset-inline-end`
- [ ] `letter-spacing: 0` applied to Arabic font context
- [ ] `line-height` is `1.8` or higher for Arabic content
- [ ] All directional icons have `[dir="rtl"]` + `scaleX(-1)` applied
- [ ] `[dir="rtl"]` block overrides live inside the block's own CSS file
- [ ] Font fallback chain: Cairo → Noto Sans Arabic → Arial
- [ ] Test by toggling `dir="rtl"` on `<html>` in DevTools before merging

---

## 2. Arabic Site Standards

### 2.1 HTML Document Rules

Every Arabic page must have these attributes and meta tags set correctly.

**Required on `<html>`:**

```html
<html lang="ar" dir="rtl">
```

Set `lang="ar"` via AEM Page Properties → Advanced → Language. The `dir` attribute is applied by `scripts.js` at runtime based on `lang`.

**Required in `<head>`:**

```html
<!-- Charset — mandatory for Arabic rendering -->
<meta charset="UTF-8">

<!-- Locale for social sharing -->
<meta property="og:locale" content="ar_SA"> <!-- or ar_AE, ar_EG per market -->

<!-- Hreflang — mandatory for SEO -->
<link rel="alternate" hreflang="en" href="https://example.com/en/page-slug">
<link rel="alternate" hreflang="ar" href="https://example.com/ar/page-slug">
<link rel="alternate" hreflang="x-default" href="https://example.com/en/page-slug">

<!-- Canonical — each language has its own canonical -->
<link rel="canonical" href="https://example.com/ar/page-slug">
```

**Full reference table:**

| Element | Rule |
|---|---|
| `<html lang>` | Must be `"ar"` — set from AEM Page Properties |
| `<html dir>` | Must be `"rtl"` — applied by scripts.js at runtime |
| `charset` | UTF-8 — required for Arabic Unicode |
| `og:locale` | `ar_SA` / `ar_AE` / `ar_EG` depending on target market |
| `hreflang` | Required for every EN ↔ AR page pair |
| `canonical` | Separate canonical per language — never share |
| `robots` | Ensure `/ar/` is not blocked in `robots.txt` |

---

### 2.2 Typography Rules

Arabic typography has different requirements from Latin. These must be respected globally.

| Property | Latin (default) | Arabic |
|---|---|---|
| `font-family` | Helvetica Neue, Arial | Cairo, Noto Sans Arabic, Arial |
| `font-size` (body) | 16px | 17–18px (10–15% larger for equal visual weight) |
| `line-height` | 1.5 | 1.8–2.0 |
| `letter-spacing` | `0.01em` (optional) | `0` — never use with Arabic |
| `word-spacing` | normal | `0` or very minimal |
| `font-style: italic` | Supported | Avoid — most Arabic fonts lack true italic |
| `font-weight` | Any | `400` and `700` most reliable across Arabic fonts |
| `text-rendering` | default | `optimizeLegibility` |

```css
/* styles/styles.css — body typography for Arabic */

[dir="rtl"] body {
  font-family: var(--body-font-family);
  font-size: var(--body-font-size);
  line-height: var(--body-line-height);
  letter-spacing: 0;
  word-spacing: 0;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

/* Headings */
[dir="rtl"] h1,
[dir="rtl"] h2,
[dir="rtl"] h3,
[dir="rtl"] h4 {
  font-family: var(--heading-font-family);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.4;
}
```

---

### 2.3 Number & Date Format

| Type | Format | Notes |
|---|---|---|
| Numbers | Western Arabic: `0 1 2 3 4 5 6 7 8 9` | Default for most modern Arabic sites |
| Date | `DD/MM/YYYY` | Right-to-left reading order applies |
| Currency | `1,500 ر.س` | Number first, currency symbol after |
| Phone | Use `<bdi>` tag | Prevents digit reversal in RTL context |
| Percentages | `٪ 85` or `85%` | Depends on market convention |

**Handling mixed content (Arabic + numbers/Latin):**

Use the `<bdi>` tag for any inline number or Latin string inside Arabic text. This isolates the bidirectional algorithm for that element.

```html
<!-- ✅ Correct — number isolated with <bdi> -->
<p dir="rtl">السعر: <bdi>1,500 USD</bdi> فقط</p>

<!-- ✅ Correct — phone number isolated -->
<p dir="rtl">اتصل بنا: <bdi dir="ltr">+966 50 000 0000</bdi></p>

<!-- ❌ Wrong — number may render reversed without <bdi> -->
<p dir="rtl">السعر: 1,500 USD فقط</p>
```

**Unicode direction marks (use sparingly):**

```html
<!-- RLM (Right-to-Left Mark) — U+200F -->
<!-- Use when <bdi> is not possible (e.g., plain text, attributes) -->
<a href="tel:+966500000000">‏+966 50 000 0000</a>
```

---

### 2.4 Image & Media Rules

| Asset type | Rule |
|---|---|
| Images with Arabic text | Create a dedicated Arabic version — do not flip |
| Images with Latin text | Do not flip — keep original orientation |
| Background images | Must have sufficient space on both sides for RTL text overlay |
| Directional icons (SVG) | Flip with `scaleX(-1)` via CSS — do not modify the SVG source |
| Non-directional icons | Never flip (close, star, heart, play, check) |
| Logo | Never flip — follow brand guidelines |
| Video with text overlay | Requires a separate Arabic version |
| Alt text | Must be written in Arabic for Arabic pages |

**Background image text overlay:**

```css
/* ✅ Hero with text overlay — safe for both directions */
.hero {
  background-image: url('/media/hero-neutral.jpg'); /* centered composition */
}

/* Only swap the image if the Arabic version exists */
[dir="rtl"] .hero {
  background-image: url('/media/hero-ar.jpg');
}

/* Text positioning using logical properties */
.hero-content {
  inset-inline-start: 2rem;  /* moves automatically in RTL */
}
```

---

### 2.5 QA / Testing Checklist

Run all checks below before deploying any Arabic page to production.

**HTML & Structure**

- [ ] `<html lang="ar" dir="rtl">` is present on all Arabic pages
- [ ] `charset="UTF-8"` is in `<head>`
- [ ] `hreflang` tags correct for all EN ↔ AR page pairs
- [ ] `og:locale` set to correct region (`ar_SA`, `ar_AE`, etc.)
- [ ] Canonical URL is Arabic page URL — not pointing to English
- [ ] `/ar/` is not blocked in `robots.txt`

**Layout & Direction**

- [ ] No text renders LTR inside an Arabic page
- [ ] Navigation: items in correct RTL order, dropdowns open to the correct side
- [ ] Breadcrumb: separator points in the correct direction (`<` not `>`)
- [ ] Scrollbar appears on the left side (browser handles this automatically with `dir="rtl"`)
- [ ] Modal / drawer: opens from the correct side
- [ ] Forms: labels right-aligned, placeholder text in Arabic

**Typography**

- [ ] Arabic font (Cairo or Noto Sans Arabic) loads correctly
- [ ] Font fallback works when primary font fails to load
- [ ] `line-height` is `1.8` or above for all Arabic body text
- [ ] `letter-spacing` is `0` — no inherited values from LTR styles
- [ ] No `font-style: italic` on Arabic text

**Numbers & Mixed Content**

- [ ] Inline numbers inside Arabic text use `<bdi>` tag
- [ ] Phone numbers render correctly without digit reversal
- [ ] Currency format is correct for target market
- [ ] Date format is `DD/MM/YYYY`

**Icons & Images**

- [ ] All directional icons (arrows, chevrons) are flipped
- [ ] Non-directional icons (close, star) are not flipped
- [ ] Logo is not flipped
- [ ] Background images with text have an Arabic-specific version where needed
- [ ] All `alt` attributes on Arabic pages are written in Arabic

**Performance & SEO**

- [ ] Lighthouse score ≥ 90 on Arabic pages (same as English target)
- [ ] Arabic font loaded with `display=swap` to avoid FOIT
- [ ] No unused Latin-only font weights loaded on Arabic pages

**Cross-device**

- [ ] Tested on iOS Safari with Arabic keyboard active
- [ ] Tested on Android Chrome with Arabic keyboard active
- [ ] Tested on Windows with Arabic locale set in OS

---

## Quick Reference

### CSS Property Decision Tree

```
Need to set spacing/position?
  ├── Is it horizontal (left/right axis)?
  │     └── Use logical property:
  │           margin-inline-start / margin-inline-end
  │           padding-inline-start / padding-inline-end
  │           inset-inline-start / inset-inline-end
  └── Is it vertical (top/bottom axis)?
        └── Use physical property as normal:
              margin-top / margin-bottom
              padding-top / padding-bottom
              inset-block-start / inset-block-end

Need to flip an icon?
  ├── Does the icon imply direction? (arrow, chevron, back)
  │     └── [dir="rtl"] .icon { transform: scaleX(-1); }
  └── Is the icon neutral? (close, star, check)
        └── Do nothing
```

### Key CSS Variables for Arabic

```css
[dir="rtl"] {
  --body-font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
  --heading-font-family: 'Cairo', 'Noto Sans Arabic', Arial, sans-serif;
  --body-font-size: 17px;
  --body-line-height: 1.9;
  --letter-spacing: 0;
}
```

### Mandatory HTML Attributes

```html
<html lang="ar" dir="rtl">
<meta charset="UTF-8">
<link rel="alternate" hreflang="ar" href="...">
<link rel="alternate" hreflang="en" href="...">
<link rel="alternate" hreflang="x-default" href="...">
```
