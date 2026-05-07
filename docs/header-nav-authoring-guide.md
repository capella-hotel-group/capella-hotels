# Header Nav — Authoring Guide

> **Audience:** Content authors using Universal Editor / SharePoint  
> **Block:** `header`  
> **Source document:** `/nav`

The header block reads its content from a `/nav` document. This guide defines the correct structure for each section.

---

## Document Structure — 3 Sections

The `/nav` document must have **exactly 3 sections** in this order:

| Section | Content |
|---|---|
| Section 1 | Nav list (Languages + nav items) |
| Section 2 | CTA link (Book Your Stay) |
| Section 3 | Logo image |

---

## Section 1 — Nav List

One flat list. First item is always Languages. Remaining items are nav entries.

```
Main list
  ├── Languages        ← always first
  ├── Destinations     ← nav item with sub-categories
  ├── Experiences      ← plain nav item
  └── ...
```

---

### Rule 1 — Languages item

First item in the list. Contains a **nested list** of language options. Each language is an `<a>` link.

✅ **Correct**
```html
<li>
  <p>Languages</p>
  <ul>
    <li><a href="/global/en">English</a></li>
    <li><a href="/global/zh-cn">简体中文</a></li>
    <li><a href="/global/jp">日本語</a></li>
  </ul>
</li>
```

❌ **Wrong — missing nested list**
```html
<li>
  <p>Languages</p>
  <!-- no nested list → header will be hidden with a warning -->
</li>
```

---

### Rule 2 — Destinations (nav item with sub-categories)

One `<li>` with **one nested list**. Sub-category groups are `<li>` items inside that single list.

✅ **Correct — one nested list, sub-categories as list items**
```html
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
```

❌ **Wrong — three separate nested lists**
```html
<li>
  <p>Destinations</p>
  <ul>
    <li><p>Capella Hotels and Resorts</p>...</li>
  </ul>
  <ul>                                          <!-- ← separate list -->
    <li><p>Capella Residencies</p>...</li>
  </ul>
  <ul>                                          <!-- ← separate list -->
    <li><p>Patina Hotels and Resorts</p>...</li>
  </ul>
</li>
```

> **Note:** The block will attempt to merge multiple nested lists and log a warning in the browser console. Fix the authoring to avoid this.

---

### Rule 3 — Plain nav item (e.g. Experiences)

A plain nav link — **no sub-categories**. Must be a `<li>` **inside the main list**, containing a `<p>`.

✅ **Correct — item in main list with `<p>` wrapper**
```html
<!-- Plain text label -->
<li>
  <p>Experiences</p>
</li>

<!-- Or linked label -->
<li>
  <p><a href="/global/en/experiences">Experiences</a></p>
</li>
```

❌ **Wrong — item in a separate list outside the main list**
```html
</ul>               <!-- ← main list closed -->
<ul>                <!-- ← NEW list — items here will be partially recovered but not guaranteed -->
  <li>Experiences</li>
</ul>
```

❌ **Wrong — no `<p>` wrapper**
```html
<li>
  <a href="/experiences">Experiences</a>  <!-- ← missing <p> wrapper → link lost -->
</li>
```

❌ **Wrong — extra text outside the link**
```html
<li>
  <p><a href="/experiences">Experiences</a>(extra text)</p>  <!-- ← label will include the extra text -->
</li>
```

---

## Section 2 — CTA Link

A single paragraph containing an anchor.

✅ **Correct**
```html
<p><a href="/book">Book Your Stay</a></p>
```

> The `<strong>` wrapper around `<a>` is accepted but not required.

---

## Section 3 — Logo Image

A single paragraph containing a `<picture>` element.

✅ **Correct**
```html
<p>
  <picture>
    <img src="./logo.svg" alt="" width="48" height="79">
  </picture>
</p>
```

---

## Common Mistakes Summary

| Mistake | Effect | Fix |
|---|---|---|
| Languages list missing | Header hidden, `[header] Nav structure invalid` warning in console | Add nested `<ul>` under Languages item |
| Destinations has multiple `<ul>` siblings | Partial merge applied, warning logged | Move all sub-categories into one `<ul>` |
| Experiences in a separate `<ul>` outside main list | Partial recovery applied | Move Experiences `<li>` into the main `<ul>` |
| Plain nav item missing `<p>` wrapper | Link is lost | Wrap content in `<p>` |
| Extra text next to link | Extra text appears in nav label | Keep link text clean |
| No nav items at all | Header hidden, `[header] Nav structure invalid` warning in console | Ensure main list has items after Languages |
