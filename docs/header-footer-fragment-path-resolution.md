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

| Step     | Rule                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Site** | Find the first pathname segment matching `SUPPORTED_SITES`. If not found, use `DEFAULT_SITE_SEGMENT` (see below).                                                               |
| **Lang** | The next segment if it matches a key in `LANG_MAP` (alias slug) or a primary in `VALID_LANG_PRIMARIES`. Uses the **raw URL slug** — not normalized (`jp` stays `jp`, not `ja`). |
| **Path** | `/{site}/{lang}/nav` or `/{site}/{lang}/footer`, with empty segments dropped                                                                                                    |

### `DEFAULT_SITE_SEGMENT` toggle

`DEFAULT_SITE_SEGMENT` (`src/app/scripts.ts`) is the site segment used when the URL has no
recognized site segment. It is currently `''` (empty — no default), because the site does not
yet have multi-site/multi-language set up: a URL with no site segment resolves to the plain
root fragment (`/nav`, `/footer`) instead of being prefixed with a site.

Once multi-site/multi-language routing is introduced, flip this one constant back to `'global'`
to restore the previous behavior (`/global/nav`, `/global/footer`) — both `header.ts` and
`footer.ts` read the same constant, so they stay in sync automatically.

### Examples

| URL               | Resolved fragment path (`DEFAULT_SITE_SEGMENT = ''`) |
| ----------------- | ---------------------------------------------------- |
| `/page`           | `/nav` — no site/lang segment → root fragment        |
| `/en/page`        | `/en/nav` — no site segment, `en` recognized as lang |
| `/global/en/page` | `/global/en/nav` — explicit site + lang              |
| `/global/jp/page` | `/global/jp/nav` — raw slug, not `/global/ja/nav`    |
| `/bangkok/page`   | `/bangkok/nav`                                       |

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

Defined once in `src/app/scripts.ts` (compiled to `scripts/scripts.js` — never hand-edit the generated file) and exported for both blocks to import:

| Constant               | Purpose                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `SUPPORTED_SITES`      | Identifies the site segment in the URL (`global`, `bangkok`, `sanya`, `test-pages`)                |
| `DEFAULT_SITE_SEGMENT` | Site segment used when the URL has no recognized site segment (currently `''` — see toggle above)  |
| `LANG_MAP`             | Maps alias slugs to BCP 47 tags (`jp → ja`, `zh-cn → zh-CN`)                                       |
| `VALID_LANG_PRIMARIES` | Set of valid ISO 639-1 language primaries used to distinguish lang codes from market/country codes |

> **Note:** When a new site is added, update `SUPPORTED_SITES` in `src/app/scripts.ts` only — both blocks pick it up automatically.
