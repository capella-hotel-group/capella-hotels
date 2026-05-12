## Context

13 archived change artifacts were authored in Vietnamese during initial development. The `openspec/specs/` canonical layer is already in English. Only the per-change artifacts (`proposal.md`, `design.md`, `tasks.md`) inside `openspec/changes/archive/` contain Vietnamese text.

No code changes. Translation is in-place — each file is rewritten in English with identical structure and technical content.

## Goals / Non-Goals

**Goals:**
- All OpenSpec markdown files written in English
- Technical accuracy preserved exactly — all code blocks, decision rationale, file paths, and requirement names unchanged
- Markdown structure (headers, lists, tables, checkboxes) unchanged

**Non-Goals:**
- No rewording of technical decisions — translate meaning, not intent
- No changes to `openspec/specs/` (already English)
- No changes to any source code files
- No changes to archived spec files within each change folder (already English)

## Decisions

### Translate in-place, no file moves

Each of the 13 files is edited directly. No files are renamed, moved, or deleted. Archive folder structure stays intact.

### Translate prose only, leave code blocks and identifiers verbatim

Code snippets, file paths, CSS selectors, JS function names, and requirement identifiers are not translated — only surrounding prose and comments in natural language.

## Risks / Trade-offs

- **[Risk] Subtle mistranslation of technical reasoning** → Mitigation: original Vietnamese source files can be recovered from git history if needed.
- **[Trade-off] Archived changes will differ from their original authoring language** → Acceptable: consistency and team accessibility outweigh historical authenticity.
