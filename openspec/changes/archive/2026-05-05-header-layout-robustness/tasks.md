## 1. Desktop — Grid layout for header-inner

- [x] 1.1 In `header.css`: replace `display: flex; justify-content: space-between` on `.header-inner` with `display: grid; grid-template-columns: 1fr auto 1fr`
- [x] 1.2 In `header.css`: add `justify-self: end` on `.header-cta` to keep the CTA in the right column
- [x] 1.3 In `header.css`: remove `flex: 0 0 auto` from `.header-lang` and `.header-cta` (no longer needed in grid)

## 2. Desktop — data-nav-side replacing class-based positioning

- [x] 2.1 In `header.js`, `buildNavZone()`: after creating the element for each nav item, assign `el.dataset.navSide = i < Math.ceil(navItems.length / 2) ? 'left' : 'right'` (where `el` is the element appended to nav — `wrapper` if it has a dropdown, `a` if it's a plain link)
- [x] 2.2 In `header.css`: add two new rules `[data-nav-side="left"] { position: absolute; left: calc(50% - 250px); }` and `[data-nav-side="right"] { position: absolute; right: calc(50% - 250px); }`
- [x] 2.3 In `header.css`: remove individual rules `.header-nav-link { right: calc(50% - 250px); }` and `.header-nav-drop-trigger { left: calc(50% - 250px); }` (replaced by data attribute rules)

## 3. Mobile — data-open replacing label-based class on panel

- [x] 3.1 In `header.js`, `buildMobilePanel()`: replace accordion logic from `panel.classList.add/remove(expandedClass)` to `list.dataset.open = 'true'/'false'` — close all by setting `dataset.open = 'false'` on all lists in the accordions array, then set `dataset.open = 'true'` on the list of the clicked item
- [x] 3.2 In `header.js`: update lang list click handler from `panel.classList.remove('is-lang-expanded')` to `langUl.dataset.open = 'false'`
- [x] 3.3 In `header.css`: add rule `.header-mobile-nav-list[data-open="true"]` with values from `.header-mobile-panel.is-destinations-expanded .header-mobile-nav-list`
- [x] 3.4 In `header.css`: add rule `.header-mobile-lang-list[data-open="true"]` with values from `.header-mobile-panel.is-lang-expanded .header-mobile-lang-list`
- [x] 3.5 In `header.css`: remove rules `.header-mobile-panel.is-destinations-expanded .header-mobile-nav-list` and `.header-mobile-panel.is-lang-expanded .header-mobile-lang-list`

## 4. Verify

- [x] 4.1 Desktop: hide `.header-lang` via CSS → CTA stays on right, nav stays centered
- [x] 4.2 Desktop: hide `.header-cta` via CSS → lang stays on left, nav stays centered
- [x] 4.3 Desktop: change Experiences to an item with `<ul>` in `index.html` → both items remain correctly positioned (no overlap)
- [x] 4.4 Mobile: add a new nav item with any dropdown label → accordion opens correctly
- [x] 4.5 Mobile: LANGUAGES accordion still opens/closes correctly
