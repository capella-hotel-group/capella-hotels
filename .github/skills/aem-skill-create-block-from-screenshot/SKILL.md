---
name: aem-skill-create-block-from-screenshot
description: Scaffold a complete AEM EDS xwalk block from one or more screenshots (no Figma required). Use when an agent or workflow task requires block scaffolding from a design image. Developers: use the /aem-create-block-from-screenshot prompt instead.
license: MIT
compatibility: No MCP server and no Figma required. Requires an agent that can view images attached in chat. Image files referenced only by path/folder are NOT viewable — they must be attached (dragged into the conversation) before analysis.
metadata:
  author: Poornima Ogilvy
  version: '1.0'
  derived-from: aem-skill-create-block-from-figma-without-mcp
---

<!-- Canonical implementation. Invoke this skill directly with a block name and one or more screenshots. All workflow logic lives here; the /aem-create-block-from-screenshot prompt is a thin delegation wrapper that parses inputs and calls this skill. -->

Create an AEM EDS xwalk block from a **screenshot** of the design.

Scaffold three files at `src/blocks/<block-name>/`:

- `<block-name>.ts` — TypeScript decorator
- `<block-name>.css` — Block-scoped styles
- `_<block-name>.json` — AEM xwalk component model

Do not write generated runtime files under root `blocks/`, `scripts/`, or `styles/`; this repository builds those from `src/`.

---

**Input**: A `blockName` (kebab-case), one or more `screenshots` (image files or a folder path under `.github/screenshots/`), and an optional `description` (free text).

When invoked by another agent, these should be passed as arguments. When invoked directly by a developer, read the block name and brief from the user's message and view the attached image(s).

Screenshots are the **design source**. The recommended location is `.github/screenshots/<block-name>/` (see `.github/screenshots/README.md`), but images attached directly in chat are equally valid — and are the only form the agent can actually _see_. A folder or file path alone is not viewable: it must be enumerated (`list_dir`) and then the images dragged into chat before analysis. See Step 1 for the full resolution rule.

The `description` is a free-text brief — use it to describe interactions, animation timing, component state sequences, accessibility requirements, responsive behaviour, or which parts are author-editable that a static image cannot convey. It is optional but **more valuable here than in the Figma flow**, because a screenshot carries no layer names, variants, or design tokens.

**Workflow at a glance:** parse inputs (1) → analyse the viewable image (2) → **present a plan and get explicit approval (3, mandatory gate)** → generate (4) → write (5) → register in AEM (6) → verify lint and build (7) → content prompt (8). No files are created before Step 3 approval.

---

## Step 1 — Parse and validate inputs

**Block name:**

- If no name is provided, use the **AskUserQuestion tool** to ask for it.
- Convert to kebab-case if needed (e.g., "My Hero Section" → `my-hero-section`). Confirm the converted name before proceeding.
- Valid pattern: `/^[a-z][a-z0-9-]*$/`

**Screenshot resolution:**

> **Critical limitation — how agents see images.** An agent can only analyse an image that is present in the conversation as a **viewable attachment**. Image bytes on disk **cannot** be loaded with a file-reading tool (`read_file` on a `.png` returns binary garbage, not a picture). Therefore a bare file path or folder reference is _not_ directly viewable — it only tells you the file exists, not what it looks like. Enumerating a folder is a discovery step, **not** a way to see the design.

Resolve screenshots in this priority order:

1. **Images attached directly in chat** → use them. This is the only reliable, always-viewable source.
2. **A folder path** (e.g., `.github/screenshots/<block-name>`) → enumerate it first with the `list_dir` tool (accept `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`). Then:
   - Report the filenames you found back to the developer.
   - **Verify each image is actually viewable to you.** If your environment renders workspace images inline, proceed. If you cannot see them (you only have the paths, not the pictures), **STOP** and ask the developer to **drag the listed files into the chat** so they become viewable attachments.
3. **A single file path** → same rule: confirm it exists, then require it as a viewable attachment if you cannot render it from the path.
4. **Nothing found** → ask: "I couldn't find a screenshot to work from. Attach the image(s) directly in chat, or add files under `.github/screenshots/<block-name>/` and then drag them into the conversation." Never guess a design.

Order multiple images by filename; treat `default*`/`desktop*` as the primary view. Label each by filename (e.g., `default`, `mobile`, `hover`, `step-1`) for use in Step 2.

