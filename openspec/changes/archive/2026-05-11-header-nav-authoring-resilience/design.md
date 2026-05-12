## Context

`header.js` hiện parse `/nav` document với 2 assumptions cứng:

1. `buildDropdown()`: `srcItem.querySelector(':scope > ul')` — chỉ lấy `<ul>` **đầu tiên** trong Destinations `<li>`. Nếu author tạo nhiều `<ul>` riêng biệt cho từng sub-category group, chỉ group đầu tiên được render.

2. `decorate()`: `sections[0].querySelector('ul')` — chỉ lấy `<ul>` **đầu tiên** trong section 0. Nếu Experiences bị author đặt vào `<ul>` thứ hai tách biệt, item đó hoàn toàn bị bỏ qua.

Cả 2 trường hợp fail silently — header render thiếu items, không có error, không có warning. Author không biết họ nhập sai.

Constraint: Không thể enforce nested list structure ở UE level — component model chỉ validate block-level fields, không validate HTML tree depth.

## Goals / Non-Goals

**Goals:**
- `buildDropdown()` merge tất cả `<ul>` siblings trong một `<li>` thành 1 flat list sub-categories
- `decorate()` collect `<li>` từ tất cả `<ul>` trong `sections[0]`, không chỉ `<ul>` đầu tiên
- `console.warn` rõ ràng khi detect cấu trúc invalid (thiếu lang list, thiếu nav items) để dev/QA biết ngay khi test
- `docs/header-nav-authoring-guide.md` mô tả đúng/sai với ví dụ HTML cho dev team reference

**Non-Goals:**
- Không fix text thừa trong link label (e.g. `الخبرات(Experience)`) — đó là content issue
- Không validate sâu hơn (depth, ordering) — ranh giới: "reasonable authoring variations", không phải "arbitrary broken structure"
- Không implement UE-level validation — ngoài tầm của block JS

## Decisions

### 1. Merge nhiều `<ul>` trong `buildDropdown()` bằng `querySelectorAll` + `flatMap`

**Quyết định**:
```js
// Thay thế querySelector(':scope > ul')?.querySelectorAll(':scope > li')
const subItems = [...srcItem.querySelectorAll(':scope > ul')]
  .flatMap((ul) => [...ul.querySelectorAll(':scope > li')]);
```

**Tại sao `querySelectorAll` + `flatMap` thay vì chỉ `querySelector`**: Cover được cả structure đúng (1 `<ul>`) lẫn sai (nhiều `<ul>`). Kết quả giống nhau — flat array of `<li>`. Zero overhead.

---

### 2. Collect từ nhiều `<ul>` root trong `decorate()` bằng `querySelectorAll` + `flatMap`

**Quyết định**:
```js
// Thay thế sections[0]?.querySelector('ul')
const topLevelItems = sections[0]
  ? [...sections[0].querySelectorAll(':scope > ul')]
      .flatMap((ul) => [...ul.querySelectorAll(':scope > li')])
  : [];
```

**Tại sao không giữ `querySelector` rồi thêm fallback**: Fallback phức tạp hơn, dễ bug. `querySelectorAll` + `flatMap` đơn giản và idempotent — nếu author nhập đúng (1 `<ul>`), behavior giống hệt như trước.

---

### 3. `console.warn` thay vì `console.error` hay throw

**Quyết định**: Dùng `console.warn` với message rõ `[header]` prefix và path gợi ý fix.

**Tại sao không throw**: AEM EDS không có global error boundary — throw sẽ crash toàn bộ `loadEager()`. `console.warn` đủ để dev/QA thấy trong DevTools mà không ảnh hưởng các block khác.

**Tại sao không `console.error`**: Không phải lỗi runtime — là authoring mistake. `warn` level phù hợp hơn.

---

### 4. Authoring guide là Markdown trong `docs/`, không phải inline comment trong `/nav`

**Quyết định**: Tạo `docs/header-nav-authoring-guide.md` trong repo.

**Tại sao không comment trong `/nav` document**: `/nav` sống trong SharePoint/GDocs — comment có thể bị xóa bởi author, không version-controlled. Markdown trong repo được review và track cùng code.

## Risks / Trade-offs

- **[Risk] Author tạo cấu trúc sai theo cách khác** → Mitigation: `console.warn` giúp detect nhanh khi QA test. Không thể cover mọi case — ranh giới đã được define rõ.
- **[Trade-off] `flatMap` merge order phụ thuộc vào DOM order** → Acceptable: DOM order = authoring order, đây là behavior mong muốn.
