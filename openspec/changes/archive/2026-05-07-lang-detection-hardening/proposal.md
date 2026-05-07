## Why

`getPageLang()` dùng regex `^[a-z]{2,5}$` để detect lang segment từ URL — regex này không phân biệt được ISO 639-1 language codes (`ar`, `en`) với ISO 3166-1 country/market codes (`qa`, `sa`, `ae`). Kết quả: URL như `/qa/ar/page` bị detect là lang `"qa"` thay vì `"ar"`, RTL không được set, Arabic page vỡ layout. Ngoài ra, full BCP 47 tags như `ar-MA`, `ur-IN` cũng không được handle đúng với `LANG_MAP` hiện tại.

## What Changes

- **`scripts/scripts.js`**: Thay regex-based detection trong `getPageLang()` bằng validation dựa trên `VALID_LANG_PRIMARIES` set (ISO 639-1 language codes). Segment được accept khi và chỉ khi primary code (`ar` của `ar-MA`) có trong set. URL aliases (`jp` → `ja`) vẫn được xử lý qua `LANG_MAP`. BCP 47 region suffix được normalize về đúng casing (`ar-ma` → `ar-MA`).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `rtl-direction-setup`: Requirement thay đổi — lang detection phải validate primary language code qua `VALID_LANG_PRIMARIES` set thay vì regex shape-matching. Phải handle full BCP 47 tags với region suffix (`ar-MA`, `ur-IN`). Phải skip market/country codes (`qa`, `sa`, `ae`) không có trong set.

## Impact

- **`scripts/scripts.js`**: Chỉ hàm `getPageLang()` thay đổi. `applyDirection()` không đổi vì đã có `.split('-')[0]` đúng.
- **Behavior**: Trang có URL `/qa/ar/` trước đây bị detect sai (`"qa"`) — sau fix sẽ đúng (`"ar"`). Breaking theo chiều tốt.
- **Extensibility**: Thêm ngôn ngữ mới = thêm 1 entry vào `VALID_LANG_PRIMARIES` và optionally `LANG_MAP` cho aliases.
- **No CSS changes**: Không có thay đổi CSS, không có thay đổi HTML structure.
