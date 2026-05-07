## 1. Fix header.js — Defensive parse

- [x] 1.1 Fix `buildDropdown()`: thay `srcItem.querySelector(':scope > ul')?.querySelectorAll(':scope > li')` bằng `querySelectorAll(':scope > ul')` + `flatMap` để merge tất cả `<ul>` siblings thành 1 flat list sub-categories
- [x] 1.2 Thêm `console.warn(...)` với dynamic label khi detect nhiều `<ul>` siblings trong nav item có sub-categories
- [x] 1.3 Fix `decorate()`: thay `sections[0]?.querySelector('ul')` bằng `navContent.querySelectorAll(':scope > ul')` + `flatMap` để collect `<li>` từ tất cả `<ul>` trong section 0 (qua `default-content-wrapper`)
- [x] 1.4 Thêm `console.warn('[header] Nav structure invalid: missing language list. Check /nav document.')` trước khi `hide()` khi `!langList`
- [x] 1.5 Thêm `console.warn('[header] Nav structure invalid: no nav items found. Check /nav document.')` trước khi `hide()` khi `!navItems.length`

## 2. Tạo authoring guide

- [x] 2.1 Tạo `docs/header-nav-authoring-guide.md` với cấu trúc: Overview, Section rules (Languages / Destinations / Plain nav items / CTA / Logo), ví dụ ✅ đúng và ❌ sai cho từng rule

## 3. Verification

- [x] 3.1 Verify structure đúng (1 `<ul>`) vẫn render đúng — không bị regression
- [x] 3.2 Verify Destinations với 3 `<ul>` riêng → merge thành 1 dropdown đủ 3 tabs + warn logged
- [x] 3.3 Verify Experiences trong `<ul>` thứ hai → được collect + render đúng
- [x] 3.4 Verify `/nav` thiếu lang list → warn logged + header hidden

## 4. Spec sync

- [x] 4.1 Sync delta spec `header-desktop-layout` vào `openspec/specs/header-desktop-layout/spec.md`
- [x] 4.2 Tạo `openspec/specs/header-nav-authoring-guide/spec.md` từ delta spec

## 5. Additional fixes discovered during implementation

- [x] 5.1 Fix `decorate()`: dùng `sections[0].querySelector('.default-content-wrapper') ?? sections[0]` làm root trước khi query `':scope > ul'` — cần thiết vì AEM EDS wrap content vào `default-content-wrapper` sau decoration
- [x] 5.2 Fix `buildLangZone()`: trigger hiện đúng ngôn ngữ của trang hiện tại bằng cách match `window.location.pathname.startsWith(href)` thay vì luôn lấy `sourceItems[0]`
- [x] 5.3 Fix `buildNavZone()` + `buildMobilePanel()`: plain nav item không có `<p>` wrapper (e.g. `<li><a href>الخبرات</a></li>`) → fallback sang `srcItem.querySelector(':scope > a')`
- [x] 5.4 Fix `buildMobilePanel()`: áp dụng `querySelectorAll(':scope > ul')` + `flatMap` cho mobile accordion giống như fix desktop dropdown
- [x] 5.5 Fix `buildLangZone()`: lang item không có `<a>` tag → wrap trong `<a href="#">` thay vì render plain text
