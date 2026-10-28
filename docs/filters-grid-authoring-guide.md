# Filters Grid Authoring

## Filter Modes And Labels

Add one entry per mode in **Filter Mode Labels**. Each entry requires a **Root Tag**; **Mode Label** is optional. When a label is blank, it is derived from the root tag.

Use **Show Filter Mode Labels** to show or hide all mode labels together:

- With no modes configured, all cards in the Content Fragment scope are shown, with no mode or category controls.
- With one mode, its label is shown as plain text when labels are enabled. Its child tags remain available as category filters.
- With two or more modes, labels are shown as tabs when enabled. The active mode is determined by the default category when it belongs to that mode; otherwise, the first authored mode is used.
- When labels are hidden, the active mode remains available for filtering, but no mode labels or tabs are displayed.

Hiding labels also removes the space reserved for them. A root can use either `capella-hotels:destination` or `/content/cq:tags/capella-hotels/destination` format. The API supplies the child-filter labels and order, including tags that have no matching cards.

## Category Settings And Default Category

Add entries in **Category Settings** to associate a category tag with a **Background Color**. Available colours are Dark brown, Light brown, Green, Pink, Blue, and White. Suggested use, such as Green for Nature, is guidance only; colours are not automatically assigned by category.

Select **Default Category** for the category that should be active on load. The mode containing that tag is selected as well. If multiple categories are marked as default, the first one wins. If no default is selected or the tag is not returned by the tag API, the first authored mode and its first category are used.

Categories without an authored colour use White. Filter matching uses the full tag ID, not its display title.

## Popup Content

Popup details are authored in a separate Content Fragment and selected from the main card Content Fragment. Configure the popup description, image layout, feature and carousel images with alt text, and optional CTA. Publish the referenced popup Content Fragment before testing the card.

## Card Matching And Empty States

Filters match the Content Fragment's location tags or associated filter tags by full tag ID, not by display title. Unrelated roots do not match merely because their child labels are the same.

An empty selection displays **No matching results.** If there are no cards at all, it displays **No results are available.** These messages are the same in every mode.

## Existing Pages

Previously published pages with separate Experience and Destination fields still render. When editing a block with the new model, add its modes to **Filter Mode Labels** and preview/publish the page. The old fields are not automatically migrated into the new repeatable field.

The updated component models and runtime must be deployed before testing this field in Universal Editor; the editor loads branch code, not localhost.
