# Header & Footer — Fragment Path Resolution

## Overview

Both blocks honor page metadata first. Their fallback behavior differs:

- The header tries a `nav` fragment beside the current page, then the root `/nav` fragment.
- The footer derives a `/footer` path from the current site/language segments.

---

## Option 1 — Metadata (happy path)

The author sets a meta tag on the page:

- Header: `<meta name="nav" content="/global/en/nav">`
- Footer: `<meta name="footer" content="/global/en/footer">`

If the meta value is present, it is used directly as the path for `loadFragment()`.

---

## Fallbacks

Fallbacks are tried when the metadata path is absent or its fragment cannot be loaded.

### Header

The header removes the last segment of `window.location.pathname` and appends `nav`, then tries root `/nav` if the sibling fragment cannot be loaded. For example:

| Page URL                                                            | First fallback                                 | Final fallback       |
| ------------------------------------------------------------------- | ---------------------------------------------- | -------------------- |
| `/test-pages/culturist-card`                                        | `/test-pages/nav`                              | `/nav`               |
| `/content/capella-hotels/test-pages/qa/en/destination-introduction` | `/content/capella-hotels/test-pages/qa/en/nav` | `/nav`               |
| `/page`                                                             | `/nav`                                         | No duplicate request |

### Footer

The footer parses `window.location.pathname` to compute a site/language-specific path.

### Logic

| Step     | Rule                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Site** | Find the first pathname segment matching `SUPPORTED_SITES`. If not found, use `DEFAULT_SITE_SEGMENT` (see below).                                                               |
| **Lang** | The next segment if it matches a key in `LANG_MAP` (alias slug) or a primary in `VALID_LANG_PRIMARIES`. Uses the **raw URL slug** — not normalized (`jp` stays `jp`, not `ja`). |
| **Path** | `/{site}/{lang}/footer`, with empty segments dropped                                                                                                                            |

### `DEFAULT_SITE_SEGMENT` toggle

`DEFAULT_SITE_SEGMENT` (`src/app/scripts.ts`) is currently `'global'`. It is used by the footer fallback and the header's language-switcher home-link fallback when the URL has no recognized site segment. It does not affect the header's sibling-nav fallback.

### Examples

| URL               | Resolved footer path (`DEFAULT_SITE_SEGMENT = 'global'`) |
| ----------------- | -------------------------------------------------------- |
| `/page`           | `/global/footer`                                         |
| `/en/page`        | `/global/en/footer`                                      |
| `/global/en/page` | `/global/en/footer`                                      |
| `/global/jp/page` | `/global/jp/footer` — raw slug, not `/global/ja/footer`  |
| `/bangkok/page`   | `/bangkok/footer`                                        |

### Final fallback

If metadata and the block's fallback paths fail:

- **Header**: hides entirely (`display: none`)
- **Footer**: returns silently, nothing is rendered

---

## Emblem href (header only)

1. Search langList `<a>` hrefs for one where `currentPath.startsWith(href)` — use it as the emblem link.
2. If no match → fall back to `getFragmentBasePath() + '/'` (URL-derived lang root).

---

## Shared constants

Defined in `src/app/scripts.ts` (compiled to `scripts/scripts.js` — never hand-edit the generated file):

| Constant               | Purpose                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `SUPPORTED_SITES`      | Identifies the site segment in the URL (`global`, `bangkok`, `sanya`, `test-pages`)                |
| `DEFAULT_SITE_SEGMENT` | Site segment used when the URL has no recognized site segment (currently `''` — see toggle above)  |
| `LANG_MAP`             | Maps alias slugs to BCP 47 tags (`jp → ja`, `zh-cn → zh-CN`)                                       |
| `VALID_LANG_PRIMARIES` | Set of valid ISO 639-1 language primaries used to distinguish lang codes from market/country codes |

> **Note:** When a new site is added, update `SUPPORTED_SITES` in `src/app/scripts.ts`; the footer and header language-switcher fallback use it.
