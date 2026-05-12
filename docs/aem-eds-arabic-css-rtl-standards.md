# AEM EDS + Universal Editor — CSS / RTL & Arabic Site Standards

> **Scope:** CSS/RTL Styling Rules + Arabic Site Standards  
> **Stack:** AEM Edge Delivery Services + Universal Editor (Xwalk)  
> **Version:** 1.1 — Added BCP 47 Language Tags section

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
3. [BCP 47 Language Tags](#3-bcp-47-language-tags)
   - 3.1 [Tag Structure & Rules](#31-tag-structure--rules)
   - 3.2 [Arabic Tags — All Regions](#32-arabic-tags--all-regions)
   - 3.3 [Other RTL Languages](#33-other-rtl-languages)
   - 3.4 [Top 50 LTR Tags for Reference](#34-top-50-ltr-tags-for-reference)
   - 3.5 [Usage in AEM EDS](#35-usage-in-aem-eds)
   - 3.6 [BCP 47 Checklist](#36-bcp-47-checklist)

Follow this naming convention consistently across all environments:
 
  ```
  /content/{site-name}/{lang-tag}/{section}/{page}
  
  Examples:
    /content/mysite/en/products/solar-panels
    /content/mysite/ar/products/solar-panels        ← same slug, Arabic language
    /content/mysite/ar-sa/products/solar-panels     ← Saudi-specific variant
    /content/mysite/fr-ca/products/solar-panels     ← French Canada
  ```
  
  **Rules:**
  - Folder name must be **lowercase** and match the BCP 47 tag: `ar`, `ar-sa`, `fr-ca`
  - Hyphens in BCP 47 tags become hyphens in path: `ar-SA` → folder `ar-sa`
  - Never use underscores in folder names (`ar_SA` is wrong — that is `og:locale` format)
  - Page slug (last segment) should be the **same across all languages** — only the language segment changes
  - Do not use English slugs for Arabic pages (e.g. `/ar/about` is fine; `/ar/about-us-english` is not)
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

## 3. BCP 47 Language Tags

### 3.1 Tag Structure & Rules

BCP 47 tags follow the pattern `language-Script-REGION`. Only `language` is required; `Script` and `REGION` are optional subtags.

```
language  = ISO 639-1 two-letter code (lowercase)     e.g. ar, en, fr
Script    = ISO 15924 four-letter code (Title case)    e.g. Arab, Latn, Cyrl
REGION    = ISO 3166-1 two-letter code (UPPERCASE)     e.g. SA, AE, US
```

**Key rules:**

- Always write language in **lowercase**: `ar`, `en`, `fr`
- Always write region in **UPPERCASE**: `SA`, `AE`, `US`
- Always write script in **Title case**: `Arab`, `Latn`, `Hant`
- Use the **most specific tag** needed — no more, no less
- Omit region when the site targets all speakers of a language (e.g. `ar` not `ar-SA` for the language root)
- Use region only when content or format genuinely differs per country

---

### 3.2 Arabic Tags — All Regions

All Arabic tags require `dir="rtl"` on `<html>`.

| BCP 47 Tag | Region | `og:locale` | Notes |
|---|---|---|---|
| `ar` | Generic | `ar` | Language root — use for AEM MSM root & generic hreflang |
| `ar-SA` | Saudi Arabia | `ar_SA` | Largest digital market, most commonly used |
| `ar-AE` | UAE | `ar_AE` | Dubai/Abu Dhabi — high-value digital market |
| `ar-EG` | Egypt | `ar_EG` | MSA base dialect — most universally understood |
| `ar-KW` | Kuwait | `ar_KW` | |
| `ar-QA` | Qatar | `ar_QA` | |
| `ar-BH` | Bahrain | `ar_BH` | |
| `ar-OM` | Oman | `ar_OM` | |
| `ar-JO` | Jordan | `ar_JO` | |
| `ar-LB` | Lebanon | `ar_LB` | |
| `ar-IQ` | Iraq | `ar_IQ` | |
| `ar-SY` | Syria | `ar_SY` | |
| `ar-YE` | Yemen | `ar_YE` | |
| `ar-MA` | Morocco | `ar_MA` | Maghreb — dialect differs significantly |
| `ar-DZ` | Algeria | `ar_DZ` | Maghreb |
| `ar-TN` | Tunisia | `ar_TN` | Maghreb |
| `ar-LY` | Libya | `ar_LY` | |
| `ar-SD` | Sudan | `ar_SD` | |
| `ar-PS` | Palestine | `ar_PS` | |

> **Note:** `og:locale` uses underscore (`ar_SA`), not hyphen — Open Graph spec differs from BCP 47.

---

### 3.3 Other RTL Languages

| BCP 47 Tag | Language | Region | `dir` | Script |
|---|---|---|---|---|
| `he-IL` | Hebrew | Israel | `rtl` | `Hebr` |
| `fa-IR` | Persian / Farsi | Iran | `rtl` | `Arab` |
| `ur-PK` | Urdu | Pakistan | `rtl` | `Arab` |
| `ur-IN` | Urdu | India | `rtl` | `Arab` |

RTL detection in `scripts/scripts.js` must cover all four language codes:

```js
const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
```

---

### 3.4 Top 50 LTR Tags for Reference
<!-- Full language list reference https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry -->
| # | Tag | Language — Region |
|---|---|---|
| 1 | `en` | English — Generic |
| 2 | `en-US` | English — United States |
| 3 | `en-GB` | English — United Kingdom |
| 4 | `en-AU` | English — Australia |
| 5 | `en-CA` | English — Canada |
| 6 | `en-IN` | English — India |
| 7 | `zh-CN` | Chinese Simplified — China |
| 8 | `zh-TW` | Chinese Traditional — Taiwan |
| 9 | `zh-HK` | Chinese Traditional — Hong Kong |
| 10 | `fr-FR` | French — France |
| 11 | `fr-CA` | French — Canada |
| 12 | `fr-BE` | French — Belgium |
| 13 | `de-DE` | German — Germany |
| 14 | `de-AT` | German — Austria |
| 15 | `de-CH` | German — Switzerland |
| 16 | `es-ES` | Spanish — Spain |
| 17 | `es-MX` | Spanish — Mexico |
| 18 | `es-AR` | Spanish — Argentina |
| 19 | `es-US` | Spanish — United States |
| 20 | `pt-BR` | Portuguese — Brazil |
| 21 | `pt-PT` | Portuguese — Portugal |
| 22 | `it-IT` | Italian — Italy |
| 23 | `nl-NL` | Dutch — Netherlands |
| 24 | `nl-BE` | Dutch — Belgium |
| 25 | `pl-PL` | Polish — Poland |
| 26 | `ru-RU` | Russian — Russia |
| 27 | `sv-SE` | Swedish — Sweden |
| 28 | `da-DK` | Danish — Denmark |
| 29 | `fi-FI` | Finnish — Finland |
| 30 | `nb-NO` | Norwegian — Norway |
| 31 | `cs-CZ` | Czech — Czech Republic |
| 32 | `ro-RO` | Romanian — Romania |
| 33 | `hu-HU` | Hungarian — Hungary |
| 34 | `el-GR` | Greek — Greece |
| 35 | `tr-TR` | Turkish — Turkey |
| 36 | `uk-UA` | Ukrainian — Ukraine |
| 37 | `ja-JP` | Japanese — Japan |
| 38 | `ko-KR` | Korean — South Korea |
| 39 | `hi-IN` | Hindi — India |
| 40 | `vi-VN` | Vietnamese — Vietnam |
| 41 | `th-TH` | Thai — Thailand |
| 42 | `id-ID` | Indonesian — Indonesia |
| 43 | `ms-MY` | Malay — Malaysia |
| 44 | `fil-PH` | Filipino — Philippines |
| 45 | `bn-BD` | Bengali — Bangladesh |
| 46 | `ta-IN` | Tamil — India |
| 47 | `bg-BG` | Bulgarian — Bulgaria |
| 48 | `sk-SK` | Slovak — Slovakia |
| 49 | `ca-ES` | Catalan — Spain |
| 50 | `af-ZA` | Afrikaans — South Africa |

---

### 3.5 Usage in AEM EDS

**AEM Page Properties → Advanced → Language:**
Set the ISO language code here. AEM renders this as `<html lang="...">` on the page.

```
/content/mysite/en/   → Language: en
/content/mysite/ar/   → Language: ar
/content/mysite/ar-sa/→ Language: ar-SA  (if market-specific)
```

**`hreflang` pattern — single Arabic market:**

```html
<link rel="alternate" hreflang="en"        href="https://example.com/en/page">
<link rel="alternate" hreflang="ar"        href="https://example.com/ar/page">
<link rel="alternate" hreflang="x-default" href="https://example.com/en/page">
```

**`hreflang` pattern — multiple Arabic markets:**

```html
<link rel="alternate" hreflang="ar-SA"     href="https://example.com/ar-sa/page">
<link rel="alternate" hreflang="ar-AE"     href="https://example.com/ar-ae/page">
<link rel="alternate" hreflang="ar-EG"     href="https://example.com/ar-eg/page">
<link rel="alternate" hreflang="ar"        href="https://example.com/ar/page">
<link rel="alternate" hreflang="en"        href="https://example.com/en/page">
<link rel="alternate" hreflang="x-default" href="https://example.com/en/page">
```

**`og:locale` — note the underscore:**

```html
<!-- BCP 47 uses hyphen: ar-SA -->
<!-- Open Graph uses underscore: ar_SA -->
<meta property="og:locale"           content="ar_SA">
<meta property="og:locale:alternate" content="ar_AE">
<meta property="og:locale:alternate" content="en_US">
```

**RTL detection in `scripts/scripts.js` — full tag support:**

```js
// Handles both generic (ar) and region-specific (ar-SA) tags
const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

function applyDirection() {
  const lang = (
    document.documentElement.lang ||
    document.querySelector('meta[name="lang"]')?.content ||
    window.location.pathname.split('/')[1]
  ).split('-')[0]; // strip region: "ar-SA" → "ar"

  if (RTL_LANGS.includes(lang)) {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.classList.add('is-rtl');
  }
}

applyDirection();
```

> **Important:** Always call `.split('-')[0]` before checking against `RTL_LANGS` — this ensures `ar-SA`, `ar-AE`, and `ar-EG` all correctly resolve to `ar` and trigger RTL.

---

### 3.6 BCP 47 Checklist

- [ ] `<html lang>` uses correct BCP 47 tag — set via AEM Page Properties → Advanced → Language
- [ ] Generic tag (`ar`) used at language root level — not region-specific
- [ ] Region tag (`ar-SA`, `ar-AE`) used only when content genuinely differs per market
- [ ] `hreflang` covers every language/region variant of the page including `x-default`
- [ ] `og:locale` uses underscore format (`ar_SA`) — not hyphen
- [ ] RTL detection in `scripts.js` strips region suffix before checking language code
- [ ] `canonical` URL is unique per language — never shared across `ar` and `en`
- [ ] AEM language copy path matches the BCP 47 tag: `/content/mysite/ar/` for `lang="ar"`
- [ ] No mismatch between `<html lang>` and `hreflang` values on the same page

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
<!-- Arabic page -->
<html lang="ar" dir="rtl">
<meta charset="UTF-8">
<meta property="og:locale" content="ar_SA">
<link rel="alternate" hreflang="ar"        href="...">
<link rel="alternate" hreflang="en"        href="...">
<link rel="alternate" hreflang="x-default" href="...">
```

### BCP 47 vs og:locale — Format Difference

| Context | Format | Example |
|---|---|---|
| `<html lang>` | hyphen | `ar-SA` |
| `hreflang` | hyphen | `ar-SA` |
| `og:locale` | underscore | `ar_SA` |
| AEM Page Properties | hyphen | `ar-SA` |