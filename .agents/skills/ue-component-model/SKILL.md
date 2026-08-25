---
name: ue-component-model
description: Create or edit the Universal Editor component configuration for AEM Edge Delivery Services blocks in this project. Use this skill whenever the user mentions component models, component definitions, component filters, block configuration for the Universal Editor, UE block setup, adding a new block to UE, configuring block properties, block authoring fields, or any task involving the block's `_<blockname>.json`. Also trigger when the user wants to create a new EDS/Franklin block with UE support, modify block fields, add a block to the section filter, or asks about how blocks connect to the Universal Editor. Adapted for this repo: config is always authored as a distributed `src/blocks/<name>/_<name>.json`, aggregated into the root `component-*.json` files by `npm run build:json` — the root files are generated and must never be hand-edited.
license: Apache-2.0
metadata:
  adapted-from: "adobe/skills ue-component-model — paths adjusted for src/blocks/ distributed config + npm run build:json pipeline"
---

# Universal Editor Component Model Configuration

This skill helps you create or edit the hand-authored `_<blockname>.json` file (under `src/blocks/<name>/`) that defines how an AEM Edge Delivery Services (EDS) block appears and behaves in the Universal Editor (UE). It contains three sections, merged by `npm run build:json` into the root aggregated files:

1. **definitions** — Registers blocks in the UE component palette (aggregated into root `component-definition.json`)
2. **models** — Defines property panel fields for each block (aggregated into root `component-models.json`)
3. **filters** — Controls where blocks can be placed (aggregated into root `component-filters.json`)

**This project always uses the distributed pattern — never edit the root `component-definition.json` / `component-models.json` / `component-filters.json` directly.** Those are generated output; hand edits are silently lost on the next `npm run build:json`.

## When to Use

- Creating a new block that needs UE authoring support
- Adding/modifying fields on an existing block's property panel
- Registering a block so it appears in the author's component palette
- Setting up container blocks with child items
- Adding block variants/style options

## Workflow

### Step 1: Understand the Block

Before generating any configuration, read and analyze:

1. **The block's TypeScript source file** (`src/blocks/<name>/<name>.ts`) — understand what content the `decorate(block)` function expects:
   - What does it read from the block div? (images, links, text, classes)
   - Does it expect a flat structure or rows of items?
   - Does it use `block.querySelector('a')` (links/URLs), `block.querySelector('picture')` (images), etc.?
   - Does it check for CSS classes/variants?

2. **The block's CSS file** (`src/blocks/<name>/<name>.css`) — look for variant-specific styles.

3. **Existing config** — check if entries already exist:
   - Check for `src/blocks/<name>/_<name>.json` — this is the block's own distributed config; it almost always already exists once the block has UE support
   - If absent, confirm the block ID isn't already registered elsewhere by searching the generated root `component-definition.json` / `component-models.json` / `component-filters.json` (read-only check — never edit these directly)

### Step 2: Determine the Block Type

Based on the JS analysis:

- **Simple block**: One component with its own fields. Most blocks are this type.
  - Example: Hero, Embed — single model, no children

- **Container block**: Has repeatable child items (cards, slides, tabs).
  - Clue: JS iterates over `block.children` or creates items from rows
  - Needs: container definition + item definition + filter

- **Key-value block**: Configuration-style block (2-column key-value pairs).
  - Clue: Each property is independent, not a grid of content
  - Needs: `"key-value": true` in template

### Step 3: Design the Model Fields

Map the block's content expectations to component model fields. Read [references/field-types.md](references/field-types.md) for the full field type reference.

**Common field mappings:**

| Block expects...         | Use component type                    | Notes                                                 |
| ------------------------ | ------------------------------------- | ----------------------------------------------------- |
| An image                 | `reference` (name: `image`)           | Pair with `text` field named `imageAlt`               |
| A URL/link               | `aem-content` (name: `link` or `url`) | For page links and external URLs                      |
| Rich text content        | `richtext`                            | For formatted text with headings, lists, links        |
| Plain text (single line) | `text`                                | For titles, labels, short strings                     |
| Plain text (multi-line)  | `textarea`                            | For descriptions, notes, long text without formatting |
| Heading level choice     | `select` with h1-h6 options           | Name it `titleType` to auto-collapse with title       |
| Style variants           | `multiselect` (name: `classes`)       | Values become CSS classes on block div                |
| Multiple toggles         | `checkbox-group`                      | For multiple independent boolean options              |
| Boolean toggle           | `boolean`                             | For show/hide options                                 |
| Number value             | `number`                              | For counts, limits                                    |
| Content Fragment         | `aem-content-fragment`                | For CF-driven blocks                                  |
| Experience Fragment      | `aem-experience-fragment`             | For reusable content+layout fragments                 |
| Content tags             | `aem-tag`                             | For categorization via AEM tag picker                 |

**Field naming rules (semantic collapsing):**

- `image` + `imageAlt` → collapsed into `<picture><img alt="...">`
- `link` + `linkText` + `linkTitle` + `linkType` → collapsed into `<a href="..." title="...">text</a>` with optional class
- `title` + `titleType` → collapsed into `<h2>title</h2>` (level from titleType)
- Fields prefixed with `group_` (underscore separator) are grouped into a single cell

