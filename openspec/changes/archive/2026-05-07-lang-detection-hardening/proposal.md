## Why

`getPageLang()` uses a regex `^[a-z]{2,5}$` to detect the lang segment from the URL — this regex cannot distinguish ISO 639-1 language codes (`ar`, `en`) from ISO 3166-1 country/market codes (`qa`, `sa`, `ae`). Result: URLs like `/qa/ar/page` are detected as lang `"qa"` instead of `"ar"`, RTL is not set, and Arabic pages break layout. Additionally, full BCP 47 tags like `ar-MA`, `ur-IN` are not handled correctly by the current `LANG_MAP`.

## What Changes

- **`scripts/scripts.js`**: Replace regex-based detection in `getPageLang()` with validation against a `VALID_LANG_PRIMARIES` set (ISO 639-1 language codes). A segment is accepted if and only if its primary code (the `ar` in `ar-MA`) is in the set. URL aliases (`jp` → `ja`) continue to be handled via `LANG_MAP`. BCP 47 region suffixes are normalized to correct casing (`ar-ma` → `ar-MA`).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `rtl-direction-setup`: Requirement changed — lang detection must validate the primary language code against the `VALID_LANG_PRIMARIES` set instead of regex shape-matching. Must handle full BCP 47 tags with region suffix (`ar-MA`, `ur-IN`). Must skip market/country codes (`qa`, `sa`, `ae`) not present in the set.

## Impact

- **`scripts/scripts.js`**: Only `getPageLang()` changes. `applyDirection()` is unchanged because `.split('-')[0]` already handles this correctly.
- **Behavior**: Pages with URL `/qa/ar/` were previously detected incorrectly (`"qa"`) — after the fix they will be correct (`"ar"`). A breaking change in the right direction.
- **Extensibility**: Adding a new language = adding one entry to `VALID_LANG_PRIMARIES` and optionally to `LANG_MAP` for aliases.
- **No CSS changes**: No CSS changes, no HTML structure changes.
