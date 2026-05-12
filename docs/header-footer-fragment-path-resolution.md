# Header & Footer — Fragment Path Resolution

## Overview

Both `header.js` and `footer.js` use the same two-option mechanism to resolve the nav/footer fragment path.

---

## Option 1 — Metadata (happy path)

The author sets a meta tag on the page:
- Header: `<meta name="nav" content="/global/en/nav">`
- Footer: `<meta name="footer" content="/global/en/footer">`

If the meta value is present, it is used directly as the path for `loadFragment()`.

---

## Option 2 — URL fallback

Activated when the meta tag is absent **or** when `loadFragment(metadataPath)` returns `null`.

Parses `window.location.pathname` to compute the path automatically.

### Logic

| Step | Rule |
|------|------|
| **Site** | Find the first pathname segment matching `SUPPORTED_SITES`. If not found, default to `global`. ⚠️ **See open question below.** |
| **Lang** | The next segment if it matches a key in `LANG_MAP` (alias slug) or a primary in `VALID_LANG_PRIMARIES`. Uses the **raw URL slug** — not normalized (`jp` stays `jp`, not `ja`). |
| **Path** | `/{site}/{lang}/nav` or `/{site}/{lang}/footer` |

### Examples

| URL | Resolved fragment path |
|-----|------------------------|
| `/global/en/page` | `/global/en/nav` |
| `/global/ar/page` | `/global/ar/nav` |
| `/global/jp/page` | `/global/jp/nav` — raw slug, not `/global/ja/nav` |
| `/en/page` | `/global/en/nav` — no site segment → defaults to `global` |
| `/ar/page` | `/global/ar/nav` — no site segment → defaults to `global` |
| `/bangkok/page` | `/bangkok/nav` |

### Final fallback

If both Option 1 and Option 2 fail:
- **Header**: hides entirely (`display: none`)
- **Footer**: returns silently, nothing is rendered

---

## Emblem href (header only)

1. Search langList `<a>` hrefs for one where `currentPath.startsWith(href)` — use it as the emblem link.
2. If no match → fall back to `getFragmentBasePath() + '/'` (URL-derived lang root).

---

## Shared constants

Defined once in `scripts/scripts.js` and exported for both blocks to import:

| Constant | Purpose |
|----------|---------|
| `SUPPORTED_SITES` | Identifies the site segment in the URL (`global`, `bangkok`, `sanya`, `test-pages`) |
| `LANG_MAP` | Maps alias slugs to BCP 47 tags (`jp → ja`, `zh-cn → zh-CN`) |
| `VALID_LANG_PRIMARIES` | Set of valid ISO 639-1 language primaries used to distinguish lang codes from market/country codes |

> **Note:** When a new site is added, update `SUPPORTED_SITES` in `scripts/scripts.js` only — both blocks pick it up automatically.

---

## ⚠️ Open Question — Default site when no site segment is found

**Pending confirmation from Srikrishnan.**

When the URL has no recognized site segment (e.g. `/en/page`, `/ar/page`), the current implementation defaults the site to `global`, producing `/global/en/nav`.

**Alternatives under consideration:**

| Behavior | Resolved path for `/en/page` |
|----------|------------------------------|
| Default to `global` *(current)* | `/global/en/nav` |
| No default — use lang only | `/en/nav` |
| No default — use root | `/nav` |

Until confirmed, the code uses `global` as the default. If the correct behavior differs, update `getFragmentBasePath()` in both `header.js` and `footer.js` (the `site` fallback value on the line: `const site = siteIdx !== -1 ? segments[siteIdx] : 'global'`).
