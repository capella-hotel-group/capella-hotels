## Why

Header và footer hiện tại chỉ load fragment từ metadata (`getMetadata('nav')` / `getMetadata('footer')`). Nếu author không set meta trên page hoặc fragment fetch thất bại, header/footer sẽ bị ẩn hoàn toàn. Cần một cơ chế fallback tự động tính đúng path — bao gồm cả site segment (`global`, `bangkok`, `sanya`) và lang segment raw từ URL (`jp`, `zh-cn`, `ar`) — để đảm bảo header/footer luôn hiển thị đúng.

## What Changes

- **`blocks/header/header.js`**: Sau khi Option 1 (metadata path) trả về `null`, tự parse URL để lấy site segment và lang segment, build fallback path và thử load lại.
- **`blocks/footer/footer.js`**: Tương tự — thêm cùng fallback logic.
- **Emblem href**: Cũng dùng cùng URL-parsed lang segment làm fallback thay vì hardcode `/`.
- Path fallback theo rule: `/{site}/{lang}/nav`, hoặc `/{site}/nav` nếu `en`, hoặc `/{lang}/nav` nếu không có site.
- Lang segment được lấy **raw từ URL** (không qua `html[lang]`) để tránh alias normalize (`jp→ja`, `zh-cn→zh-CN`).

## Capabilities

### New Capabilities

- `header-footer-lang-fallback`: Cơ chế fallback tự động tính nav/footer/emblem path từ site segment + raw lang segment trong URL khi metadata không có hoặc fragment load thất bại.

### Modified Capabilities

- `header-nav-zones`: Thay đổi cách header resolve nav path và emblem href — bổ sung fallback, không thay đổi requirements về layout hay zones.

## Impact

- `blocks/header/header.js` — thêm URL parsing helper + fallback logic trong `decorate()`
- `blocks/footer/footer.js` — thêm fallback logic trong `decorate()`
- Không thay đổi `scripts/scripts.js`, `fragment.js`, hay bất kỳ CSS nào
- Không breaking — Option 1 vẫn chạy trước, fallback chỉ kích hoạt khi cần
