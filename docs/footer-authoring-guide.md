# Footer — Authoring Guide

> **Audience:** Content authors
> **Source document:** `/footer` (per site/language, e.g. `/global/en/footer`)

## 1. Overview

Site footer content (background theme, contact details, social links, nav link
columns, newsletter signup, legal links, and the copyright line) is authored on the
shared `/footer` page for each site/language, using a set of dedicated Footer
blocks. Each piece of content is its own block, added as a normal section
component — **there is no fixed section count or order**; add only the blocks you
need, in any order, and the page renders correctly either way.

## 2. Available blocks

| Block                  | Purpose                                                                                                        | Repeatable child                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Footer**             | Background color theme for the footer area (Light Sand / Beige or Clean White)                                 | —                                                                                                      |
| **Footer Contact**     | Contact section title + contact info (property name, email, address, phone numbers)                            | —                                                                                                      |
| **Footer Social Link** | Social links group title                                                                                       | **Footer Social Item** — platform (Facebook/Instagram/Line), icon, icon alt text, URL, open-in-new-tab |
| **Footer Links**       | Nav link column group title + number of items before wrapping to a second column                               | **Footer Link** — label, URL, open-in-new-tab                                                          |
| **Footer Legal**       | Copyright text                                                                                                 | **Footer Legal Link** — label, URL, open-in-new-tab                                                    |
| **Newsletter Form**    | Embedded lead-capture form (existing block, set Layout to Inline to render in place without the modal trigger) | —                                                                                                      |

Add each block once per page, with as many repeatable items (social/nav/legal
links) inside its container as needed — use the **+** button on the container
block to add items.

## 3. Rules

- No fixed section/order requirement — the blocks are matched by name, not by
  position, so authors and future redesigns can reorder them freely.
- Each container block (Footer Social Link, Footer Links, Footer Legal) needs at
  least one child item to render anything.
- A missing block is simply not rendered — it will not break the rest of the
  footer, but the page should still be reviewed before publishing.

## 4. Pre-publish Checklist

- [ ] Footer block present with the intended background theme
- [ ] Footer Contact has a title and contact info filled in
- [ ] Footer Social Link has at least one Footer Social Item per platform used
- [ ] Footer Links has at least one Footer Link item per nav entry
- [ ] Footer Legal has at least one Footer Legal Link item and the copyright text
- [ ] Newsletter Form present with Layout set to Inline
