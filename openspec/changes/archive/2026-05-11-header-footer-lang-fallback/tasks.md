## 1. URL parsing helper

- [x] 1.1 Write helper `getNavPathSegments()` in `header.js`: parse `window.location.pathname` to get site segment (match `supportedSites`) and raw lang segment (match `VALID_LANG_PRIMARIES` or `LANG_MAP` keys)
- [x] 1.2 Build fallback path from segments: `/{site}/{lang}/nav`, `/{site}/nav` (en), `/{lang}/nav` (no site), `/nav` (root en)

## 2. Header fallback

- [x] 2.1 Change `navPath` fallback from hardcoded `/nav` to `null` when metadata is absent
- [x] 2.2 Replace `loadFragment(navPath)` with: try Option 1 (if navPath exists), if null try Option 2 (URL-parsed fallback path)
- [x] 2.3 Fix emblem href: if `langList` does not match `currentPath.startsWith()`, fallback to URL-derived lang root instead of `/`

## 3. Footer fallback

- [x] 3.1 Change `footerPath` fallback from hardcoded `/footer` to `null` when metadata is absent
- [x] 3.2 Add inline URL parsing (using the same helper logic) to build the footer fallback path
- [x] 3.3 Replace `loadFragment(footerPath)` with: try Option 1, if null try Option 2
