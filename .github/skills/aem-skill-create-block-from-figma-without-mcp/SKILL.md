---
name: aem-skill-create-block-from-figma-without-mcp
description: Scaffold a complete AEM EDS xwalk block from a Figma design. Use when an agent or workflow task requires block scaffolding from a Figma URL. Invoke this skill directly with a block name and Figma URL.
license: MIT
compatibility: Supports Figma MCP or Figma API access token.
metadata:
  author: Poornima-Ogilvy
  version: '2.1'
---

<!-- Canonical implementation. Invoke this skill directly with a block name and Figma URL. All workflow logic lives here. -->

Create an AEM EDS xwalk block from a Figma design.

Scaffold three files at `blocks/<block-name>/`:

- `<block-name>.js` — JavaScript decorator
- `<block-name>.css` — Block-scoped styles
- `_<block-name>.json` — AEM xwalk component model

---

**Input**: A `blockName` (kebab-case), a `figmaUrl` (valid `figma.com` URL), an optional `figmaAccessToken`, and an optional `description` (free text).

`figmaAccessToken` is a Figma REST API access token used to read Figma file metadata, nodes, styles, component properties, text content, layout information, and image references when Figma MCP tools are unavailable.

Authentication rules:
- Use Figma MCP tools first when available.
- Use `figmaAccessToken` only for direct Figma REST API requests when MCP access is unavailable.
- The token must only be used during the current session.
- Never write the token to project files, environment files, generated code, documentation, logs, summaries, or responses.
- Never expose the token value back to the user or another agent.
- Do not persist the token beyond the current skill execution.

When invoked by another agent, these should be passed as arguments. When invoked directly by a developer, read them from the user's message.

The `description` is a free-text brief — use it to describe interactions, animation timing, component state sequences, accessibility requirements, or cross-block context that Figma cannot infer visually. It is optional; the skill works without it.

---

## Step 1 — Parse and validate inputs

**Block name:**

- If no name is provided, use the **AskUserQuestion tool** to ask for it.
- Convert to kebab-case if needed (e.g., "My Hero Section" → `my-hero-section`). Confirm the converted name before proceeding.
- Valid pattern: `/^[a-z][a-z0-9-]*$/`

**Figma URL parsing:**

- Extract `fileKey` from the path: `figma.com/design/<fileKey>/...`
- Extract `nodeId` from the query: `node-id=<nodeId>` — convert `-` separators to `:` (e.g., `123-456` → `123:456`)
- If no `node-id` is present, `nodeId` is null
- Multiple URLs may be provided (one per state frame) — collect all and process sequentially in Step 2

**Description / brief (optional):**

- If a `description` is provided, store it as `devBrief` for reference throughout Steps 3, 4, and 5
- If not provided, skip silently — do NOT ask unless the component turns out to be ambiguous after Step 2

**Block collision check:**

- Check if `blocks/<block-name>/` already exists.
- If it does, ask the developer: "Block `<block-name>` already exists. Overwrite all three files, or abort?" Do NOT proceed without confirmation.

---

## Figma API access fallback

When `figmaAccessToken` is available and Figma MCP tools cannot be used:

1. Authenticate requests using:

```http
Authorization: Bearer <figmaAccessToken>
```
2. Use the Figma REST API to retrieve:

- File metadata
- Node tree for the requested `fileKey` and `nodeId`
- Component and instance information
- Text layers and visible content
- Auto-layout properties
- Fills, strokes, effects, spacing, and dimensions
- Image references where available

3. Use retrieved Figma data only for generating the AEM block implementation.

4. Do not:
- Store API responses containing sensitive design information
- Include raw Figma JSON in generated files
- Copy Figma access tokens into generated artifacts
- Return authentication headers or request details

Figma data source priority:

1. Figma MCP connection (preferred)
2. Figma REST API using `figmaAccessToken`
3. Developer-provided metadata fallback

If both MCP and API access are unavailable:
- Ask the developer to provide a valid Figma access token or enable Figma MCP access.


## Step 2 — Analyse the Figma node

Retrieve Figma node details using the highest-priority available source:

1. Figma MCP tools
2. Figma REST API using `figmaAccessToken`
3. Developer-provided Figma metadata (if supplied)

Use the retrieved node structure, properties, and visual information for block analysis.

### Structure type detection

| Signal                                                          | Pattern                                 |
| --------------------------------------------------------------- | --------------------------------------- |
| 3+ visually similar child frames or instances of same component | Container + filter (like `_cards.json`) |
| Single content area, no repeating children                      | Simple model (like `_hero.json`)        |
| Ambiguous (2 children, mixed types)                             | Ask the developer                       |

### Field-type mapping