> **Never analyse a design you cannot see.** If the images are not viewable to you as attachments, do not infer structure, fields, or styles from filenames, the folder name, or the `devBrief` alone — ask for the attachments first.

**Description / brief (optional):**

- If a `description` is provided, store it as `devBrief` for reference throughout Steps 3, 4, and 5.
- If not provided, skip silently — do NOT ask unless the component turns out to be ambiguous after Step 2.

**Block collision check:**

- Check if `src/blocks/<block-name>/` already exists.
- If it does, ask the developer: "Block `<block-name>` already exists. Overwrite all three files, or abort?" Do NOT proceed without confirmation.

---

## Step 2 — Analyse the screenshot

Analyse the image(s) visually. Because a screenshot has no layer metadata, infer structure and fields from what is rendered, and lean on `devBrief` and filenames for anything not visible.

### Structure type detection

| Signal                                                           | Pattern                                 |
| ---------------------------------------------------------------- | --------------------------------------- |
| 3+ visually similar repeating cards/tiles/rows                   | Container + filter (like `_cards.json`) |
| Single content area, no repeating children                       | Simple model (like `_hero.json`)        |
| Ambiguous (2 items, mixed types)                                 | Ask the developer                       |

### Field-type mapping

| Visual element                                | AEM `component` | `valueType` | Notes                                       |
| --------------------------------------------- | --------------- | ----------- | ------------------------------------------- |
| Short text / label (≤80 chars, no formatting) | `text`          | `string`    | Alt, subtitle, single-line                  |
| Long text / body copy / heading               | `richtext`      | `string`    | Include `"value": ""`                       |
| Photo / image area                            | `reference`     | `string`    | `"multi": false`; gallery → `"multi": true` |
| Link / CTA button                             | `aem-content`   | `string`    | Internal links only                         |
| Toggle / on-off affordance                    | `boolean`       | `boolean`   | Flags, display toggles                      |
| Repeated style/theme variant across frames    | `select`        | `string`    | Block display variants                      |

### 4-field limit

If more than 4 fields are inferred, stop and ask the developer to prioritize before generating.

### Design-token inference (screenshot-specific)

A screenshot has no design tokens. Do NOT hardcode sampled hex/px values. Instead:

- Map visible colours to the nearest existing token in `src/styles/styles.css` (`var(--text-color)`, `var(--background-color)`, brand colours, etc.).
- If a colour clearly has no matching token, note it in the Step 3 plan and ask the developer whether to add a token rather than inlining a hex value.
- Approximate spacing/typography with existing scale tokens; never invent pixel values that belong to the design system.

### State detection

Check for multi-state signals from **all three sources** — first the image(s), then `devBrief`, then whether multiple images were provided. All paths converge on the same confirmation step.

**Detection signals:**

| Signal                                                                    | Source | Action                                                             |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------ |
| A single image showing an obvious resting state only                      | Image  | Likely single-state → no state logic                               |
| Filenames like `default`, `hover`, `active`, `focus`, `disabled`          | Image  | Likely CSS-only → ask trigger type before deciding                 |
| Filenames like `loading`, `empty`, `expanded`, `open`, `closed`           | Image  | Likely JS-driven → ask trigger type before deciding                |
| Filenames like `step-1`, `step-2`, `step-N` (or `step_1`, `Step 1`)       | Image  | Likely multi-step sequence → ask trigger type before deciding      |
| Filenames like `mobile`, `tablet`, `desktop`                              | Image  | Responsive views of ONE state → generate media queries, not states |
| `devBrief` mentions state words: "step", "state", "phase", "screen"       | Brief  | Parse state names from text → ask trigger type                     |
| Multiple images provided (not clearly responsive)                         | Input  | Frames are visual references for this component → ask trigger type |

**Trigger type question (mandatory before any state-aware code is generated):**

When multiple states or frames are detected — regardless of source — always ask the developer:

> "These screenshots show different visual states of the component. How are they triggered?"
>
> 1. **CSS-only** — hover, focus, transition, or animation; no JavaScript needed
> 2. **JS-driven** — click, scroll, timer, or external event; JavaScript manages state transitions
> 3. **Visual reference only** — these images just show the full design; generate a single CSS implementation that covers all the visual rules, no state logic

Do NOT assume a trigger type from filenames alone. A file named `hover.png` might still be JS-triggered; a file named `expanded.png` might be a pure CSS transition. Only the developer knows.

