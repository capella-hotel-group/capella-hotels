# Filters Grid Authoring

## Filter Tabs And Labels

Add a **Filter Tab** child item to the Filters Grid for each tab (for example, Experience or Destination). Each item has:

- **Tab Label**: optional, but provide meaningful labels when multiple tabs are displayed. The editor item label uses this text; a blank label displays "Filter Tab 1", "Filter Tab 2", etc.
- **Category Settings**: one repeatable field containing Category Tag, Background Color, and Default Category.

The child item itself represents the mode, so there is no repeatable Filter Mode Labels container around these fields and no Root Tag is needed. Filters come only from the item's authored Category Settings entries. The default category appears first; remaining categories keep their authored order.

Use **Show Filter Tab Labels** to show or hide all tab labels together:

- With no modes configured, all cards in the Content Fragment scope are shown, with no mode or category controls.
- With one mode, its label is shown as plain text when labels are enabled. Its authored categories are available as filters.
- With two or more modes, labels are shown as tabs when enabled. The mode containing the default category is selected initially; otherwise, the first authored mode is used.
- When labels are hidden, the active mode remains available for filtering, but no mode labels or tabs are displayed.

Hiding labels also removes the space reserved for them. Choose each filter tag explicitly and add one category entry for every filter to display. A tag link's display title is used for its filter label when available; otherwise, the label is derived from the tag path. No tag API request is needed for the new child-item model.

## Category Settings And Default Category

Within each filter mode, each **Category Settings** entry contains **Category Tag**, **Background Color**, and **Default Category**, in that order. Available colours are Dark brown, Light brown, Green, Pink, Blue, and White, with White selected by default. Suggested use, such as Green for Nature, is guidance only; colours are not automatically assigned by category.

Category Tag and Background Color are required. Select exactly one tag per entry; Background Color defaults to White. New empty entries may immediately show Universal Editor required-field validation until a tag is selected. Entries without a tag do not become filters. The picker is configured with `multi: false`. Delivered entries containing more than one distinct tag show an explicit configuration error instead of silently selecting one.

Internal card destinations (`directDestinationUrl`) and popup CTAs (`modalCtaUrlInternal`) use EDS page paths: `/content/capella-hotels/global.html` becomes `/global` on the current site. Query strings and anchors are retained. External destinations and DAM image references are unchanged.

The properties panel is owned by Universal Editor, not the page's CSS. A custom separator between multifield entries is not currently configured because the documented model fields do not provide a separator component.

The first mode containing a default category is selected on load. Within each mode, its first default category is used, or its first category if no default is selected. If no defaults are selected anywhere, the first authored mode and its first category are used.

Categories without an authored colour use White. Filter matching uses the full tag ID, not its display title. The tag picker is not currently scoped with a `rootPath`; authors should select a tag from the intended mode's taxonomy.

Each Filter Tab uses the standard block-item resource type, and its Category Settings is a single-level multifield. Add, remove, and reorder tabs through the Universal Editor content tree. Empty new items remain visible with a configuration prompt. The editor reveals inactive tabs, and selecting an item in the content tree activates that tab without changing the published show/hide setting.

The five coloured backgrounds use the supplied Figma gradient angles, stops, and opacity values, applied once across the full block. White remains a solid white background. Existing colour values and component/property identifiers are unchanged; the Filter Tab rename is author-facing only.

## Popup Content

Popup details are authored in a separate Content Fragment and selected from the main card Content Fragment. Configure the popup description, image layout, feature and carousel images with alt text, and optional CTA. Publish the referenced popup Content Fragment before testing the card.

## Dark Image Overlay

The persisted `Filter-grid-card` query must return two independent boolean fields, with exact casing:

- `CardBackgroundPhotoDarkImageOverlay` on each card: controls the listing image overlay.
- `modalFeatureImageDarkImageOverlay` inside `modalDetails`: controls the popup feature image overlay (the wide popup uses this setting for its banner area).

Publish the updated AEM-managed models/query and fragments. These definitions are not stored in this repository.

Enabled cards use a 20% black image overlay, increasing to 30% on hover/focus, like Destination Cards. Disabled cards have no dark overlay, including on hover/focus. The modal setting independently enables or disables its existing 40% overlay. A missing or null value preserves the existing enabled overlay for each surface.

## Card Matching And Empty States

Filters match the Content Fragment's location tags or associated filter tags by full tag ID, not by display title. Unrelated roots do not match merely because their child labels are the same.

An empty selection displays **No matching results.** If there are no cards at all, it displays **No results are available.** These messages are the same in every mode.

## Existing Pages

Filters are no longer fetched from a root tag or the child-tags servlet. The earlier authored-category layout remains readable, but root-only modes have no category filters until authors configure explicit entries. To use the new model, add one **Filter Tab** child item per tab and author its categories. Previous multifield entries are not automatically migrated into child items; recreate them and preview/publish the page before rollout.

During Universal Editor block updates, unchanged Content Fragment scopes reuse the previous block's loaded cards so configuration changes do not wait for another card request. Changing the scope fetches fresh cards. Reload the page after publishing card Content Fragments to refresh their content. Normal preview/live page loads always request fresh cards.

The updated component models and runtime must be deployed before testing this field in Universal Editor; the editor loads branch code, not localhost.
