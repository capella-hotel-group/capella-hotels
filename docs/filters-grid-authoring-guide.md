# Filters Grid Authoring

## Filter Mode Labels

Add one entry per top-level mode in **Filter Mode Labels**. Each entry has:

- **Mode Label**: the tab title, such as Experience, Destination, By Interest, or By Type.
- **Root Tag**: the parent tag whose children the child-tags API lists as filters.

The number of tabs follows these entries. The default mode is displayed first; the remaining modes keep their authored order. A root can use either `capella-hotels:destination` or `/content/cq:tags/capella-hotels/destination` format. The API supplies the child-filter labels and order, including tags that have no matching cards.

## Default Filter Mode

Enter a configured mode label or its root tag. Label matching ignores case and surrounding spaces. Using a root tag keeps the default stable when a label is renamed. A blank or unmatched value selects the first configured mode.

For example, to open a mode labeled **By Place** with the destination root, set the default to `By Place` or `capella-hotels:destination`.

## Card Matching And Empty States

Filters match the Content Fragment's location tags or associated filter tags by full tag ID, not by display title. Unrelated roots do not match merely because their child labels are the same.

An empty selection displays **No matching results.** If there are no cards at all, it displays **No results are available.** These messages are the same in every mode.

## Existing Pages

Previously published pages with separate Experience and Destination fields still render. When editing a block with the new model, add its modes to **Filter Mode Labels** and preview/publish the page. The old fields are not automatically migrated into the new repeatable field.

The updated component models and runtime must be deployed before testing this field in Universal Editor; the editor loads branch code, not localhost.
