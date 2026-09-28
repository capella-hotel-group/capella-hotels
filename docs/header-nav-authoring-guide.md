# Header Nav — Authoring Guide

> **Audience:** Content authors
> **Source document:** `/nav` (per site/language, e.g. `/global/en/nav`)

## 1. Overview

Site header content (logo, language switcher, Book CTA, and the mega-menu) is authored
on the shared `/nav` page for each site/language, using standard page components —
there is no dedicated "Nav" component. The page must have exactly two sections, in order.

## 2. Section 1 — Header bar

Add, in any order:

- **Image** — the logo. Set the alt text on the image itself. Optionally add a
  **second Image** immediately after it — the dark/active variant shown while the
  menu panel is open. If omitted, the default logo is reused in both states.
- **Text** — the language switcher. Add one bullet list with a single top-level item
  (its text is not shown), and a nested bullet list underneath it with one linked item
  per language, e.g.:
  - English
    - [English](/global/en)
    - [简体中文](/global/zh-cn)
    - [日本語](/global/jp)
- **Button** — the "Book Your Stay" CTA (label + link).

## 3. Section 2 — Menu

Add one **Text** component per top-level menu category, each followed immediately by one
**Hero** block for that category's promo image (skip the Hero if a category has no promo).

Each category's Text component is a single bullet list with one top-level item (the
category label) containing a nested list:

- Give a nested item its own nested sub-list to make it a **labeled group** (e.g. "Asia
  Pacific" with destinations underneath).
- Give a nested item **no** sub-list to make it a **plain link** directly under the
  category (no group heading) — link it or leave it as plain text.
- A category with **no nested list at all** — just a linked category label — becomes a
  plain top-level link with no expandable menu.
- An item can be plain text with no link — it renders as a non-clickable, dimmed entry
  (useful for "coming soon" destinations).

## 4. Rules

- **Order matters within each section.** A Hero block is matched to the Text component
  immediately before it — don't separate them with anything else.
- **Exactly two sections, in that order.** The first section is always the header bar,
  the second is always the menu.
- **Every category needs at least one link** (either the category itself linked, or at
  least one linked item underneath it) or it won't render.

## 5. Pre-publish Checklist

- [ ] Section 1 has one (or two, if using a dark/active logo variant) Image, one
      language Text list, and one Button
- [ ] Section 2 has at least one category Text component with at least one working link
- [ ] Each Hero block for a promo image comes directly after its category's Text component
