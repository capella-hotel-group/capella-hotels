## Context

`header.js` currently parses the `/nav` document with two hard-coded assumptions:

1. `buildDropdown()`: `srcItem.querySelector(':scope > ul')` — only takes the **first** `<ul>` inside the Destinations `<li>`. If the author creates multiple separate `<ul>` elements for each sub-category group, only the first group is rendered.

2. `decorate()`: `sections[0].querySelector('ul')` — only takes the **first** `<ul>` in section 0. If Experiences is authored in a separate second `<ul>`, that item is completely ignored.

Both cases fail silently — the header renders with missing items, no error, no warning. The author does not know they entered the wrong structure.

Constraint: Nested list structure cannot be enforced at the UE level — the component model only validates block-level fields, not HTML tree depth.

## Goals / Non-Goals

**Goals:**
- `buildDropdown()` merges all `<ul>` siblings in a `<li>` into a single flat list of sub-categories
- `decorate()` collects `<li>` from all `<ul>` elements in `sections[0]`, not just the first `<ul>`
- Clear `console.warn` with `[header]` prefix and a suggested fix path when an invalid structure is detected (missing lang list, missing nav items) so dev/QA knows immediately during testing
- `docs/header-nav-authoring-guide.md` describes correct/incorrect authoring with HTML examples for the dev team's reference

**Non-Goals:**
- No fix for extra text in link labels (e.g. `الخبرات(Experience)`) — that is a content issue
- No deeper validation (depth, ordering) — boundary: "reasonable authoring variations", not "arbitrary broken structure"
- No UE-level validation — out of scope for block JS

## Decisions

### 1. Merge multiple `<ul>` in `buildDropdown()` using `querySelectorAll` + `flatMap`

**Decision**:
```js
// Replaces querySelector(':scope > ul')?.querySelectorAll(':scope > li')
const subItems = [...srcItem.querySelectorAll(':scope > ul')]
  .flatMap((ul) => [...ul.querySelectorAll(':scope > li')]);
```

**Why `querySelectorAll` + `flatMap` instead of just `querySelector`**: Covers both the correct structure (1 `<ul>`) and the incorrect one (multiple `<ul>`). The result is identical — a flat array of `<li>` elements. Zero overhead.

---

### 2. Collect from multiple root `<ul>` in `decorate()` using `querySelectorAll` + `flatMap`

**Decision**:
```js
// Replaces sections[0]?.querySelector('ul')
const topLevelItems = sections[0]
  ? [...sections[0].querySelectorAll(':scope > ul')]
      .flatMap((ul) => [...ul.querySelectorAll(':scope > li')])
  : [];
```

**Why not keep `querySelector` and add a fallback**: More complex fallback logic, more error-prone. `querySelectorAll` + `flatMap` is simple and idempotent — if the author inputs correctly (1 `<ul>`), behavior is identical to before.

---

### 3. `console.warn` instead of `console.error` or throw

**Decision**: Use `console.warn` with a clear `[header]` prefix and a message suggesting the fix.

**Why not throw**: AEM EDS has no global error boundary — throwing would crash the entire `loadEager()`. `console.warn` is sufficient for dev/QA to see in DevTools without affecting other blocks.

**Why not `console.error`**: This is not a runtime error — it is an authoring mistake. `warn` level is more appropriate.

---

### 4. Authoring guide is Markdown in `docs/`, not an inline comment in `/nav`

**Decision**: Create `docs/header-nav-authoring-guide.md` in the repo.

**Why not a comment in the `/nav` document**: `/nav` lives in SharePoint/GDocs — comments may be deleted by authors and are not version-controlled. Markdown in the repo is reviewed and tracked alongside code.

## Risks / Trade-offs

- **[Risk] Author creates an invalid structure in a different way** → Mitigation: `console.warn` helps detect it quickly during QA testing. Cannot cover every case — boundary has been clearly defined.
- **[Trade-off] `flatMap` merge order depends on DOM order** → Acceptable: DOM order = authoring order, which is the desired behavior.
