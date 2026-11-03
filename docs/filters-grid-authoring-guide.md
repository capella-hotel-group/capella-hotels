# Filters Grid Authoring

## Filter Modes And Labels

Add a **Filter Mode** child item to the Filters Grid for each tab (for example, Experience or Destination). Each item has:

- **Mode Label**: optional, but provide meaningful labels when multiple modes are displayed. A blank label displays "Filter mode".
- **Category Settings**: one repeatable field containing Category Tag, Background Color, and Default Category.

The child item itself represents the mode, so there is no repeatable Filter Mode Labels container around these fields and no Root Tag is needed. Filters come only from the item's authored Category Settings entries, in authored order.

Use **Show Filter Mode Labels** to show or hide all mode labels together:

- With no modes configured, all cards in the Content Fragment scope are shown, with no mode or category controls.
- With one mode, its label is shown as plain text when labels are enabled. Its authored categories are available as filters.
- With two or more modes, labels are shown as tabs when enabled. The mode containing the default category is selected initially; otherwise, the first authored mode is used.
- When labels are hidden, the active mode remains available for filtering, but no mode labels or tabs are displayed.

Hiding labels also removes the space reserved for them. Choose each filter tag explicitly and add one category entry for every filter to display. A tag link's display title is used for its filter label when available; otherwise, the label is derived from the tag path. No tag API request is needed for the new child-item model.

## Category Settings And Default Category

Within each filter mode, add entries in **Category Settings** to select the category tag, its **Background Color**, and optionally mark it as the **Default Category**. Available colours are Dark brown, Light brown, Green, Pink, Blue, and White. Suggested use, such as Green for Nature, is guidance only; colours are not automatically assigned by category.

The first mode containing a default category is selected on load. Within each mode, its first default category is used, or its first category if no default is selected. If no defaults are selected anywhere, the first authored mode and its first category are used.

Categories without an authored colour use White. Filter matching uses the full tag ID, not its display title. The tag picker is not currently scoped with a `rootPath`; authors should select a tag from the intended mode's taxonomy.

Each Filter Mode uses the standard block-item resource type, and its Category Settings is a single-level multifield. Add, remove, and reorder modes through the Universal Editor content tree. Empty new items remain visible with a configuration prompt. The editor reveals inactive mode items, and selecting an item in the content tree activates that mode without changing the published show/hide setting.

## Popup Content

Popup details are authored in a separate Content Fragment and selected from the main card Content Fragment. Configure the popup description, image layout, feature and carousel images with alt text, and optional CTA. Publish the referenced popup Content Fragment before testing the card.

## Card Matching And Empty States

Filters match the Content Fragment's location tags or associated filter tags by full tag ID, not by display title. Unrelated roots do not match merely because their child labels are the same.

An empty selection displays **No matching results.** If there are no cards at all, it displays **No results are available.** These messages are the same in every mode.

## Existing Pages

Previously published legacy layouts remain supported, including root-only modes (which still load child tags automatically) and the earlier authored-category layout. To use the new model, add one **Filter Mode** child item per mode and author its categories. Previous multifield entries are not automatically migrated into child items; recreate them and preview/publish the page before rollout.

The updated component models and runtime must be deployed before testing this field in Universal Editor; the editor loads branch code, not localhost.
