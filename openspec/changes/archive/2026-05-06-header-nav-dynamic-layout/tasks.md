## 1. CSS — Thay thế absolute positioning bằng flex sub-groups

- [x] 1.1 Trong `header.css`: đổi `.header-nav` từ `display: contents` thành `position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 30px 1fr; align-items: center; pointer-events: none`
- [x] 1.2 Trong `header.css`: thêm `.header-nav-left { display: flex; align-items: center; justify-content: flex-end; gap: 20px; padding-inline-end: 20px; pointer-events: auto; }`
- [x] 1.3 Trong `header.css`: thêm `.header-nav-right { display: flex; align-items: center; justify-content: flex-start; gap: 20px; padding-inline-start: 20px; pointer-events: auto; }`
- [x] 1.4 Trong `header.css`: xóa rule `[data-nav-side="left"] { left: calc(50% - 250px); }` và `[data-nav-side="right"] { right: calc(50% - 250px); }`
- [x] 1.5 Trong `header.css`: xóa `position: absolute` khỏi `.header-nav-link, .header-nav-drop-trigger` (chúng giờ là flex items trong sub-group)

## 2. JS — buildNavZone() tạo sub-groups

- [x] 2.1 Trong `header.js`, hàm `buildNavZone()`: tạo hai sub-group `const navLeft = document.createElement('div'); navLeft.className = 'header-nav-left'` và tương tự `header-nav-right`
- [x] 2.2 Trong `header.js`, `buildNavZone()`: trong forEach, thay vì `nav.append(...)`, route item vào đúng group: `side === 'left' ? navLeft.append(el) : navRight.append(el)`
- [x] 2.3 Trong `header.js`, `buildNavZone()`: append cả hai sub-groups vào nav: `nav.append(navLeft, navRight)`

## 3. Verify

- [x] 3.1 Desktop 2 items (1+1): Destinations bên trái, Experiences bên phải — không overlap emblem
- [x] 3.2 Desktop 3 items (2+1): Destinations + Experiences bên trái với gap 20px, NewItem bên phải — không overlap nhau
- [x] 3.3 Desktop 3 items (1+2): 1 item trái, 2 items phải với gap 20px
- [x] 3.4 Dropdown vẫn mở được sau khi item không còn `position: absolute`
- [x] 3.5 Xóa lang hoặc CTA — nav group vẫn centered trong header