| Figma element                                 | AEM `component` | `valueType` | Notes                                       |
| --------------------------------------------- | --------------- | ----------- | ------------------------------------------- |
| Short text / label (≤80 chars, no formatting) | `text`          | `string`    | Alt, subtitle, single-line                  |
| Long text / body copy / heading               | `richtext`      | `string`    | Include `"value": ""`                       |
| Image fill / asset frame                      | `reference`     | `string`    | `"multi": false`; gallery → `"multi": true` |
| Link / CTA button                             | `aem-content`   | `string`    | Internal links only                         |
| Toggle / boolean property                     | `boolean`       | `boolean`   | Flags, display toggles                      |
| Variant / style selector                      | `select`        | `string`    | Block display variants                      |

### 4-field limit

If more than 4 fields are inferred, stop and ask the developer to prioritize before generating.

### State detection

After structure and field analysis, check for multi-state signals from **all three sources** — first auto-detect from Figma, then check `devBrief`, then check whether multiple node IDs were provided. All paths converge on the same confirmation step.

**Detection signals:**

| Signal                                                                  | Source | Action                                                             |
| ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| Child frames named `default`, `hover`, `active`, `focus`, `disabled`    | Figma  | Likely CSS-only → ask trigger type before deciding                 |
| Child frames named `loading`, `empty`, `expanded`, `open`, `closed`     | Figma  | Likely JS-driven → ask trigger type before deciding                |
| Child frames named `step-1`, `step-2`, `step-N` (or `step_1`, `Step 1`) | Figma  | Likely multi-step sequence → ask trigger type before deciding      |
| Figma variant property with ≥2 non-pseudo-class values                  | Figma  | Ask trigger type before deciding                                   |
| `devBrief` mentions state words: "step", "state", "phase", "screen"     | Brief  | Parse state names from text → ask trigger type                     |
| Multiple Figma node IDs provided                                        | Input  | Frames are visual references for this component → ask trigger type |

**Trigger type question (mandatory before any state-aware code is generated):**

When multiple states or frames are detected — regardless of source — always ask the developer:

> "These frames show different visual states of the component. How are they triggered?"
>
> 1. **CSS-only** — hover, focus, transition, or animation; no JavaScript needed
> 2. **JS-driven** — click, scroll, timer, or external event; JavaScript manages state transitions
> 3. **Visual reference only** — these frames are just to show the full design; generate a single CSS implementation that covers all the visual rules, no state logic

Do NOT assume a trigger type from frame names alone. A frame named `hover` might still be JS-triggered; a frame named `expanded` might be a pure CSS transition. Only the developer knows.

**Generating based on the answer:**

| Answer                | What to generate                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CSS-only              | Standard `.js` (CSS-only template) + CSS with pseudo-class rules and/or transition blocks per visual frame              |
| JS-driven             | TS with `block.dataset.state` transitions + CSS `[data-state]` selectors                                                |
| Visual reference only | Standard `.js` (CSS-only template) + comprehensive CSS that incorporates visual details from all frames; no state logic |

If >3 JS-driven states are selected, additionally ask: "This will generate code for N states. Are you sure, or would you like to reduce the list?"

**CSS pseudo-class states (`:hover`, `:focus-visible`, `:disabled`):**

- These are the only states that can be confirmed as CSS-only without asking — they are structurally tied to browser events, not JS
- All other state names require trigger type confirmation

---

## Step 3 — Generate files

### `_<block-name>.json`

**Simple model:**

```json
{
  "definitions": [
    {
      "title": "<Block Title>",
      "id": "<block-name>",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/block/v1/block",
            "template": {
              "name": "<Block Title>",
              "model": "<block-name>"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "<block-name>",
      "fields": [
        /* mapped fields, max 4 */
      ]
    }
  ],
  "filters": []
}
```

**Container + filter model:**

```json
{
  "definitions": [
    {
      "title": "<Block Title>",
      "id": "<block-name>",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/block/v1/block",
            "template": {
              "name": "<Block Title>",
              "filter": "<block-name>"
            }
          }
        }
      }
    },
    {
      "title": "<Item Title>",
      "id": "<block-name>-item",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/block/v1/block/item",
            "template": {
              "name": "<Item Title>",
              "model": "<block-name>-item"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "<block-name>-item",
      "fields": [
        /* mapped fields, max 4 */
      ]
    }
  ],
  "filters": [
    {
      "id": "<block-name>",
      "components": ["<block-name>-item"]
    }
  ]
}
```

**Field object examples:**

```json
{ "component": "reference", "valueType": "string", "name": "image", "label": "Image", "multi": false }
{ "component": "text", "valueType": "string", "name": "imageAlt", "label": "Alt", "value": "" }
{ "component": "richtext", "name": "text", "value": "", "label": "Text", "valueType": "string" }
{ "component": "aem-content", "valueType": "string", "name": "link", "label": "Link" }
{ "component": "boolean", "valueType": "boolean", "name": "showOverlay", "label": "Show Overlay" }
{ "component": "select", "valueType": "string", "name": "variant", "label": "Variant", "options": [{ "name": "Default", "value": "default" }] }
```

