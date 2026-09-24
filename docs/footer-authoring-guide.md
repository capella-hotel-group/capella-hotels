# Footer — Authoring Guide

> **Audience:** Content authors
> **Source document:** `/footer` (per site/language, e.g. `/global/en/footer`)

## 1. Overview

Site footer content (nav link columns, newsletter signup, contact details, social
links, legal links, and the copyright line) is authored on the shared `/footer` page
for each site/language, using standard page components — there is no dedicated
"Footer" component. The page must have exactly **four sections, in order**.

## 2. Section 1 — Nav link columns

Add exactly **two Text components**, each a single flat bullet list (no nesting, no
labeled groups):

- List 1, e.g.:
  - [Capella Hotels Group](/capella-hotels-group)
  - [Capella Hotels and Resorts](/capella-hotels-and-resorts)
  - [Patina Hotels & Resorts](/patina-hotels-and-resorts)
- List 2, e.g.:
  - [About Us](/about-us)
  - [Media Centre](/media-centre)
  - [Capella Discovery](/capella-discovery)
  - [F.A.Q](/faq)
  - [Global Contacts](/global-contacts)

These render as two side-by-side columns at tablet/desktop and one continuous stacked
list at mobile. The column count is fixed at two — do not add a third list.

## 3. Section 2 — Newsletter

Place a **`newsletter-form` block** directly in this section. Set its **Layout**
field to **Inline** so it renders in place (no "Subscribe" button/modal). Fill in
the block's other fields as usual (Form Title, field labels, dropdown Content
Fragment paths, consent message, submit label). In `Inline` layout the consent
message is shown next to a checkbox that visitors must tick before the form can be
submitted.

## 4. Section 3 — Contact + social

Add exactly **two Text components**:

- **Contact info** — one paragraph per group (property name, email, address, phone
  numbers). Write each group as its own line/paragraph; a heading ("Contact Us") is
  added automatically and should not be authored.
- **Social links** — one bullet list, one item per platform. Each item's link text
  must be an **icon shortcode** so the existing EDS icon convention renders the
  platform's icon instead of plain text, e.g.:
  - [:facebook:](https://facebook.com/capellahotels)
  - [:instagram:](https://instagram.com/capellahotels)
  - [:line:](https://line.me/capellahotels)

  Any supported icon shortcode may be used. Add, remove, or reorder items freely —
  no code change is needed. A heading ("Follow Us On") is added automatically.

## 5. Section 4 — Legal + copyright

Add:

- One **bullet list** of legal links, e.g.:
  - [Careers](/careers)
  - [Digital Payment Tokens](/digital-payment-tokens)
  - [Privacy Policy](/privacy-policy)
  - [UGC Terms and Conditions](/ugc-terms)
  - [Booking Terms and Conditions](/booking-terms)
- One **plain paragraph** for the copyright line, e.g. "© 2026 Capella Hotel Group.
  All Rights Reserved."

Legal links wrap horizontally at tablet/desktop and stack vertically at mobile; the
copyright line always sits below them, left-aligned.

## 6. Rules

- **Exactly four sections, in that order.** Section 1 is always the nav link
  columns, section 2 the newsletter, section 3 contact + social, section 4 legal +
  copyright.
- A missing or malformed section is simply skipped when the page renders — it will
  not break the rest of the footer, but the page should still be fixed before
  publishing.
- Section 1 must contain **exactly two** lists; a third list is not displayed as a
  new column.
- Section 3's social list must use icon shortcodes for its link text; plain text
  labels are preserved as-is (unlike section 1's links) but will not render an icon.

## 7. Pre-publish Checklist

- [ ] The page has exactly 4 sections in the documented order
- [ ] Section 1 has exactly 2 flat bullet lists
- [ ] Section 2 contains one `newsletter-form` block with Layout set to Inline
- [ ] Section 3 has one contact-info Text component and one social links bullet
      list using icon shortcodes
- [ ] Section 4 has one legal links bullet list and one copyright paragraph