**Generating based on the answer:**

| Answer                | What to generate                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CSS-only              | Standard `.ts` (CSS-only template) + CSS with pseudo-class rules and/or transition blocks per visual frame              |
| JS-driven             | TS with `block.dataset.state` transitions + CSS `[data-state]` selectors                                                |
| Visual reference only | Standard `.ts` (CSS-only template) + comprehensive CSS that incorporates visual details from all frames; no state logic |

If >3 JS-driven states are selected, additionally ask: "This will generate code for N states. Are you sure, or would you like to reduce the list?"

**CSS pseudo-class states (`:hover`, `:focus-visible`, `:disabled`):**

- These are the only states that can be confirmed as CSS-only without asking — they are structurally tied to browser events, not JS.
- All other state names require trigger type confirmation.

---

## Step 3 — Present the plan and get approval (MANDATORY GATE)

**Do NOT generate, write, or scaffold any files until the developer has explicitly approved the plan.** This is a hard stop. Analysis (Step 2) produces a proposal; this step turns it into an agreed plan.

Present the plan using the **AskUserQuestion tool** (so approval is an explicit choice, not an inferred "ok"). The plan must cover:

> ## 📋 Block plan: `<block-name>`
>
> **Source:** \<N screenshot(s): filenames you actually viewed\>
> **Structure:** \<Simple model / Container+filter\> — \<one-line reason from the visual signal\>
> **Files to be created:**
>
> - `src/blocks/<block-name>/<block-name>.ts`
> - `src/blocks/<block-name>/<block-name>.css`
> - `src/blocks/<block-name>/_<block-name>.json`
>
> **Fields (max 4):**
>
> | Field | Component | Editable content |
> | ----- | --------- | ---------------- |
> | \<name\> | \<component\> | \<what the author edits\> |
>
> **States / interactions:** \<None / confirmed trigger type + state list\>
> **Design tokens:** \<tokens to be used; list any unmatched colours needing a decision\>
> **Registration:** add `<block-name>` to `src/models/_section.json` while preserving the existing component order, then `npm run build:json`
> **Brief:** \<first 100 chars of devBrief, if provided\>

Then ask, via **AskUserQuestion**:

> "Here's my plan for `<block-name>`. Shall I go ahead and build it, or adjust anything first?"
>
> - **Approve & build** — generate all files as described
> - **Adjust** — change fields, structure, states, or tokens (developer specifies what)
> - **Cancel** — do not create anything

**Rules for this gate:**

- If the developer picks **Adjust**, revise the plan and present it again — re-confirm before building. Loop until approved or cancelled.
- If any Step 2 question is still unresolved (structure ambiguous, >4 fields, trigger type unknown, unmatched colours), fold it into this plan and resolve it here **before** asking for final approval.
- Only after an explicit **Approve & build** may you proceed to Step 4.
- When invoked by another agent (non-interactive), treat a passed-in `autoApprove: true` argument as approval; otherwise still surface the plan in the returned result and stop.

---

## Step 4 — Generate files

Build the contents of the three files from the **approved** Step 3 plan using the templates below. (Persisting them to disk happens in Step 5.)

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

### `<block-name>.ts`

CSS-only (default — use unless design requires DOM restructuring):

```typescript
export default function decorate(_block: HTMLElement): void {
  // <Block Title> block — decoration handled via CSS
}
```

DOM-restructuring (async, imports `moveInstrumentation`):

```typescript
import { moveInstrumentation } from '@/app/scripts.js';

export default async function decorate(block: HTMLElement): Promise<void> {
  const rows = [...block.querySelectorAll<HTMLElement>(':scope > div')];
  rows.forEach((row) => {
    const cells = [...row.querySelectorAll<HTMLElement>(':scope > div')];
    // restructure cells into semantic elements
    // call moveInstrumentation(source, target) when moving AEM-instrumented nodes
    // call block.replaceChildren(...newElements) once at the end
  });
}
```

With images (imports `createOptimizedPicture`):

```typescript
import { createOptimizedPicture } from '@/app/aem.js';
import { moveInstrumentation } from '@/app/scripts.js';

export default async function decorate(block: HTMLElement): Promise<void> {
  const pictures = [...block.querySelectorAll<HTMLPictureElement>('picture')];
  pictures.forEach((pic) => {
    const img = pic.querySelector<HTMLImageElement>('img');
    if (!img) return;
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(pic, optimized);
    pic.replaceWith(optimized);
  });
}
```

