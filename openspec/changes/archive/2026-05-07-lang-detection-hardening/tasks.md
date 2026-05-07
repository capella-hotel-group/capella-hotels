## 1. Refactor `getPageLang()` in scripts.js

- [x] 1.1 Add `VALID_LANG_PRIMARIES` Set constant (ISO 639-1 primaries Capella supports) alongside existing `LANG_MAP` and `RTL_LANGS`
- [x] 1.2 Rewrite `getPageLang()` loop: check `LANG_MAP` alias first, then validate primary via `VALID_LANG_PRIMARIES.has()`, normalize BCP 47 region to UPPERCASE (`ar-ma` → `ar-MA`), fallback `"en"`
- [x] 1.3 Remove old regex-based `find()` logic — ensure no other code references the old pattern

## 2. Verification

- [x] 2.1 Verify `/qa/ar/page` → `"ar"` and RTL is set
- [x] 2.2 Verify `/sa/ar-MA/page` → `"ar-MA"` and RTL is set
- [x] 2.3 Verify `/ur-IN/page` → `"ur-IN"` and RTL is set
- [x] 2.4 Verify `/global/ar/` → `"ar"` (global skip still works)
- [x] 2.5 Verify `/jp/hotels` → `"ja"` (alias still works)
- [x] 2.6 Verify `/zh-cn/page` → `"zh-CN"` (alias + casing normalization)
- [x] 2.7 Verify `/en/page` → `"en"` and RTL is NOT set
- [x] 2.8 Verify `/about-us` (no lang prefix) → `"en"` fallback

## 3. Spec sync

- [x] 3.1 Update `openspec/specs/rtl-direction-setup/spec.md` with the MODIFIED requirement from this change's delta spec