### `<block-name>.js`

CSS-only (default — use unless design requires DOM restructuring):

```typescript
export default function decorate() {
  // <Block Title> block — decoration handled via CSS
}
```

DOM-restructuring (async, imports `moveInstrumentation`):

```typescript
import { moveInstrumentation } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    // restructure cells into semantic elements
    // call moveInstrumentation(source, target) when moving AEM-instrumented nodes
    // call block.replaceChildren(...newElements) once at the end
  });
}
```

With images (imports `createOptimizedPicture`):

```typescript
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

export default async function decorate(block) {
  const pictures = [...block.querySelectorAll('picture')];
  pictures.forEach((pic) => {
    const img = pic.querySelector('img');
    if (!img) return;
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(pic, optimized);
    pic.replaceWith(optimized);
  });
}
```

JS-driven states (use when multi-state is confirmed — `data-state` attribute pattern):

```typescript
export default async function decorate(block) {
  // Build DOM, then call block.replaceChildren(...) once

  // Set initial state
  block.dataset.state = 'default';

  // Example: toggle to expanded on button click
  const trigger = block.querySelector('.\<block-name\>-trigger');
  trigger?.addEventListener('click', () => {
    const current = block.dataset.state;
    block.dataset.state = current === 'expanded' ? 'default' : 'expanded';
  });
}
```

Multi-step sequence (use when `step-N` states are confirmed):

```typescript
export default async function decorate(block) {
  // Build DOM, then call block.replaceChildren(...) once

  const totalSteps = 3; // replace with actual count
  let currentStep = 1;

  function goToStep(n) {
    if (n < 1 || n > totalSteps) return;
    currentStep = n;
    block.dataset.step = String(n);
  }

  goToStep(1); // initialise

  block.querySelector('.\<block-name\>-next')?.addEventListener('click', () => {
    goToStep(currentStep + 1);
  });
  block.querySelector('.\<block-name\>-prev')?.addEventListener('click', () => {
    goToStep(currentStep - 1);
  });
}
```

### `<block-name>.css`

```css
/* <block-name> block */
.<block-name > {
  /* container styles */
}

.<block-name > -item {
  /* item styles */
}

.<block-name > -image {
  width: 100%;
}

.<block-name > -image img {
  width: 100%;
  height: auto;
  object-fit: cover;
}

.<block-name > -body {
  color: var(--text-color);
  background-color: var(--background-color);
}

@media (width >= 900px) {
  .<block-name > {
    /* desktop overrides */
  }
}
```

JS-driven state selectors (append when multi-state is confirmed):

```css
/* <block-name> — JS-driven states */
.<block-name > [data-state='default'] {
  /* default state styles */
}

.<block-name > [data-state='loading'] {
  /* loading state styles */
}

.<block-name > [data-state='expanded'] {
  /* expanded state styles */
}
```

Multi-step sequence selectors (append when step-N states are confirmed):

```css
/* <block-name> — step states */
.<block-name > [data-step] .<block-name > -panel {
  display: none;
}

.<block-name > [data-step='1'] .<block-name > -panel:nth-child(1),
.<block-name > [data-step='2'] .<block-name > -panel:nth-child(2) {
  display: block;
}

/* Extend for each additional step */
```

CSS rules:

- BEM-adjacent naming: `.<block-name>`, `.<block-name>-<element>`, `.<block-name>-<element>--<modifier>`
- All values use `var(--token-name)` — no hardcoded hex or px
- Modern range media queries: `@media (width >= 900px)`
- 4-space indentation
- No nested selectors — keep flat

---

## Step 4 — Confirm and write

Summarise the generation plan before writing:

> **Block:** `<block-name>`
> **Structure:** \<Simple model / Container+filter\>
> **Fields:** \<list name + component for each field\>
> **States:** \<None / list of JS-driven states or step sequence\> _(omit line if no multi-state)_
> **Brief:** \<First 100 chars of devBrief\> _(omit line if no description provided)_

Write all three files. When invoked by another agent, return:

```json
{
  "blockName": "<block-name>",
  "files": [
    "blocks/<block-name>/<block-name>.js",
    "blocks/<block-name>/<block-name>.css",
    "blocks/<block-name>/_<block-name>.json"
  ]
}
```

---

## Step 5 — Register block in AEM

### 6a. Add block to section filter

Open `models/_section.json` and add `"<block-name>"` to the `filters[0].components` array in alphabetical order. This makes the block insertable in the Universal Editor.

### 6b. Regenerate root AEM component JSON files

Run `npm run build:json`. This regenerates:

