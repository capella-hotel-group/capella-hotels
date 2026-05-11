## Context

Header và footer dùng `loadFragment()` để fetch nội dung từ page riêng (`/nav`, `/footer`) được author trên Universal Editor. Path được xác định qua 2 cách:

- **Option 1 (hiện tại)**: Đọc `<meta name="nav">` / `<meta name="footer">` do author set trên page.
- **Option 2 (mới)**: Tự parse URL để lấy site segment và lang segment, build path tương ứng.

URL structure thực tế của project:
```
/{site}/{lang}/page    → /global/ar/page, /sanya/jp/page
/{site}/page           → /bangkok/page  (English, no lang segment)
/{lang}/page           → /ar/page       (no site, with lang)
/page                  → /page          (global English)
```

Site segments: `global`, `bangkok`, `sanya`, `test-pages`.

Lang segments trong URL là **raw slugs**: `jp`, `zh-cn`, `ko`, `ar`, `en` — **không phải BCP 47**. `getPageLang()` trong `scripts.js` normalize chúng (`jp→ja`, `zh-cn→zh-CN`) cho `html[lang]`, nhưng folder trên SharePoint vẫn dùng raw slug. Do đó fallback path phải dùng raw URL segment, không qua `html[lang]`.

## Goals / Non-Goals

**Goals:**
- Header/footer luôn load được khi author quên set metadata
- Nav/footer path và emblem href đều đúng site + lang segment
- Raw URL slug được dùng trực tiếp để tránh alias mismatch

**Non-Goals:**
- Không thay đổi `scripts.js`, `fragment.js`, hay CSS
- Không handle trường hợp cả 2 option đều fail (đã có hide/return hiện tại)
- Không validate xem site/lang có tồn tại trên server không

## Decisions

### Dùng raw URL segment thay vì `html[lang]`

`getPageLang()` normalize `jp→ja`, `zh-cn→zh-CN` cho `html[lang]`. Nhưng folder trên SharePoint là `jp/`, `zh-cn/`. Nếu dùng `html[lang].toLowerCase()` sẽ build `/global/ja/nav` trong khi folder thực là `/global/jp/nav` → 404.

Dùng raw URL segment parse trực tiếp từ `window.location.pathname` đảm bảo khớp đúng folder.

**Alternatives considered**: `html[lang].toLowerCase()` — đơn giản hơn nhưng sai với `jp` và các alias khác.

### Parse site segment bằng `supportedSites` list

Site segment là segment đầu tiên trong pathname match với danh sách `supportedSites`. Lang segment là segment ngay sau site (nếu có và là valid lang). Cả hai được xác định bằng `VALID_LANG_PRIMARIES` + `LANG_MAP` đã có trong `scripts.js` — nhưng do không import được, cần duplicate logic tối giản trong helper.

### Fallback chỉ kích hoạt khi Option 1 trả về `null`

Không có double-fetch ở happy path. Option 2 chỉ chạy khi metadata thiếu hoặc fetch fail.

## Risks / Trade-offs

- **[Risk] Thêm site vào danh sách nhưng quên update `supportedSites`** → Fallback path build sai (thiếu site segment). Mitigation: document rõ cần update list khi thêm site mới.
- **[Risk] `jp`, `zh-cn` là raw slugs, không phải tất cả lang slugs đều validate được qua `VALID_LANG_PRIMARIES`** → `jp` không có trong set, cần check `LANG_MAP` trước. Helper phải replicate cả 2 checks.
- **[Trade-off] Double network request khi Option 1 fail** → Chấp nhận được vì không phải happy path.
