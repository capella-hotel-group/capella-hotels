## Why

Project hiện không hỗ trợ RTL hay Arabic — `lang` hardcode là `en`, không có `dir` detection, và nhiều CSS block dùng physical properties (`left`, `right`, `padding-left`...) sẽ vỡ layout khi render Arabic. Cần làm nền tảng RTL trước khi ra mắt Arabic market.

## What Changes

- **`scripts/scripts.js`**: Thay `lang='en'` hardcode bằng dynamic detection từ URL path. Thêm `applyDirection()` set `dir="rtl"` và `is-rtl` class trên `<html>` dựa theo lang, gọi trước `decorateTemplateAndTheme()`.
- **`styles/styles.css`**: Thêm `[dir="rtl"]` CSS variable overrides cho font, size, line-height dùng chung font stack hiện có. Thêm global icon flip rules.
- **`blocks/header/header.css`**: Fix các physical properties (`padding-left`, `left`, `right`, `text-align: left`) sang logical equivalents. Thêm `[dir="rtl"]` overrides cho nav dropdown và mobile menu.
- **`blocks/hero-banner/hero-banner.css`**: Fix `right` trên CTA button và `left: 0` trên content overlay sang logical properties.
- **`blocks/section-intro/section-intro.css`**: Fix `margin-left/right` và `padding-left/right` sang logical properties.
- **`blocks/text-with-image/text-with-image.css`**: Fix `padding-left` sang `padding-inline-start`.

## Capabilities

### New Capabilities
- `rtl-direction-setup`: Runtime lang detection từ URL và `dir="rtl"` injection vào `<html>` trước khi blocks được decorated.
- `arabic-typography`: CSS variables riêng cho Arabic text dùng chung font stack hiện có, với line-height tăng và letter-spacing về 0 phù hợp với Arabic.
- `rtl-layout-blocks`: Tất cả blocks (`header`, `hero-banner`, `section-intro`, `text-with-image`) dùng CSS logical properties, tự mirror trong RTL mà không cần JS.

### Modified Capabilities
<!-- Không có existing specs bị thay đổi requirements -->

## Impact

- **`scripts/scripts.js`**: Logic `loadEager()` thay đổi — breaking nếu có code nào assume `lang` luôn là `'en'`.
- **CSS blocks**: Thay physical properties bằng logical equivalents — backward compatible với LTR, tự mirror trong RTL.
- **Dependencies**: Không thêm font dependency mới — dùng lại font stack hiện có (`Calibre`, `Goudy`).
- **URL convention**: Cần thống nhất URL pattern cho Arabic pages (ví dụ `/ar/` hay `/global/ar/`) để lang detection parse đúng.