JS-driven states (use when multi-state is confirmed — `data-state` attribute pattern):

```typescript
export default async function decorate(block: HTMLElement): Promise<void> {
  // Build DOM, then call block.replaceChildren(...) once

  // Set initial state
  block.dataset.state = 'default';

  // Example: toggle to expanded on button click
  const trigger = block.querySelector<HTMLButtonElement>('.\<block-name\>-trigger');
  trigger?.addEventListener('click', () => {
    const current = block.dataset.state;
    block.dataset.state = current === 'expanded' ? 'default' : 'expanded';
  });
}
```

Multi-step sequence (use when `step-N` states are confirmed):

```typescript
export default async function decorate(block: HTMLElement): Promise<void> {
  // Build DOM, then call block.replaceChildren(...) once

  const totalSteps = 3; // replace with actual count
  let currentStep = 1;

  function goToStep(n: number): void {
    if (n < 1 || n > totalSteps) return;
    currentStep = n;
    block.dataset.step = String(n);
  }

  goToStep(1); // initialise

  block.querySelector<HTMLButtonElement>('.\<block-name\>-next')?.addEventListener('click', () => {
    goToStep(currentStep + 1);
  });
  block.querySelector<HTMLButtonElement>('.\<block-name\>-prev')?.addEventListener('click', () => {
    goToStep(currentStep - 1);
  });
}
```

### `<block-name>.css`

```css
/* <block-name> block */
.<block-name> {
    /* container styles */
}

.<block-name>-item {
    /* item styles */
}

.<block-name>-image {
    width: 100%;
}

.<block-name>-image img {
    width: 100%;
    height: auto;
    object-fit: cover;
}

.<block-name>-body {
    color: var(--text-color);
    background-color: var(--background-color);
}

@media (width >= 768px) {
    .<block-name> {
    /* tablet overrides */
  }
}

@media (width >= 1200px) {
  .<block-name> {
    /* desktop overrides */
    }
}
```

JS-driven state selectors (append when multi-state is confirmed):

```css
/* <block-name> — JS-driven states */
.<block-name>[data-state='default'] {
    /* default state styles */
}

.<block-name>[data-state='loading'] {
    /* loading state styles */
}

.<block-name>[data-state='expanded'] {
    /* expanded state styles */
}
```

Multi-step sequence selectors (append when step-N states are confirmed):

```css
/* <block-name> — step states */
.<block-name>[data-step] .<block-name>-panel {
    display: none;
}

.<block-name>[data-step='1'] .<block-name>-panel:nth-child(1),
.<block-name>[data-step='2'] .<block-name>-panel:nth-child(2) {
    display: block;
}

/* Extend for each additional step */
```

CSS rules:

- BEM-adjacent naming: `.<block-name>`, `.<block-name>-<element>`, `.<block-name>-<element>--<modifier>`
- Use `var(--token-name)` for colours, typography, and shared design-system values where available; avoid hardcoded sampled colours (see Step 2 token inference)
- Modern range media queries using current project breakpoints: `@media (width >= 768px)` and `@media (width >= 1200px)`
- 4-space indentation
- No nested selectors — keep flat

---

## Step 5 — Write files

