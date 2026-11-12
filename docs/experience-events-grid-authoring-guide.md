# Experience Events Grid Authoring

## Content Fragments

Reuse the existing Filters Grid card and modal Content Fragments. Select the hotel experience folder under `/content/dam/capella-hotels/content-fragment/experiences/` in **Content Fragment Root Path**. Card content, schedules, pricing, Push to Top, and popup details are managed in those fragments.

The separate persisted `Experience-events-grid` query requires a `path` variable. The browser requests the configured publish origin, not the authenticated author endpoint. Publish the query, updated CF model, and referenced fragments before testing.

## Block Settings And Categories

Add **Experience Events Grid** to the page and configure Section Eyebrow, Section Title, Content Fragment Root Path, Date Range Filter Placeholder, All Experiences Tab Label, Initial Display Count, and Reveal More Button Label.

Categories are authored in the block's **Category Tabs** repeatable Category Settings field, not as child blocks or items. For each entry, select one Capella Hotels Category Tag matching the fragment's Associated Filter Tags and enter a visitor-facing Category Tab Label in the page language. Reorder the entries to reorder the tabs. Existing authored multifields remain valid; no migration is needed.

Category Tag and Category Tab Label are optional while drafting. Complete them before publishing. The tag picker is single-select and has no `rootPath` constraint; choose tags under Capella Hotels. Empty entries produce a disabled placeholder tab. **All Experiences** requires no category tag and respects the selected dates.

## Schedules

Use the exact GraphQL fields `schedulefrequencyLabel`, `durationType`, `pricingType`, `pushToTop`, `scheduleType`, `availabilityStartDate`, `availabilityEndDate`, `weekdays`, `weekOfMonth`, and `scheduleTimeZone`.

- Schedule Type: `fixed-date`, `daily`, `weekly`, `monthly-weekday`, or `by-arrangement`.
- Pricing Type: `complimentary` or `chargeable`.
- Weekdays: lowercase English day names.
- Week of Month: `first`, `second`, `third`, `fourth`, or `last`.
- Schedule Time Zone: the hotel's IANA zone, such as `Asia/Singapore`.

Availability dates must be ISO date-times with offsets. Their instants are converted to the authored time zone. For recurring schedules, the local start time repeats on each matching date, including across daylight-saving changes. The end is the final availability boundary, not the end of every session.

Nonexistent local start times during a daylight-saving jump are skipped; a repeated autumn hour runs once, at its earlier instant. A Fixed Date with an end is one continuous event interval; without an end it is a single occurrence. Weekly schedules require weekdays; Monthly Weekday requires exactly one weekday and a Week of Month. Other schedules ignore stale weekday/week selections. By Arrangement matches overlapping availability dates and ignores its authored time.

## Filtering And Reveal More

The date dropdown offers native From/To calendar inputs, Apply, and Clear. A range includes both dates in each experience's time zone. With no range, upcoming or ongoing experiences are ordered by their next occurrence. Missing schedules remain visible without a range, but are excluded when a range is selected; they are not assumed to be By Arrangement. Invalid schedules produce a console report and visible warning.

Category and date filtering happen before ordering. Matching Push to Top entries come first; within featured and normal groups, order by earliest matching date, start time, and title A-Z. Undated and By Arrangement entries follow dated entries within their priority group.

Eight cards show initially by default (configurable). Reveal More appends four, preserves existing card elements and result order, and hides at the end. Category/date changes reset the count and refresh the upcoming-event evaluation.

The listing uses four desktop columns, two tablet columns, and one mobile column with horizontal image/text cards.

## Popups And Links

Events Grid and Filters Grid use the same shared experience popup implementation and stylesheet, loaded the first time a popup opens. Their block-specific test IDs and category/eyebrow display settings remain independent.

The location eyebrow and category text beside the description both use the first `cardLocationTag`, regardless of the selected tab, including All Experiences. If no location tag is provided, both texts are omitted and no empty category column is rendered. Both Split Image and Landscape layouts support optional CTAs and independent image-overlay flags. A blank CTA label omits the CTA without resolving its URL or reserving extra CTA space. Carousel dots appear only for multiple slides; Split Image's feature image is separate from its carousel, while Landscape includes it as the first slide.

Location text uses the published tag title, not a title inferred from its ID. For example, `capella-hotels:destination/bangkok` can display Bangkok new without changing matching. The existing derived label remains a fallback if the title lookup fails. Category tabs retain their author-entered labels; filtering always uses tag IDs.

Use square (1:1) images for Split Image and landscape (16:9) images for Landscape. Apply the same ratio to feature and carousel images.

Internal card and CTA links use EDS page paths on preview/live and localhost. On AEM author pages, `/content/capella-hotels/...html` is retained. External links remain unchanged. Escape, the close button, or clicking the backdrop closes the popup; keyboard focus stays inside while open and returns to the originating card on close.
