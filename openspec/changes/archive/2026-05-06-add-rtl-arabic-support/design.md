## Context

Codebase hiện tại là AEM Edge Delivery Services + Universal Editor (Xwalk). Tất cả blocks render phía client, CSS được load qua `loadCSS()`. `scripts.js` là entry point — mọi thứ bắt đầu từ `loadEager()`.

Vấn đề hiện tại:
- `document.documentElement.lang` hardcode `'en'` trong `loadEager()` — không phản ánh đúng ngôn ngữ trang
- Không có `dir` attribute trên `<html>` — browser không biết render RTL
- CSS các block dùng physical properties (`left`, `right`, `padding-left`...) — sẽ vỡ layout trong RTL

Constraint quan trọng: `dir="rtl"` **phải được set trước** khi bất kỳ block nào được decorated, vì CSS `[dir="rtl"]` selectors cần biết context ngay lúc render. Nếu set sau, sẽ có layout flash.

## Goals / Non-Goals

**Goals:**
- Set `lang` đúng từ URL path thay vì hardcode
- Set `dir="rtl"` trên `<html>` trước `decorateTemplateAndTheme()` và `decorateMain()`
- Tất cả CSS blocks dùng logical properties — tự mirror mà không cần JS thêm
- `[dir="rtl"]` overrides cho các trường hợp logical properties không đủ (absolute positioning phức tạp)
- RTL typography adjustments qua CSS variables (line-height, letter-spacing)

**Non-Goals:**
- Không thêm Arabic font mới — dùng font stack hiện có (`Calibre`, `Goudy`)
- Không xử lý bidi text mixing (`<bdi>` tag) trong scope này — đó là responsibility của content authors
- Không implement language switching UI — header hiện có đã có lang selector
- Không xử lý số, ngày tháng format — nằm ngoài scope CSS/JS

## Decisions

### 1. Lang detection từ URL path

**Quyết định**: Parse lang từ URL path segment, fallback về `'en'`.

```js
const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

function getPageLang() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  // Convention: /global/<lang>/... hoặc /<lang>/...
  // Tìm segment đầu tiên khớp BCP 47 pattern (2-5 ký tự, không phải 'global')
  const lang = segments.find((s) => s !== 'global' && /^[a-z]{2,5}(-[a-z]{2,4})?$/i.test(s));
  return lang || 'en';
}
```

**Tại sao không dùng `<meta name="lang">`**: AEM EDS không guarantee meta tag này có mặt trên mọi trang. URL là source of truth đáng tin cậy hơn.

**Tại sao không dùng `document.documentElement.lang` từ HTML**: AEM EDS render HTML shell trước khi content load — giá trị này có thể chưa đúng lúc `loadEager()` chạy.

---

### 2. `applyDirection()` chạy trong `loadEager()` trước decoration

**Quyết định**: Gọi `applyDirection()` ngay đầu `loadEager()`, trước `decorateTemplateAndTheme()`.

```js
async function loadEager(doc) {
  const lang = getPageLang();
  document.documentElement.lang = lang;
  applyDirection(lang);           // ← trước mọi decoration
  decorateTemplateAndTheme();
  ...
}

function applyDirection(lang) {
  const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
  if (RTL_LANGS.includes(lang)) {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.classList.add('is-rtl');
  }
}
```

**Tại sao không dùng CSS `:lang(ar)` selector thay vì JS**: CSS `:lang()` chỉ hoạt động sau khi `lang` attribute được set — vẫn cần JS set `dir`. Ngoài ra `[dir="rtl"]` selector rõ ràng hơn về intent.

---

### 3. Logical properties cho CSS — không dùng JS để flip layout

**Quyết định**: Thay physical properties (`left`, `right`, `padding-left`...) bằng CSS logical properties (`inset-inline-start`, `padding-inline-start`...). Chỉ dùng `[dir="rtl"]` selector cho cases phức tạp (absolute positioning với calc, flex-direction reversal).

**Tại sao không dùng JS để swap class/style**: CSS logical properties là standard, zero-JS, không có reflow sau khi `dir` được set. Performant hơn và dễ maintain hơn.

**Tại sao không dùng CSS `transform: scaleX(-1)` trên toàn block**: Sẽ flip cả text và images — không acceptable.

---

### 4. RTL typography qua CSS variables, không thêm font mới

**Quyết định**: Override `[dir="rtl"]` block trong `styles.css` để điều chỉnh `line-height` (tăng lên ~1.8) và `letter-spacing: 0` (Arabic không dùng letter-spacing). Dùng lại font stack hiện có.

**Tại sao**: Arabic text cần line-height cao hơn Latin để diacritics không bị cắt. `letter-spacing` với Arabic phá vỡ character connections (kashida). Font `Calibre` và `Goudy` có Unicode coverage đủ cho Arabic display cơ bản.

---

### 5. Icon flip — chỉ directional icons

**Quyết định**: Dùng `[dir="rtl"] [class*="icon-arrow"]`, `[class*="icon-chevron"]`... với `transform: scaleX(-1)`. Icons neutral (close, logo) không flip.

## Risks / Trade-offs

- **[Risk] URL convention chưa thống nhất** → Lang detection có thể parse sai nếu URL pattern của Arabic pages khác `/global/ar/`. Mitigation: Cần confirm URL pattern trước khi ship, regex trong `getPageLang()` dễ adjust.

- **[Risk] Font `Calibre` không có Arabic glyphs** → Browser sẽ fallback về system Arabic font (thường là Arial hoặc system default) — layout có thể khác kỳ vọng. Mitigation: Test trực tiếp trên Arabic content, nếu cần thiết mới add Arabic font riêng trong phase sau.

- **[Risk] `body.classList.add('is-rtl')` chạy sau khi `body` render** → Có thể gây flash nếu có JS khác đọc class này. Mitigation: `is-rtl` chỉ dùng cho CSS `body.is-rtl` selectors nếu cần, không dùng cho JS logic.

- **[Trade-off] Logical properties không support IE11** → Không phải concern với AEM EDS — target là modern browsers.

## Migration Plan

1. Ship `scripts.js` changes trước — đây là foundation, không break LTR pages (nếu URL không chứa lang segment, fallback về `'en'`).
2. Ship `styles.css` changes — purely additive (`[dir="rtl"]` chỉ activate khi có attribute).
3. Ship từng block CSS — có thể merge riêng, không phụ thuộc nhau.
4. Rollback: Revert `scripts.js` về hardcode `lang='en'` — `dir` attribute sẽ không được set, RTL CSS không activate.

## Open Questions

- URL pattern cho Arabic pages là gì? `/ar/...` hay `/global/ar/...`? → Ảnh hưởng đến regex trong `getPageLang()`.
- `Calibre` font có Arabic glyph coverage không? → Cần test với Arabic content thật.
