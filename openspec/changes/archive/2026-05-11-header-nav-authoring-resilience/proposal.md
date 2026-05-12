## Why

`header.js` parses the `/nav` document with hard-coded assumptions: Destinations has exactly 1 child `<ul>`, and all nav items live in exactly 1 root `<ul>`. When an author inputs the wrong structure in Universal Editor (creates multiple nested lists for sub-category groups, or creates a separate list for Experiences), JS silently discards the data — no error, no warning, the header renders with missing items and nobody knows why. The JS needs a defensive fix, and an authoring guide needs to be added to prevent the error from recurring.

## What Changes

- **`blocks/header/header.js`**: Fix `buildDropdown()` to merge multiple `<ul>` siblings into a single flat list of sub-categories. Fix `decorate()` to collect `<li>` from all `<ul>` elements in `sections[0]` instead of only the first `<ul>`. Add clear `console.warn` messages when an invalid structure is detected (missing lang list, missing nav items).
- **`docs/header-nav-authoring-guide.md`**: Create a new authoring guide with visual correct/incorrect diffs and clear rules for each section of the `/nav` document.

## Capabilities

### New Capabilities
- `header-nav-authoring-guide`: Documentation guiding authors on the correct structure for the `/nav` document in Universal Editor.

### Modified Capabilities
- `header-desktop-layout`: The JS parse logic of the header block changes — more defensive against malformed authoring input, with clear warnings when the structure is invalid.

## Impact

- **`blocks/header/header.js`**: `buildDropdown()` and `decorate()` change their parse logic. Backward compatible — correct structure still works as before.
- **`docs/header-nav-authoring-guide.md`**: New file, no code impact.
- **Breaking**: None.
