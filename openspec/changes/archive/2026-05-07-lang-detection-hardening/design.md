## Context

`getPageLang()` trong `scripts/scripts.js` dùng regex `^[a-z]{2,5}(-[a-z]{2,4})?$/i` để identify lang segment từ URL path. Regex này match theo *shape* (2–5 lowercase letters) — không phân biệt được ISO 639-1 language codes (`ar`, `en`, `fr`) với ISO 3166-1 alpha-2 country/market codes (`qa`, `sa`, `ae`, `kw`).

Kết quả: URL như `/qa/ar/page` bị detect là lang `"qa"` (country code Qatar), không phải `"ar"`. `applyDirection()` không set RTL, layout Arabic vỡ. Tương tự với `/sa/ar/`, `/ae/en/`. Ngoài ra, full BCP 47 regional tags (`ar-MA`, `ur-IN`, `he-IL`) không có trong `LANG_MAP` nên bị silently fallback về `"en"`.

Constraint: Fix phải không thay đổi interface của `getPageLang()` hay `applyDirection()` — chỉ thay đổi logic detection bên trong.

## Goals / Non-Goals

**Goals:**
- URL như `/qa/ar/`, `/sa/ar-MA/` detect đúng lang (`"ar"`, `"ar-MA"`)
- Full BCP 47 regional tags (`ar-SA`, `ur-IN`, `he-IL`, `zh-CN`) được normalize và trả về đúng
- URL aliases của Capella (`jp` → `"ja"`, `zh-cn` → `"zh-CN"`) vẫn hoạt động
- Fail-safe: segment không nhận ra → fallback `"en"`, không throw error

**Non-Goals:**
- Không validate BCP 47 exhaustively (không cần check IANA registry)
- Không tự động discover ngôn ngữ mới — mỗi ngôn ngữ là intentional product decision
- Không thay đổi `applyDirection()`, `RTL_LANGS`, hay bất kỳ logic RTL nào khác

## Decisions

### 1. VALID_LANG_PRIMARIES set thay vì regex

**Quyết định**: Validate segment bằng cách check primary code (`ar` của `ar-MA`) trong một Set các ISO 639-1 language codes đã biết (`VALID_LANG_PRIMARIES`), thay vì dùng regex shape-matching.

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

**Tại sao không dùng regex**: `qa`, `sa`, `ae` đều khớp `^[a-z]{2,5}$` — regex không thể phân biệt country code vs language code. Cần explicit allowlist.

**Tại sao không dùng LANG_MAP làm allowlist**: `LANG_MAP` hiện chỉ cho aliases (`jp`, `zh-cn`). Nếu dùng LANG_MAP làm allowlist, cần enum ~20+ Arabic regional tags + mọi LTR variant. Không scalable. `VALID_LANG_PRIMARIES` nhỏ gọn hơn — chỉ 21 entries phủ hết languages Capella có thể support.

**Tại sao không dùng blocklist market codes**: Danh sách market codes (`qa`, `sa`, `ae`, `kw`...) có thể thay đổi khi Capella mở market mới. Allowlist (VALID_LANG_PRIMARIES) safer hơn blocklist — unknown segment mặc định bị skip, không phải mặc định được accept.

---

### 2. BCP 47 region suffix normalize về UPPERCASE

**Quyết định**: Khi segment là full BCP 47 tag (`ar-ma`, `zh-cn`, `ur-in`), normalize về `language-REGION` casing chuẩn (`ar-MA`, `zh-CN`, `ur-IN`) bằng `parts[1].toUpperCase()`.

**Tại sao**: AEM EDS URL slugs luôn lowercase (convention). Nhưng `document.documentElement.lang` nên là BCP 47 chuẩn với UPPERCASE region để đúng với `hreflang` và `og:locale`. `ar-MA` khác `ar-ma` về mặt convention dù browser thường accept cả hai.

**Exception**: `LANG_MAP` aliases vẫn xử lý riêng để normalize về BCP 47 phức tạp hơn (`zh-cn` → `zh-CN` thay vì `zh-CN`).

---

### 3. LANG_MAP chỉ còn aliases, không phải primary lookup

**Quyết định**: `LANG_MAP` giữ nguyên vai trò là alias table cho URL slugs không khớp BCP 47 chuẩn. Chỉ cần có entries khi URL slug của Capella *khác* với BCP 47 primary.

```js
const LANG_MAP = {
  jp: 'ja',        // Capella dùng 'jp', BCP 47 chuẩn là 'ja'
  'zh-cn': 'zh-CN', // normalize casing
};
```

`ar`, `en`, `fr`, `he`... không cần entry trong `LANG_MAP` vì URL slug đã đúng với BCP 47 primary.

## Risks / Trade-offs

- **[Risk] Ngôn ngữ mới không có trong VALID_LANG_PRIMARIES → silently fallback `"en"`**
  → Mitigation: `console.warn` khi segment trông như lang code nhưng không trong set. Dev sẽ thấy warning trong console khi test trang mới.

- **[Risk] Content slug trùng với lang code** (ví dụ `/hotels/ar/` thực ra là path content, không phải lang)
  → Mitigation: Đây là authoring convention issue. AEM EDS convention quy định lang luôn ở đầu path — content slugs không nên là bare 2-letter codes. Document trong standards.

- **[Trade-off] VALID_LANG_PRIMARIES cần update khi thêm ngôn ngữ mới**
  → Đây là trade-off chấp nhận được: thêm ngôn ngữ là product decision, không phải technical accident. Update set là intentional gate.

## Migration Plan

1. Update `getPageLang()` trong `scripts/scripts.js` — thay logic detection
2. Không cần data migration, không cần server-side change
3. Rollback: revert `getPageLang()` về regex version — không có side effects
4. Test: verify `/qa/ar/`, `/ar-MA/`, `/ur-IN/` URLs detect đúng trước khi merge
