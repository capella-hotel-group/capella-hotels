## Why

`header.js` parse `/nav` document với assumption cứng: Destinations có đúng 1 `<ul>` con, và tất cả nav items nằm trong đúng 1 `<ul>` root. Khi author nhập sai cấu trúc trong Universal Editor (tạo nhiều nested lists cho sub-categories, hoặc tạo list riêng cho Experiences), JS bỏ qua dữ liệu silently — không có error, không có warning, header render thiếu items mà không ai biết tại sao. Cần fix JS defensive + thêm authoring guide để ngăn lỗi tái diễn.

## What Changes

- **`blocks/header/header.js`**: Fix `buildDropdown()` để merge nhiều `<ul>` siblings thành 1 danh sách sub-categories. Fix `decorate()` để collect `<li>` từ tất cả `<ul>` trong `sections[0]` thay vì chỉ `<ul>` đầu tiên. Thêm `console.warn` rõ ràng khi detect cấu trúc invalid (thiếu lang list, thiếu nav items).
- **`docs/header-nav-authoring-guide.md`**: Tạo mới authoring guide với visual diff đúng/sai, rules rõ ràng cho từng phần của `/nav` document.

## Capabilities

### New Capabilities
- `header-nav-authoring-guide`: Tài liệu hướng dẫn author cấu trúc đúng cho `/nav` document trong Universal Editor.

### Modified Capabilities
- `header-desktop-layout`: JS parse logic của header block thay đổi — defensive hơn với malformed authoring input, có warning rõ ràng khi cấu trúc invalid.

## Impact

- **`blocks/header/header.js`**: `buildDropdown()` và `decorate()` thay đổi parse logic. Backward compatible — structure đúng vẫn hoạt động như cũ.
- **`docs/header-nav-authoring-guide.md`**: File mới, không impact code.
- **Breaking**: Không có.
