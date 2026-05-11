## 1. URL parsing helper

- [x] 1.1 Viết helper `getNavPathSegments()` trong `header.js`: parse `window.location.pathname` để lấy site segment (match `supportedSites`) và raw lang segment (match `VALID_LANG_PRIMARIES` hoặc `LANG_MAP` keys)
- [x] 1.2 Build fallback path từ segments: `/{site}/{lang}/nav`, `/{site}/nav` (en), `/{lang}/nav` (no site), `/nav` (root en)

## 2. Header fallback

- [x] 2.1 Đổi `navPath` fallback từ hardcode `/nav` thành `null` khi metadata không có
- [x] 2.2 Thay `loadFragment(navPath)` thành: thử Option 1 (nếu có navPath), nếu null thử Option 2 (URL-parsed fallback path)
- [x] 2.3 Fix emblem href: nếu `langList` không match `currentPath.startsWith()`, fallback về URL-derived lang root thay vì `/`

## 3. Footer fallback

- [x] 3.1 Đổi `footerPath` fallback từ hardcode `/footer` thành `null` khi metadata không có
- [x] 3.2 Thêm inline URL parsing (dùng cùng logic helper) để build footer fallback path
- [x] 3.3 Thay `loadFragment(footerPath)` thành: thử Option 1, nếu null thử Option 2
