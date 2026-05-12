## 1. CSS — Replace absolute positioning with flex sub-groups

- [x] 1.1 In `header.css`: change `.header-nav` from `display: contents` to `position: absolute; inset: 0; display: grid; grid-template-columns: 1fr 30px 1fr; align-items: center; pointer-events: none`
- [x] 1.2 In `header.css`: add `.header-nav-left { display: flex; align-items: center; justify-content: flex-end; gap: 20px; padding-inline-end: 20px; pointer-events: auto; }`
- [x] 1.3 In `header.css`: add `.header-nav-right { display: flex; align-items: center; justify-content: flex-start; gap: 20px; padding-inline-start: 20px; pointer-events: auto; }`
- [x] 1.4 In `header.css`: remove rules `[data-nav-side="left"] { left: calc(50% - 250px); }` and `[data-nav-side="right"] { right: calc(50% - 250px); }`
- [x] 1.5 In `header.css`: remove `position: absolute` from `.header-nav-link, .header-nav-drop-trigger` (they are now flex items inside the sub-group)

## 2. JS — buildNavZone() creates sub-groups

- [x] 2.1 In `header.js`, `buildNavZone()`: create two sub-groups `const navLeft = document.createElement('div'); navLeft.className = 'header-nav-left'` and similarly `header-nav-right`
- [x] 2.2 In `header.js`, `buildNavZone()`: in forEach, instead of `nav.append(...)`, route the item to the correct group: `side === 'left' ? navLeft.append(el) : navRight.append(el)`
- [x] 2.3 In `header.js`, `buildNavZone()`: append both sub-groups to nav: `nav.append(navLeft, navRight)`

## 3. Verify

- [x] 3.1 Desktop 2 items (1+1): Destinations on the left, Experiences on the right — no overlap with emblem
- [x] 3.2 Desktop 3 items (2+1): Destinations + Experiences on the left with 20px gap, NewItem on the right — no overlap
- [x] 3.3 Desktop 3 items (1+2): 1 item on the left, 2 items on the right with 20px gap
- [x] 3.4 Dropdown still opens after item no longer has `position: absolute`
- [x] 3.5 Remove lang or CTA — nav group remains centered in header
