# Header Nav — Authoring Guide

> **Audience:** Content authors  
> **Block:** `header`  
> **Source document:** `/nav`

---

## 1. Document Structure

The `/nav` document must have exactly **3 sections** in order:

| Section | Content |
|---|---|
| 1 | Navigation list |
| 2 | CTA link |
| 3 | Logo image |

---

## 2. Correct Navigation Structure

```html
<div>
  <ul>

    <!-- SECTION 1: Languages — always first -->
    <li>
      <p>Languages</p>
      <ul>
        <li><a href="/global/en">English</a></li>
        <li><a href="/global/zh-cn">简体中文</a></li>
        <li><a href="/global/jp">日本語</a></li>
      </ul>
    </li>

    <!-- Nav item with sub-categories -->
    <li>
      <p>Destinations</p>
      <ul>
        <li>
          <p>Capella Hotels and Resorts</p>
          <ul>
            <li><a href="/global/en">Bangkok</a></li>
            <li>Kyoto</li>
          </ul>
        </li>
        <li>
          <p>Capella Residencies</p>
          <ul>
            <li>Singapore</li>
          </ul>
        </li>
        <li>
          <p>Patina Hotels and Resorts</p>
          <ul>
            <li>Maldives</li>
          </ul>
        </li>
      </ul>
    </li>

    <!-- Plain nav item (no sub-categories) -->
    <li>
      <p><a href="/global/en/experiences">Experiences</a></p>
    </li>

  </ul>
</div>
```

```html
<!-- SECTION 2: CTA -->
<div>
  <p><a href="/book">Book Your Stay</a></p>
</div>
```

```html
<!-- SECTION 3: Logo -->
<div>
  <p>
    <picture>
      <img src="./logo.svg" alt="" width="48" height="79">
    </picture>
  </p>
</div>
```

---

## 3. Rules

### Rule 1 — Languages is always first, must have a nested list

✅ Correct
```html
<li>
  <p>Languages</p>
  <ul>
    <li><a href="/global/en">English</a></li>
  </ul>
</li>
```

❌ Wrong — Languages missing or has no nested list → **header is hidden**
```html
<li>
  <p>Languages</p>
  <!-- no nested list -->
</li>
```

---

### Rule 2 — Destinations: one nested list, sub-categories as list items

✅ Correct — one `<ul>`, sub-categories inside as `<li>`
```html
<li>
  <p>Destinations</p>
  <ul>
    <li><p>Capella Hotels</p>...</li>
    <li><p>Capella Residencies</p>...</li>
    <li><p>Patina Hotels</p>...</li>
  </ul>
</li>
```

⚠️ Wrong — multiple separate `<ul>` siblings → parser merges them and logs a warning
```html
<li>
  <p>Destinations</p>
  <ul><li><p>Capella Hotels</p>...</li></ul>
  <ul><li><p>Capella Residencies</p>...</li></ul>
  <ul><li><p>Patina Hotels</p>...</li></ul>
</li>
```

---

### Rule 3 — Plain nav items stay inside the main list, use `<p>` wrapper

✅ Correct
```html
<ul>
  <li><p>Languages</p>...</li>
  <li><p><a href="/experiences">Experiences</a></p></li>
</ul>
```

⚠️ Wrong — item in a separate `<ul>` outside main list → parser recovers but fix authoring
```html
<ul><li>Languages...</li></ul>
<ul><li><a href="/experiences">Experiences</a></li></ul>
```

❌ Wrong — no `<p>` wrapper and no `<a>` → label is lost
```html
<li>Experiences</li>
```

---

### Rule 4 — Keep link text clean

✅ Correct
```html
<li><p><a href="/experiences">Experiences</a></p></li>
```

❌ Wrong — extra text becomes part of the nav label
```html
<li><p><a href="/experiences">Experiences</a>(Experience)</p></li>
```

---

## 4. Common Mistakes

| Mistake | Effect | Fix |
|---|---|---|
| Languages not first | Header hidden | Move Languages to top |
| Languages has no nested `<ul>` | Header hidden + console warning | Add nested `<ul>` with language links |
| Multiple `<ul>` under Destinations | Warning logged, merge applied | Merge into one `<ul>` |
| Plain nav item in separate `<ul>` | Warning logged, partial recovery | Move into main `<ul>` |
| Nav item has no `<p>` and no `<a>` | Label lost | Wrap with `<p>` |
| Extra text next to link | Extra text in nav label | Keep link text clean |
| No nav items after Languages | Header hidden + console warning | Add at least one nav item |

---

## 5. Pre-publish Checklist

- [ ] Only ONE root `<ul>` in Section 1
- [ ] Languages is first item with a nested `<ul>`
- [ ] Destinations has only ONE nested `<ul>` (sub-categories as `<li>` inside it)
- [ ] Every nav item label is wrapped in `<p>`
- [ ] No extra text outside `<a>` tags
- [ ] Section 2 has a single `<p><a>` CTA link
- [ ] Section 3 has a single `<picture>` logo