### Step 4: Generate the Configuration

**Always author `src/blocks/<name>/_<name>.json`** with all three sections in one file:

```json
{
  "definitions": [ ... ],
  "models": [ ... ],
  "filters": [ ... ]
}
```

See the shape reference below (same field syntax as upstream, just written to this one distributed file instead of the three root files).

**definitions** — array entry per component (block + optional item):

```json
{
  "title": "<Block Display Name>",
  "id": "<block-id>",
  "plugins": {
    "xwalk": {
      "page": {
        "resourceType": "core/franklin/components/block/v1/block",
        "template": {
          "name": "<Block Name>",
          "model": "<model-id>"
        }
      }
    }
  }
}
```

For container blocks, add both the container AND item definitions. The container gets `"filter"` instead of `"model"`, and the item uses `"core/franklin/components/block/v1/block/item"` as resourceType.

For key-value blocks, add `"key-value": true` to the template.

Template can include default values for any model field (e.g., `"titleType": "h3"`, `"classes": ["light"]`).

**models** — array entry per model:

```json
{
  "id": "<model-id>",
  "fields": [
    {
      "component": "<field-type>",
      "name": "<property-name>",
      "label": "<Display Label>",
      "valueType": "string"
    }
  ]
}
```

**filters** — add the block ID to the `section` filter's `components` array. That filter is defined once in the shared `src/models/_section.json` fragment (`filters[0].components`, id `"section"`) — add your new block's ID there, not in a root file. For container blocks, also add this block's own filter entry (defining allowed children) inside its `_<name>.json`.

### Step 4.5: Regenerate the Aggregated Root Files

After writing or editing `src/blocks/<name>/_<name>.json` (or `src/models/_section.json`), run:

```bash
npm run build:json
```

This regenerates the root `component-definition.json`, `component-models.json`, and `component-filters.json` from all `src/models/_*.json` fragments and every `src/blocks/*/_*.json`. **Never hand-edit the root files** — they're overwritten on the next `build:json` run and any manual edit will be silently lost.

### Step 5: Validate

After generating the config, verify:

1. **ID consistency**: The `id` in the definition matches what's used in the filter. The `template.model` value matches the `id` in the model.
2. **Filter registration**: The block's ID appears in the `section` filter's `components` array (otherwise authors can't add it to pages) — check `src/models/_section.json`.
3. **Field names match block TS**: The `name` properties in the model fields should produce HTML that the block's `decorate()` function can consume.
4. **Semantic collapsing**: Paired fields use correct suffixes (e.g., `image`/`imageAlt`, not `image`/`altText` unless intentional).
5. **Valid JSON**: `src/blocks/<name>/_<name>.json` remains valid JSON after edits.
6. **No duplicate IDs**: No model or filter ID conflicts with existing entries (search other `src/blocks/*/_*.json` files).
7. **Ran `npm run build:json`**: Confirm the root `component-*.json` files were regenerated and reflect the new/edited block, and run `npm run lint` to check the models follow xwalk best practices.

## Reference Files

For detailed information, read these reference files as needed:

- **[references/architecture.md](references/architecture.md)** — How the three files connect, the full AEM→Markdown→HTML pipeline, resource types, field naming conventions, semantic collapsing rules, and RTE filter configuration
- **[references/field-types.md](references/field-types.md)** — Complete reference for all 17 field component types (`text`, `textarea`, `richtext`, `reference`, `aem-content`, `aem-content-fragment`, `aem-experience-fragment`, `aem-tag`, `select`, `multiselect`, `checkbox-group`, `radio-group`, `boolean`, `number`, `date-time`, `container`, `tab`), valueType constraints, required properties, field properties, validation types, conditional fields, and option formats
- **[references/examples.md](references/examples.md)** — Real examples showing Hero (simple), Embed (simple with URL), Cards (container), Teaser (variants), Product Details (key-value), Article (content fragment), Section configuration, Metadata (textarea), Feature Toggles (checkbox-group), and RTE filter configuration

## Common Pitfalls

- **Forgetting to add to section filter**: The block won't appear in the author's add menu unless it's in the `section` filter's components list.
- **Wrong resourceType**: Almost all custom blocks use `core/franklin/components/block/v1/block`. Don't invent custom resource types.
- **Mismatched model/filter IDs**: The `template.model` must exactly match the model `id`, and `template.filter` must exactly match the filter `id`.
- **Choosing the wrong text field type**: Use `text` for single-line strings, `textarea` for multi-line plain text, and `richtext` for formatted content. For URLs and page links, use `aem-content` so authors get the content picker.
- **Wrong valueType**: Most components enforce a specific `valueType` (e.g., `boolean` must use `"boolean"`, `number` must use `"number"`, `checkbox-group` must use `"string[]"`). Always include `valueType` and check the field-types reference for the enforced value.
- **Container without filter**: Container blocks need a `filter` (not a `model`) in their template, and a corresponding filter entry in component-filters.json.