The plan was already approved in Step 3, so write all three files now, exactly as agreed. If you discover mid-write that reality diverges from the approved plan (e.g., a field can't be modelled as planned), stop and re-confirm the change before continuing.

Write all three files. When invoked by another agent, return:

```json
{
  "blockName": "<block-name>",
  "files": [
    "src/blocks/<block-name>/<block-name>.ts",
    "src/blocks/<block-name>/<block-name>.css",
    "src/blocks/<block-name>/_<block-name>.json"
  ]
}
```

---

## Step 6 — Register block in AEM

### 6a. Add block to section filter

Open `src/models/_section.json` and add `"<block-name>"` to the `filters[0].components` array while preserving the existing grouping/order. This makes the block insertable in the Universal Editor.

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

## Step 7 — Verify lint and build

Run lint first, then the full Vite build to confirm the new block follows repo rules and compiles without errors:

```bash
npm run lint
```

Then:

```bash
npm run build
```

- If lint **fails**: show the relevant lint error, fix it in the generated files, and re-run `npm run lint`.
- If the build **passes**: confirm to the developer that the block compiled successfully and output is at `blocks/<block-name>/<block-name>.js`
- If the build **fails**: show the compiler error, identify the likely cause (type error, missing import, invalid CSS token), fix it in the generated files, and re-run `npm run build` until it passes
- Do NOT leave a failing build — fix all errors before finishing

When invoked by another agent, include the result:

```json
{ "blockName": "<block-name>", "files": [...], "sectionJsonUpdated": true, "jsonRegenerated": true, "buildPassed": true }
```

---

## Step 8 — Generate content entry prompt

After Step 7 passes (or after Step 6 when invoked by another agent that skips the build), generate a ready-to-copy prompt the developer can give to any AEM AI assistant to enter realistic demo content that matches the screenshot.

### Demo value rules per field type

| Field `component`    | How to derive demo value                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`               | Read the visible text from the screenshot; if illegible, write a short, on-brand placeholder (≤ 80 chars) that matches the tone and length visible in the design                                                  |
| `richtext`           | Read the body copy from the screenshot; if illegible, write 1–2 sentences of realistic hotel/luxury-lifestyle copy matching the apparent length of the text area                                                  |
| `reference` (image)  | Describe the pictured asset in natural language ("a luxury hotel lobby at dusk, warm lighting") and suggest a placeholder DAM path: `/content/dam/<block-name>/<field-name>.jpg` — note it must be replaced        |
| `aem-content` (link) | Use a plausible internal path from the visible button label (label → slug) or fall back to `/en/<block-name>`                                                                                                     |
| `boolean`            | Set to the value shown in the primary/first screenshot                                                                                                                                                            |
| `select`             | Set to the variant value that matches the screenshot being implemented                                                                                                                                           |

**For container+filter blocks:** generate demo entries for **3 items** (or as many as are visible in the screenshot, up to 3) to show meaningful variety. Vary the copy and image descriptions across items.

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
   > "Save all fields. The content should match the screenshot."

After the code block, add this note on its own line:

> _Copy this prompt and paste it into the AEM Copilot chat (or hand it to your AEM AI) to populate realistic demo content._

### Agent return value

When invoked by another agent, include in the returned JSON:

```json
{ "blockName": "<block-name>", "files": [...], "sectionJsonUpdated": true, "jsonRegenerated": true, "buildPassed": true, "contentPromptGenerated": true }
```

---

## Optional Next Steps

After the block builds successfully, these skills are available if needed:

- **`testing-blocks`** — validate the block in a real browser (lint, responsive check, screenshot). Especially useful here: compare the rendered block against the source screenshot at each viewport.
- **`code-review`** — self-review before opening a PR (TypeScript patterns, CSS scoping, security)

These are optional — invoke them if the developer asks or if the block is complex enough to warrant it.

---

## Guardrails

- No viewable screenshot → ask for one; never invent a design
- **Image on disk is not viewable** → a path/folder only proves a file exists; if you cannot render it as an attachment, `list_dir` it and ask the developer to drag the files into chat before analysing
- **Never analyse from filenames/folder/brief alone** → structure, fields, and styles must come from an image you can actually see
- **Plan gate is mandatory** → present the plan (Step 3) and get an explicit **Approve & build** via AskUserQuestion before writing any file; loop on **Adjust**, honour **Cancel**
- Block folder exists → ask before overwriting
- Ambiguous structure → resolve in the plan before asking for approval
- > 4 fields → resolve in the plan before asking for approval
- Multi-state images detected → always ask trigger type (CSS-only / JS-driven / visual reference) before generating
- `mobile`/`tablet`/`desktop` images → responsive views of one state, NOT separate states → generate media queries
- Never assume trigger type from filenames alone — a `hover` image could be JS-triggered
- > 3 JS-driven states confirmed → ask developer to confirm or reduce list before generating
- Trigger type not confirmed → fall back to CSS-only template, no state logic generated
- Block name not kebab-case → auto-convert and confirm
- CSS pseudo-class states (`:hover`, `:focus`) → only exception that is always CSS-only without asking
- No hardcoded sampled colours in CSS → map to `var(--token-name)`; surface unmatched colours in the Step 3 plan instead of inlining
- No relative `../../` imports → use `@/` alias
- No `innerHTML =` → use `replaceChildren()`
- Generated code must pass `npm run lint` and `npm run build`
