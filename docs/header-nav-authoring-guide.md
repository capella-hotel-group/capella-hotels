# Header Nav — Authoring Guide

> **Audience:** Content authors
> **Source document:** `/nav` (per site/language, e.g. `/global/en/nav`)

## 1. Overview

Site header content (logo, language switcher, Book CTA, and the mega-menu) is authored
on the shared `/nav` page for each site/language, using standard page components —
there is no dedicated "Nav" component. The page must have exactly two sections, in order:
the header bar first, followed by the destination menu.

## 2. Section 1 — Header bar

Add these components in order:

- **Image** — the white/default logo. Set its alt text.
- **Image** — the black/active logo shown while the menu is open. Set its alt text.
- **Button** — the logo link destination and accessible label. Append a target marker if needed.
- **Text** — the language dropdown. Use an RTE bullet list with one top-level item and a
  nested list of linked languages. The top-level label is not displayed. For example:

- Languages
  - [English](/global/en) | open-in-new-tab
  - [简体中文](/global/zh-cn) | open-in-same-tab
  - [日本語](/global/jp) | open-in-new-tab
  - [عربي](/global/ar) | open-in-same-tab
- **Button** — the Book CTA label and destination. This must be the last button link in
  the section; append a target marker if needed.

The first button link supplies the logo's accessible label, destination, and target. The
last non-Close button link supplies the Book CTA's label, destination, and target; links
labeled **Close** are ignored. The menu uses its built-in **CLOSE** control. If no
logo-link Button is authored, the logo falls back to the active language URL and default
accessible label.

## 3. Section 2 — Menu

For each destination/category, add a **Text** component followed immediately by a **Hero**
block. The Hero supplies that category's promo image and CTA label/link.

Author the Text component as a bullet-list RTE. Use either supported structure:

- **Three levels** — category, labeled group, then destination links. For example:
  - Experiences
    - Asia Pacific
      - [Singapore](/global/en/singapore)
- **Two levels** — category, then destination links directly underneath:
  - Offers
    - [Overview](/global/en/overview)

Link destinations that should navigate. Plain-text entries render as non-clickable items.

## 4. RTE markers

Append one marker to the end of the logo-link Button, Book CTA, a language link, a category
link, a menu link, or a labeled region heading using ` | marker`:

- `open-in-new-tab` opens a logo or navigation link in a new tab.
- `open-in-same-tab` keeps the link in the current tab; this is also the default when no
  marker is present.
- `merge-columns` is for a labeled region in a three-level list. It merges that region
  with the immediately following region in the same category when their combined output
  has four or fewer columns. If it would exceed four, the marker is ignored and both
  regions render separately; no links are dropped. Merging is pairwise and does not
  chain across additional regions. A marker on the last region has no effect.

A merged pair is laid out in a single row of up to four columns. For example, author two
neighboring labeled regions with two links each:

- Destinations
  - Middle East | merge-columns
    - Saudi Arabia
    - Qatar
  - Europe
    - London
    - Paris

The rendered row has four columns; the marker is stripped and both region labels remain.
Extra link columns have visually blank, screen-reader-hidden label placeholders to keep
the links aligned:

| Middle East  |       | Europe |       |
| ------------ | ----- | ------ | ----- |
| Saudi Arabia | Qatar | London | Paris |

The marker is text appended to the RTE item, not a CSS class. It is removed from the
rendered label.

## 5. Rules

- **Order matters.** Each Hero block belongs to the immediately preceding category Text
  component; do not put another component between them.
- **Exactly two sections, in that order.** The first section is always the header bar,
  the second is always the menu.
- **Every category needs at least one link** (either the category itself linked, or at
  least one linked item underneath it) or it won't render.

## 6. Pre-publish Checklist

- [ ] Section 1 has a white logo Image, black logo Image, logo-link Button, linked
      language RTE list, and Book Button in that order
- [ ] Section 2 has one Text RTE and one following Hero block per destination/category
- [ ] Each Hero has its promo image and CTA label/link
- [ ] Every category has at least one working destination link
