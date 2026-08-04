---
mode: agent
description: Scaffold an AEM EDS xwalk block from a screenshot without Figma
---

<!-- Developer-facing slash command — delegates to the `aem-skill-create-block-from-screenshot` skill -->

Create an AEM EDS xwalk block from a screenshot of the design.

---

**Input**: `/aem-create-block-from-screenshot <block-name> <screenshot> [description]`

`<block-name>` is required and must be kebab-case. `<screenshot>` is one or more image attachments, a single image path, or a folder path under `.github/screenshots/` (e.g., `.github/screenshots/<block-name>`). `[description]` is optional free text — use it to describe interactions, states, responsive behaviour, animation timing, or which parts are author-editable that a static image cannot convey.

---

## Step 1 — Parse inputs

**Block name:**

- If no name is provided, use the **AskUserQuestion tool** to ask for it.
- Convert to kebab-case if needed (e.g., "My Hero Section" → `my-hero-section`). Confirm with the developer before proceeding.

**Screenshot:**

- Accept image(s) attached directly in chat, a single image path, or a folder under `.github/screenshots/`.
- **A path or folder is not viewable on its own.** If given a folder/path, enumerate it with `list_dir`, report the filenames, and — if you cannot render the images — ask the developer to **drag them into the chat** so they become viewable attachments.
- If none is provided, ask with **AskUserQuestion** and point the developer at `.github/screenshots/README.md` for the folder convention.
- Do NOT proceed without a viewable image — never invent a design, and never analyse from filenames or the folder name alone.

**Description (optional):**

- If present, pass as-is to the skill. Do NOT ask for it unless the developer has not provided a screenshot either.

---

## Step 2 — Invoke the skill

Use the **aem-skill-create-block-from-screenshot** skill with the parsed inputs:

- `blockName`: the kebab-case block name
- `screenshots`: the attached image(s) or resolved path/folder
- `description`: the optional developer brief (omit if not provided)

The skill handles all workflow steps: screenshot analysis, structure/field detection, design-token mapping, state confirmation, **a mandatory plan-approval gate (it presents the block plan and waits for your explicit go-ahead before creating any files)**, file generation, AEM registration, build verification, and — at the very end — a ready-to-copy **content entry prompt** the developer can paste into AEM Copilot chat to populate realistic demo content matching the screenshot.
