# Filters Grid Authoring

## Filter Modes And Labels

Add one entry per mode in **Filter Mode Labels**. Each entry requires a **Root Tag**; **Mode Label** is optional. When a label is blank, it is derived from the root tag. Add each selectable category under that mode's **Category Settings** multifield. Filters are read from these authored entries; the Root Tag no longer supplies the filter list.

Use **Show Filter Mode Labels** to show or hide all mode labels together:

- With no modes configured, all cards in the Content Fragment scope are shown, with no mode or category controls.
- With one mode, its label is shown as plain text when labels are enabled. Its authored categories are available as filters.
- With two or more modes, labels are shown as tabs when enabled. The mode containing the default category is selected initially; otherwise, the first authored mode is used.
- When labels are hidden, the active mode remains available for filtering, but no mode labels or tabs are displayed.

Hiding labels also removes the space reserved for them. Choose each filter tag explicitly and add one category entry for every filter to display. The tag's title is used for its filter label; if it is unavailable, the label is derived from the tag path. Legacy mode configurations that have only a Root Tag continue to load their child tags automatically.

## Category Settings And Default Category

Within each filter mode, add entries in **Category Settings** to select the category tag, its **Background Color**, and optionally mark it as the **Default Category**. Available colours are Dark brown, Light brown, Green, Pink, Blue, and White. Suggested use, such as Green for Nature, is guidance only; colours are not automatically assigned by category.

The default category is active on load, and its mode is selected as well. If multiple categories are marked as default, the first one wins. If no default is selected, the first authored mode and its first category are used.

Categories without an authored colour use White. Filter matching uses the full tag ID, not its display title. The tag picker is not currently scoped with a `rootPath`; authors should select a tag from the intended mode's taxonomy.

The current model nests a repeatable Category Settings container inside the repeatable Filter Mode Labels container. The runtime can read this structure, but nested multifield authoring support must be verified in the target Universal Editor before rollout.

## Popup Content

Popup details are authored in a separate Content Fragment and selected from the main card Content Fragment. Configure the popup description, image layout, feature and carousel images with alt text, and optional CTA. Publish the referenced popup Content Fragment before testing the card.

## Card Matching And Empty States

Filters match the Content Fragment's location tags or associated filter tags by full tag ID, not by display title. Unrelated roots do not match merely because their child labels are the same.

An empty selection displays **No matching results.** If there are no cards at all, it displays **No results are available.** These messages are the same in every mode.

## Existing Pages

Previously published pages with separate Experience and Destination fields still render. When editing a block with the new model, add its modes to **Filter Mode Labels** and preview/publish the page. The old fields are not automatically migrated into the new repeatable field.

The updated component models and runtime must be deployed before testing this field in Universal Editor; the editor loads branch code, not localhost.
