## 1. Desktop — Grid layout cho header-inner

- [x] 1.1 Trong `header.css`: thay `display: flex; justify-content: space-between` trên `.header-inner` thành `display: grid; grid-template-columns: 1fr auto 1fr`
- [x] 1.2 Trong `header.css`: thêm `justify-self: end` cho `.header-cta` để giữ CTA ở cột phải
- [x] 1.3 Trong `header.css`: xóa `flex: 0 0 auto` trên `.header-lang` và `.header-cta` (không còn cần thiết trong grid)

## 2. Desktop — data-nav-side thay class-based positioning

- [x] 2.1 Trong `header.js`, hàm `buildNavZone()`: sau khi tạo element cho mỗi nav item, gán `el.dataset.navSide = i < Math.ceil(navItems.length / 2) ? 'left' : 'right'` (với `el` là element được append vào nav — `wrapper` nếu có dropdown, `a` nếu là plain link)
- [x] 2.2 Trong `header.css`: thêm hai rule mới `[data-nav-side="left"] { position: absolute; left: calc(50% - 250px); }` và `[data-nav-side="right"] { position: absolute; right: calc(50% - 250px); }`
- [x] 2.3 Trong `header.css`: xóa rule riêng `.header-nav-link { right: calc(50% - 250px); }` và `.header-nav-drop-trigger { left: calc(50% - 250px); }` (đã được thay bởi data attribute rules)

## 3. Mobile — data-open thay label-based class trên panel

- [x] 3.1 Trong `header.js`, hàm `buildMobilePanel()`: thay logic accordion từ `panel.classList.add/remove(expandedClass)` sang `list.dataset.open = 'true'/'false'` — close all bằng cách set `dataset.open = 'false'` trên tất cả lists trong accordions array, rồi set `dataset.open = 'true'` trên list của item được click
- [x] 3.2 Trong `header.js`: cập nhật lang list click handler từ `panel.classList.remove('is-lang-expanded')` sang `langUl.dataset.open = 'false'`
- [x] 3.3 Trong `header.css`: thêm rule `.header-mobile-nav-list[data-open="true"]` với các giá trị từ `.header-mobile-panel.is-destinations-expanded .header-mobile-nav-list`
- [x] 3.4 Trong `header.css`: thêm rule `.header-mobile-lang-list[data-open="true"]` với các giá trị từ `.header-mobile-panel.is-lang-expanded .header-mobile-lang-list`
- [x] 3.5 Trong `header.css`: xóa rule `.header-mobile-panel.is-destinations-expanded .header-mobile-nav-list` và `.header-mobile-panel.is-lang-expanded .header-mobile-lang-list`

## 4. Verify

- [x] 4.1 Desktop: ẩn `.header-lang` bằng CSS → CTA vẫn ở phải, nav vẫn centered
- [x] 4.2 Desktop: ẩn `.header-cta` bằng CSS → lang vẫn ở trái, nav vẫn centered
- [x] 4.3 Desktop: đổi Experiences thành item có `<ul>` trong `index.html` → cả hai items vẫn đúng vị trí (không overlap)
- [x] 4.4 Mobile: thêm nav item mới có dropdown bất kỳ label → accordion mở được
- [x] 4.5 Mobile: LANGUAGES accordion vẫn mở/đóng đúng
