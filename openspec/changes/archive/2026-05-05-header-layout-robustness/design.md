## Context

The header block (`blocks/header/`) renders a three-zone sticky bar (lang | nav+emblem | CTA) on desktop and a MENU/BOOK bar with a slide-down panel on mobile. Both layouts currently use positional patterns that are coupled to content type or label text, causing silent breakage when nav content changes.

Three bugs identified through exploration:

1. `flex + space-between` on `.header-inner` — only works with exactly 2 in-flow items
2. `.header-nav-drop-trigger { left: ... }` / `.header-nav-link { right: ... }` — position determined by CSS class, which is determined by content type (has `<ul>` or not), not by index
3. `.header-mobile-panel.is-destinations-expanded` — CSS rule hardcoded to the string "destinations", breaks for any other nav label

## Goals / Non-Goals

**Goals:**
- Fix desktop zone layout so removing lang or CTA leaves the other correctly positioned
- Fix desktop nav item positioning so type changes (link↔dropdown) don't cause items to overlap or move
- Fix mobile accordion so any nav item with a sub-list can open, regardless of its label

**Non-Goals:**
- Changing visual appearance, spacing, or animation
- Refactoring the fragment structure or nav data model
- Supporting more than 2 nav items on desktop (out of scope for this change)

## Decisions

**Decision 1: CSS Grid 3-column for `.header-inner`**

Replace `display: flex; justify-content: space-between` with:
```css
.header-inner {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}
```
Lang sits in col 1 (natural start), nav in col 2 (auto-width, centered), CTA in col 3 (`justify-self: end`). Each column is independent — removing an element collapses that column without affecting others.

Alternatives considered:
- `margin-left: auto` on CTA: simpler but only fixes the missing-lang case; missing CTA still pulls lang to center
- Keeping flex + adding a spacer: more DOM nodes, still fragile

**Decision 2: `data-nav-side` attribute set by index**

In `buildNavZone()`, assign `data-nav-side="left"` or `"right"` based on position index (`i < Math.ceil(navItems.length / 2)`), not on content type. CSS targets the attribute:

```css
.header-inner [data-nav-side="left"]  { position: absolute; left:  calc(50% - 250px); }
.header-inner [data-nav-side="right"] { position: absolute; right: calc(50% - 250px); }
```

Remove the type-coupled rules (`.header-nav-link { right }` / `.header-nav-drop-trigger { left }`).

Alternatives considered:
- Flex nav with spacer (Approach B): more robust for N items, but higher risk and out of scope
- Keeping class-based + adding explicit class per side: still couples class assignment to type in JS

**Decision 3: `data-open` attribute on list element**

In `buildMobilePanel()`, replace `panel.classList.add/remove(expandedClass)` with `list.dataset.open = 'true'/'false'`. Mutual exclusion: close all by setting `dataset.open = 'false'` on every list before opening the target.

CSS:
```css
.header-mobile-nav-list[data-open="true"] { max-height: ...; opacity: 1; ... }
.header-mobile-lang-list[data-open="true"] { max-height: ...; opacity: 1; ... }
```

Remove `.header-mobile-panel.is-destinations-expanded` and `.header-mobile-panel.is-lang-expanded` rules.

The lang list item click handler also updates `dataset.open = 'false'` directly on `langUl` for consistency.

## Risks / Trade-offs

- [Risk] Grid col 2 (`auto`) width is determined by nav content width — if nav text is very long, it may overflow into lang/CTA cols → Mitigation: existing nav text is short, and `position: absolute` nav items don't contribute to flow width anyway; risk is minimal
- [Risk] `data-open` removes the panel-level class, so any external CSS or JS targeting `is-destinations-expanded` would break → Mitigation: no other files reference these classes; confirmed by search
- [Risk] `data-nav-side` hardcodes the split at `Math.ceil(n/2)` — assumes symmetric distribution → Mitigation: currently 2 items (1+1), which is exactly symmetric; acceptable for scope

## Migration Plan

CSS and JS changes are in the same block (`blocks/header/`). No server-side or build changes needed. Rollback by reverting the two files.
