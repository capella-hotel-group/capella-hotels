---
mode: agent
description: Scaffold a complete AEM EDS xwalk block from a Figma design using the aem-skill-create-block-from-figma-without-mcp skill.
---

# Create AEM block from Figma

Invoke the **`aem-skill-create-block-from-figma-without-mcp`** skill
(`.github/skills/aem-skill-create-block-from-figma-without-mcp/SKILL.md`)
to scaffold a complete AEM EDS xwalk block.

## Inputs

- **Block name** (kebab-case): `${input:blockName:e.g. hero-banner}`
- **Figma URL**: `${input:figmaUrl:https://www.figma.com/design/...}`
- **Figma Access Token** (optional): `${input:figmaToken:figd_xxxxxxxxxxxxxxxxx}`
- **Description** (optional brief): `${input:description:interactions, states, a11y notes...}`

## Instructions

Follow every step in the skill exactly:

1. Parse and validate the block name and Figma URL; convert to kebab-case and confirm.
2. Analyse the Figma node — detect structure type, map fields (max 4), and detect states.
3. **Check for block screenshots and image references** — Before generating the block, check whether a `screenshots/<block-name>/` folder exists. If present, inspect the available screenshots/images and use them as visual references when mapping the Figma design to the EDS block. If no matching folder exists, continue without blocking the implementation.
4. If multiple states/frames are detected, **ask the trigger type** (CSS-only / JS-driven / visual reference) before generating any state-aware code.
5. **Present a concise implementation plan** that summarizes:
   - the detected block structure and key elements
   - any identified states and their implementation approach
   - the files that will be generated
   - any assumptions or clarifications required
6. **Wait for explicit user approval before generating any files.**
7. Generate the three files at `blocks/<block-name>/`:
   - `<block-name>.js`
   - `<block-name>.css`
   - `_<block-name>.json`
8. Register the block: add it to `models/_section.json` (alphabetical) and run `npm run build:json`.
9. Run `npm run lint` and fix any errors until it passes.
10. Output the ready-to-copy **content entry prompt** for AEM Copilot.