# Filters Grid Authoring

## Filter Mode Labels

Add one entry per top-level mode in **Filter Mode Labels**. Each entry has:

- **Mode Label**: the tab title, such as Experience, Destination, By Interest, or By Type.
- **Root Tag**: the parent tag whose children the child-tags API lists as filters.
- **Default Active Tab**: check this for the mode that should open first.

The number of tabs follows these entries. The default mode is displayed first; the remaining modes keep their authored order. A root can use either `capella-hotels:destination` or `/content/cq:tags/capella-hotels/destination` format. The API supplies the child-filter labels and order, including tags that have no matching cards.

## Default Active Tab

Select **Default Active Tab** inside the desired **Filter Mode Labels** entry. The checked mode is selected on load and displayed first, even if its label is renamed. No label or root tag needs to be typed into a separate default field.

Select only one default. If multiple modes are checked, the first checked entry wins. If all mode checkboxes are unchecked, the first authored mode is used.

Universal Editor's standard repeated boolean fields are independent checkboxes; checking one does not automatically uncheck another entry. Cross-entry exclusivity requires a custom UE extension. The runtime always activates just one mode and uses the first checked entry if multiple are selected.

## Card Matching And Empty States

Filters match the Content Fragment's location tags or associated filter tags by full tag ID, not by display title. Unrelated roots do not match merely because their child labels are the same.

An empty selection displays **No matching results.** If there are no cards at all, it displays **No results are available.** These messages are the same in every mode.

## Existing Pages

Previously published pages with separate Experience and Destination fields still render. When editing a block with the new model, add its modes to **Filter Mode Labels** and preview/publish the page. The old fields are not automatically migrated into the new repeatable field.

The updated component models and runtime must be deployed before testing this field in Universal Editor; the editor loads branch code, not localhost.