- `component-models.json`
- `component-definition.json`
- `component-filters.json`

The new block will NOT appear in the Universal Editor until both 6a and 6b are complete.

When invoked by another agent, include this step in the returned result:

```json
{ "blockName": "<block-name>", "files": [...], "sectionJsonUpdated": true, "jsonRegenerated": true }
```

If `build:json` fails, report the error and instruct the developer to run `npm run build:json` manually.

---

## Step 6 — Verify lint

Run lint to confirm the new block has no errors:

```bash
npm run lint
```

- If lint **passes**: confirm to the developer that the block is ready at `blocks/<block-name>/<block-name>.js`
- If lint **fails**: show the error, identify the likely cause (lint error, missing import, invalid CSS token, unused variable), fix it in the generated files, and re-run `npm run lint` until it passes
- Do NOT leave failing lint — fix all errors before finishing

When invoked by another agent, include the result:

```json
{ "blockName": "<block-name>", "files": [...], "sectionJsonUpdated": true, "jsonRegenerated": true, "buildPassed": true }
```

---

## Step 7 — Generate content entry prompt

After Step 7 passes (or after Step 5 when invoked by another agent that skips the build), generate a ready-to-copy prompt the developer can give to any AEM AI assistant to enter realistic demo content that matches the Figma design.

### Demo value rules per field type

| Field `component`    | How to derive demo value                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`               | Extract visible layer text from the Figma node; if unavailable, write a short, on-brand placeholder (≤ 80 chars) that matches the tone and length visible in the design                                              |
| `richtext`           | Extract body copy from the Figma node; if unavailable, write 1–2 sentences of realistic hotel/luxury-lifestyle copy matching the apparent length of the text area in the design                                      |
| `reference` (image)  | Describe the asset in natural language ("a luxury hotel lobby at dusk, warm lighting") and suggest a placeholder DAM path: `/content/dam/<block-name>/<field-name>.jpg` — note it must be replaced with a real asset |
| `aem-content` (link) | Use a plausible internal path visible in Figma (button label → slug) or fall back to `/en/<block-name>`                                                                                                              |
| `boolean`            | Set to the value shown in the Figma default/first frame                                                                                                                                                              |
| `select`             | Set to the variant value that matches the Figma frame being implemented                                                                                                                                              |

**For container+filter blocks:** generate demo entries for **3 items** (or as many as are visible in the Figma node, up to 3) to show meaningful variety. Vary the copy and image descriptions across items.

### Output format

Output the prompt in a fenced code block immediately after this heading:

> **Content entry prompt — copy and paste into AEM Copilot chat**

The prompt body must:

1. Open with one line identifying the target block:
   > "On the current page, find (or insert) the **\<Block Title\>** block."
2. List every model field with its suggested demo value, one field per line, in the format:
   > `- <Field Label>: <demo value>`
3. For container+filter blocks, repeat the field list for each item, labelled **Item 1**, **Item 2**, etc.
4. Close with:
   > "Save all fields. The content should match the Figma design."

After the code block, add this note on its own line:

> _Copy this prompt and paste it into the AEM Copilot chat (or hand it to your AEM AI) to populate realistic demo content._

### Agent return value

When invoked by another agent, include in the returned JSON:

```json
{ "blockName": "<block-name>", "files": [...], "sectionJsonUpdated": true, "jsonRegenerated": true, "buildPassed": true, "contentPromptGenerated": true }
```

---

## Optional Next Steps

After the block is ready, these skills are available if present in this repo:

- **`aem-skill-testing-blocks`** — validate the block in a real browser (lint, responsive check, screenshot)
- **`aem-skill-code-review`** — self-review before opening a PR (TypeScript patterns, CSS scoping, security)

These are optional — invoke them if the developer asks or if the block is complex enough to warrant it.

---

## Guardrails

- Block folder exists → ask before overwriting
- Ambiguous structure → ask before choosing pattern
- > 4 fields → ask before truncating
- Multi-state frames detected → always ask trigger type (CSS-only / JS-driven / visual reference) before generating
- Never assume trigger type from frame names alone — a `hover` frame could be JS-triggered
- > 3 JS-driven states confirmed → ask developer to confirm or reduce list before generating
- Trigger type not confirmed → fall back to CSS-only template, no state logic generated
- Block name not kebab-case → auto-convert and confirm
- CSS pseudo-class states (`:hover`, `:focus`) → only exception that is always CSS-only without asking
- No hardcoded hex/px in CSS → use `var(--token-name)`
- No build alias → use `../../scripts/...` relative imports
- No `innerHTML =` → use `replaceChildren()`
- Generated code must pass `npm run lint`
- Figma access token must never be persisted, logged, committed, or included in generated artifacts
- Prefer Figma MCP over REST API token access when both are available
