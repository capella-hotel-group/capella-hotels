## Context

`getPageLang()` in `scripts/scripts.js` uses a regex `^[a-z]{2,5}(-[a-z]{2,4})?$/i` to identify the lang segment from the URL path. This regex matches by *shape* (2–5 lowercase letters) — it cannot distinguish ISO 639-1 language codes (`ar`, `en`, `fr`) from ISO 3166-1 alpha-2 country/market codes (`qa`, `sa`, `ae`, `kw`).

Result: URLs like `/qa/ar/page` are detected as lang `"qa"` (country code Qatar), not `"ar"`. `applyDirection()` does not set RTL, and Arabic layout breaks. The same happens with `/sa/ar/`, `/ae/en/`. Additionally, full BCP 47 regional tags (`ar-MA`, `ur-IN`, `he-IL`) are not in `LANG_MAP` and silently fall back to `"en"`.

Constraint: The fix must not change the interface of `getPageLang()` or `applyDirection()` — only the detection logic inside.

## Goals / Non-Goals

**Goals:**
- URLs like `/qa/ar/`, `/sa/ar-MA/` detect the correct lang (`"ar"`, `"ar-MA"`)
- Full BCP 47 regional tags (`ar-SA`, `ur-IN`, `he-IL`, `zh-CN`) are normalized and returned correctly
- Capella URL aliases (`jp` → `"ja"`, `zh-cn` → `"zh-CN"`) continue to work
- Fail-safe: unrecognized segment → fallback to `"en"`, no error thrown

**Non-Goals:**
- No exhaustive BCP 47 validation (IANA registry check not required)
- No automatic discovery of new languages — each language is an intentional product decision
- No changes to `applyDirection()`, `RTL_LANGS`, or any other RTL logic

## Decisions

### 1. VALID_LANG_PRIMARIES set instead of regex

**Decision**: Validate a segment by checking its primary code (the `ar` in `ar-MA`) against a Set of known ISO 639-1 language codes (`VALID_LANG_PRIMARIES`), instead of using regex shape-matching.

```js
const VALID_LANG_PRIMARIES = new Set([
  'ar', 'en', 'fr', 'de', 'ja', 'ko', 'zh',
  'he', 'fa', 'ur', 'it', 'es', 'pt', 'ru',
  'nl', 'tr', 'hi', 'vi', 'th', 'id', 'ms',
]);

function getPageLang() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  for (const s of segments) {
    const lower = s.toLowerCase();
    // 1. Check alias map first (jp → ja, zh-cn → zh-CN)
    if (LANG_MAP[lower]) return LANG_MAP[lower];
    // 2. Validate primary against known language codes
    const primary = lower.split('-')[0];
    if (VALID_LANG_PRIMARIES.has(primary)) {
      const parts = lower.split('-');
      return parts.length > 1
        ? `${parts[0]}-${parts[1].toUpperCase()}` // ar-ma → ar-MA
        : parts[0];                                // ar → ar
    }
  }
  return 'en';
}
```

**Why not use regex**: `qa`, `sa`, `ae` all match `^[a-z]{2,5}$` — regex cannot distinguish country codes from language codes. An explicit allowlist is required.

**Why not use LANG_MAP as allowlist**: `LANG_MAP` currently handles only aliases (`jp`, `zh-cn`). Using it as an allowlist would require enumerating 20+ Arabic regional tags plus all LTR variants. Not scalable. `VALID_LANG_PRIMARIES` is more compact — just 21 entries covering all languages Capella may support.

**Why not use a blocklist of market codes**: The list of market codes (`qa`, `sa`, `ae`, `kw`...) can change as Capella opens new markets. An allowlist (VALID_LANG_PRIMARIES) is safer than a blocklist — unknown segments are skipped by default, not accepted by default.

---

### 2. BCP 47 region suffix normalized to UPPERCASE

**Decision**: When a segment is a full BCP 47 tag (`ar-ma`, `zh-cn`, `ur-in`), normalize to standard `language-REGION` casing (`ar-MA`, `zh-CN`, `ur-IN`) using `parts[1].toUpperCase()`.

**Why**: AEM EDS URL slugs are always lowercase (convention). However, `document.documentElement.lang` should follow BCP 47 standard with UPPERCASE region for correct `hreflang` and `og:locale`. `ar-MA` differs from `ar-ma` by convention, though browsers typically accept both.

**Exception**: `LANG_MAP` aliases are still handled separately to normalize to more complex BCP 47 forms (`zh-cn` → `zh-CN`).

---

### 3. LANG_MAP remains aliases only, not a primary lookup

**Decision**: `LANG_MAP` retains its role as an alias table for URL slugs that do not match standard BCP 47. Entries are only needed when Capella's URL slug *differs* from the BCP 47 primary.

```js
const LANG_MAP = {
  jp: 'ja',        // Capella uses 'jp', BCP 47 standard is 'ja'
  'zh-cn': 'zh-CN', // normalize casing
};
```

`ar`, `en`, `fr`, `he`... do not need entries in `LANG_MAP` because their URL slugs already match the BCP 47 primary.

## Risks / Trade-offs

- **[Risk] New language not in VALID_LANG_PRIMARIES → silently falls back to `"en"`**
  → Mitigation: `console.warn` when a segment looks like a lang code but is not in the set. Developers will see the warning in the console when testing a new page.

- **[Risk] Content slug matches a lang code** (e.g. `/hotels/ar/` is actually a content path, not a lang)
  → Mitigation: This is an authoring convention issue. AEM EDS convention specifies that lang is always at the start of the path — content slugs should not be bare 2-letter codes. Document in standards.

- **[Trade-off] VALID_LANG_PRIMARIES must be updated when a new language is added**
  → This is an acceptable trade-off: adding a language is a product decision, not a technical accident. Updating the set is an intentional gate.

## Migration Plan

1. Update `getPageLang()` in `scripts/scripts.js` — replace detection logic
2. No data migration required, no server-side changes
3. Rollback: revert `getPageLang()` to the regex version — no side effects
4. Test: verify `/qa/ar/`, `/ar-MA/`, `/ur-IN/` URLs detect correctly before merging
