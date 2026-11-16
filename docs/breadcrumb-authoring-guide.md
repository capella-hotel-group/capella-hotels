# Breadcrumb Authoring

The Breadcrumb shows where the current page sits in the site, for example
`Capella Singapore › Accommodation › Colonial Manor`. The trail is built
automatically from the page path, so authors never type the items.

## Adding the block

Add a **Breadcrumb** component to the section directly below the hero banner.

## Block fields

- **Style**: `Default` (dark text for light backgrounds) or `Inverse` (white
  text for dark backgrounds). Inverse has no background of its own, so only
  use it on a dark section.

## Where the labels come from

Each item uses the first value that is set on that page's properties:

1. **Breadcrumb Title**: a short label for breadcrumbs only. It does not
   change the page heading.
2. **Page Title**
3. **Title**

If the current page has none of these, its URL name is used (`colonial-manor`
becomes `Colonial Manor`).

## What visitors see

- The first item is the top-level page of the site and language, for example
  `/singapore/en`. On that top-level page itself, no breadcrumb is shown.
- Parent pages are links; the current page is plain text.
- A parent page that is unpublished, deleted or is only a folder is left out,
  so the breadcrumb never links to a missing page.
- A label change on a parent page appears in the breadcrumb once that parent
  page is published.
- On mobile, a trail with more than three items shows
  `Top-level page › … › Current page`. Tapping `…` reveals the full trail.

## In the Universal Editor

The breadcrumb shows the same trail as the live site. On a top-level page,
where the live site shows nothing, the editor shows
"Breadcrumb — hidden on top-level pages" so the block can still be selected.
