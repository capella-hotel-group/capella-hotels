## Why

13 archived change artifacts (`proposal.md`, `design.md`, `tasks.md`) across 6 changes were written in Vietnamese, making them inaccessible to non-Vietnamese team members and inconsistent with the canonical `openspec/specs/` layer which is fully in English. All OpenSpec content should be in English for consistency, searchability, and team-wide readability.

## What Changes

- **Translate 13 files** in `openspec/changes/archive/` from Vietnamese to English, preserving all technical content, code snippets, and structure exactly.
- No spec-level requirements are changing — this is a documentation-only fix.
- No code changes.

Files to translate:

| Change | Files |
|---|---|
| `2026-05-05-header-layout-robustness` | `tasks.md` |
| `2026-05-06-add-rtl-arabic-support` | `proposal.md`, `design.md`, `tasks.md` |
| `2026-05-06-header-nav-dynamic-layout` | `tasks.md` |
| `2026-05-07-lang-detection-hardening` | `proposal.md`, `design.md` |
| `2026-05-11-header-footer-lang-fallback` | `proposal.md`, `design.md`, `tasks.md` |
| `2026-05-11-header-nav-authoring-resilience` | `proposal.md`, `design.md`, `tasks.md` |

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
<!-- none — no requirement changes, documentation only -->

## Impact

- `openspec/changes/archive/**` — 13 markdown files rewritten in English
- No code changes
- No spec changes
- No breaking changes
