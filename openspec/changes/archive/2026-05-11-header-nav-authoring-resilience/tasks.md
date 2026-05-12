## 1. Fix header.js — Defensive parse

- [x] 1.1 Fix `buildDropdown()`: replace `srcItem.querySelector(':scope > ul')?.querySelectorAll(':scope > li')` with `querySelectorAll(':scope > ul')` + `flatMap` to merge all `<ul>` siblings into a single flat list of sub-categories
- [x] 1.2 Add `console.warn(...)` with a dynamic label when multiple `<ul>` siblings are detected in a nav item with sub-categories
- [x] 1.3 Fix `decorate()`: replace `sections[0]?.querySelector('ul')` with `navContent.querySelectorAll(':scope > ul')` + `flatMap` to collect `<li>` from all `<ul>` in section 0 (via `default-content-wrapper`)
- [x] 1.4 Add `console.warn('[header] Nav structure invalid: missing language list. Check /nav document.')` before `hide()` when `!langList`
- [x] 1.5 Add `console.warn('[header] Nav structure invalid: no nav items found. Check /nav document.')` before `hide()` when `!navItems.length`

## 2. Create authoring guide

- [x] 2.1 Create `docs/header-nav-authoring-guide.md` with structure: Overview, Section rules (Languages / Destinations / Plain nav items / CTA / Logo), ✅ correct and ❌ incorrect examples for each rule

## 3. Verification

- [x] 3.1 Verify correct structure (1 `<ul>`) still renders correctly — no regression
- [x] 3.2 Verify Destinations with 3 separate `<ul>` → merged into a single dropdown with all 3 tabs + warn logged
- [x] 3.3 Verify Experiences in a second `<ul>` → collected and rendered correctly
- [x] 3.4 Verify `/nav` missing lang list → warn logged + header hidden

## 4. Spec sync

- [x] 4.1 Sync delta spec `header-desktop-layout` into `openspec/specs/header-desktop-layout/spec.md`
- [x] 4.2 Create `openspec/specs/header-nav-authoring-guide/spec.md` from delta spec

## 5. Additional fixes discovered during implementation

- [x] 5.1 Fix `decorate()`: use `sections[0].querySelector('.default-content-wrapper') ?? sections[0]` as root before querying `':scope > ul'` — required because AEM EDS wraps content in `default-content-wrapper` after decoration
- [x] 5.2 Fix `buildLangZone()`: trigger shows the current page language correctly by matching `window.location.pathname.startsWith(href)` instead of always taking `sourceItems[0]`
- [x] 5.3 Fix `buildNavZone()` + `buildMobilePanel()`: plain nav item without a `<p>` wrapper (e.g. `<li><a href>الخبرات</a></li>`) → fallback to `srcItem.querySelector(':scope > a')`
- [x] 5.4 Fix `buildMobilePanel()`: apply `querySelectorAll(':scope > ul')` + `flatMap` to the mobile accordion the same as the desktop dropdown fix
- [x] 5.5 Fix `buildLangZone()`: lang item without an `<a>` tag → wrap in `<a href="#">` instead of rendering plain text
