## 1. Foundation: scripts/scripts.js

- [x] 1.1 Thêm hàm `getPageLang()` — parse lang từ URL path, skip `"global"`, fallback về `"en"`
- [x] 1.2 Thêm hàm `applyDirection(lang)` — set `dir="rtl"` và `body.is-rtl` cho RTL langs (`ar`, `he`, `fa`, `ur`)
- [x] 1.3 Trong `loadEager()`: thay `document.documentElement.lang = 'en'` bằng `const lang = getPageLang()` + `document.documentElement.lang = lang` + `applyDirection(lang)`
- [x] 1.4 Verify thứ tự: `applyDirection()` chạy trước `decorateTemplateAndTheme()`

## 2. Global styles: styles/styles.css

- [x] 2.1 Thêm `[dir="rtl"]` block override `line-height` lên ≥ 1.8 cho body text
- [x] 2.2 Thêm `[dir="rtl"]` block set `letter-spacing: 0` cho Arabic text
- [x] 2.3 Thêm global icon flip rules: `[dir="rtl"] [class*="icon-arrow"]`, `[class*="icon-chevron"]`, `[class*="icon-back"]`, `[class*="icon-forward"]`, `[class*="icon-next"]`, `[class*="icon-prev"]` → `transform: scaleX(-1)`

## 3. Header block: blocks/header/header.css

- [x] 3.1 `padding-left: 5px` (`.header-lang-trigger::after`) → `padding-inline-start: 5px`
- [x] 3.2 `left: 0` (`.header-lang-dropdown`) → `inset-inline-start: 0`
- [x] 3.3 `right: 35px` (`.header-nav-dropdown-close`) → `inset-inline-end: 35px`
- [x] 3.4 `left: 50%` + `left: 50%` trên close button lines — giữ nguyên (center trick)
- [x] 3.5 `text-align: left` (`.header-nav-dropdown-cat`) → `text-align: start`
- [x] 3.6 `text-align: left` (`.header-menu-toggle`) → `text-align: start`
- [x] 3.7 `text-align: left` (`.header-mobile-nav-link`) → `text-align: start`
- [x] 3.8 `text-align: left` (`.header-mobile-nav-toggle`) → `text-align: start`
- [x] 3.9 `text-align: left` (`.header-mobile-lang-toggle`) → `text-align: start`
- [x] 3.10 `text-align: left` (`.header-mobile-panel .header-mobile-lang-list li`) → `text-align: start`
- [x] 3.11 `padding-left: 0` (`.nav-drop`) → `padding-inline-start: 0`
- [x] 3.12 `padding-right: 16px` (`.nav-drop`) → `padding-inline-end: 16px`
- [x] 3.13 `left: -24px` (nav-sections submenu) → `inset-inline-start: -24px`
- [x] 3.14 Thêm `[dir="rtl"]` override cho nav-sections submenu arrow (`right: 2px` → `inset-inline-end: 2px`)

## 4. Hero-banner block: blocks/hero-banner/hero-banner.css

- [x] 4.1 `left: 0` (`.hero-banner-content`) → `inset-inline-start: 0`
- [x] 4.2 `right: 30px` (`.hero-banner-cta`) → `inset-inline-end: 30px`
- [x] 4.3 `right: 20px` (`.hero-banner-cta` mobile) → `inset-inline-end: 20px`

## 5. Section-intro block: blocks/section-intro/section-intro.css

- [x] 5.1 `margin-left: auto; margin-right: auto` (`.section-intro-wrapper`) → `margin-inline: auto`
- [x] 5.2 `margin-left: auto` (`.section-intro`) → `margin-inline-start: auto`
- [x] 5.3 `padding-right: 35px` (`.subtext` mobile) → `padding-inline-end: 35px`
- [x] 5.4 `margin-left: 0` (`.desc` mobile) → `margin-inline-start: 0`
- [x] 5.5 `padding-left: 55px` (`.desc` mobile) → `padding-inline-start: 55px`
- [x] 5.6 `padding-right: 35px` (`.desc` mobile) → `padding-inline-end: 35px`

## 6. Text-with-image block: blocks/text-with-image/text-with-image.css

- [x] 6.1 `padding-left: 50px` (`.description`) → `padding-inline-start: 50px`
- [x] 6.2 `padding-left: 50px` (`.cta-link`) → `padding-inline-start: 50px`

## 7. QA & Verification

- [x] 7.1 Test LTR pages (`/global/en/`) — layout không thay đổi so với trước
- [x] 7.2 Test RTL bằng cách thêm `dir="rtl"` thủ công vào `<html>` trong DevTools — kiểm tra header, hero-banner, section-intro, text-with-image
- [x] 7.3 Verify thứ tự execution trong `loadEager()` — `applyDirection()` chạy trước `decorateTemplateAndTheme()`
- [x] 7.4 Confirm URL convention cho Arabic pages và test `getPageLang()` với URL đó
