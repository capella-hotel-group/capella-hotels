## Context

Header and footer use `loadFragment()` to fetch content from a dedicated page (`/nav`, `/footer`) authored in Universal Editor. The path is resolved in two ways:

- **Option 1 (current)**: Read `<meta name="nav">` / `<meta name="footer">` set by the author on the page.
- **Option 2 (new)**: Parse the URL directly to get the site segment and lang segment, then build the corresponding path.

Actual URL structure used in this project:
```
/{site}/{lang}/page    → /global/ar/page, /sanya/jp/page
/{site}/page           → /bangkok/page  (English, no lang segment)
/{lang}/page           → /ar/page       (no site, with lang)
/page                  → /page          (global English)
```

Site segments: `global`, `bangkok`, `sanya`, `test-pages`.

Lang segments in the URL are **raw slugs**: `jp`, `zh-cn`, `ko`, `ar`, `en` — **not BCP 47**. `getPageLang()` in `scripts.js` normalizes them (`jp→ja`, `zh-cn→zh-CN`) for `html[lang]`, but the folders on SharePoint still use the raw slug. Therefore the fallback path must use the raw URL segment, not `html[lang]`.

## Goals / Non-Goals

**Goals:**
- Header/footer always loads even when the author forgets to set metadata
- Nav/footer path and emblem href both reflect the correct site + lang segment
- Raw URL slug is used directly to avoid alias mismatch

**Non-Goals:**
- No changes to `scripts.js`, `fragment.js`, or CSS
- No handling of the case where both options fail (existing hide/return behavior is kept)
- No validation of whether the site/lang exists on the server

## Decisions

### Use raw URL segment instead of `html[lang]`

`getPageLang()` normalizes `jp→ja`, `zh-cn→zh-CN` for `html[lang]`. But the folders on SharePoint are `jp/`, `zh-cn/`. Using `html[lang].toLowerCase()` would build `/global/ja/nav` while the actual folder is `/global/jp/nav` → 404.

Using the raw URL segment parsed directly from `window.location.pathname` ensures the correct folder match.

**Alternatives considered**: `html[lang].toLowerCase()` — simpler but incorrect for `jp` and other aliases.

### Parse site segment using a `supportedSites` list

The site segment is the first pathname segment matching the `supportedSites` list. The lang segment is the next segment (if present and a valid lang). Both are identified using `VALID_LANG_PRIMARIES` + `LANG_MAP` already in `scripts.js` — but since they cannot be imported, the minimal logic must be duplicated in a helper.

### Fallback only activates when Option 1 returns `null`

No double-fetch on the happy path. Option 2 only runs when metadata is missing or the fetch fails.

## Risks / Trade-offs

- **[Risk] A new site is added but `supportedSites` is not updated** → Fallback path built incorrectly (missing site segment). Mitigation: Document clearly that the list must be updated when a new site is added.
- **[Risk] `jp`, `zh-cn` are raw slugs; not all lang slugs validate through `VALID_LANG_PRIMARIES`** → `jp` is not in the set, so `LANG_MAP` must be checked first. The helper must replicate both checks.
- **[Trade-off] Double network request when Option 1 fails** → Acceptable because this is not the happy path.
