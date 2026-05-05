## Context

`styles/styles.css` defines two CSS custom properties for heading typography:
- `--heading-font-family: "Goudy Regular", serif;`
- `--heading-light-font-family: "Goudy Light", serif;`

Both fall back directly to the generic `serif` keyword. When Goudy fonts fail to load, browsers choose any serif font, leading to inconsistent rendering. Adding named fallbacks (`"Times"`, `"Times New Roman"`) before the generic keyword gives browsers better guidance and produces more predictable typography.

## Goals / Non-Goals

**Goals:**
- Add `"Times"` and `"Times New Roman"` as named fallback fonts in both heading CSS custom properties
- Improve cross-browser and cross-OS typography consistency when custom fonts are unavailable

**Non-Goals:**
- Changing which font files are loaded or how fonts are served
- Modifying any font-face declarations
- Altering any component-level font overrides

## Decisions

**Decision: Add both `"Times"` and `"Times New Roman"` as fallbacks**

`"Times"` is the standard name on macOS/Linux; `"Times New Roman"` is the standard name on Windows. Including both ensures the named fallback is resolved on all major platforms rather than silently skipping to the generic `serif`.

Alternatives considered:
- `"Georgia"` — rounder letterforms, less similar to Goudy's proportions
- Only `"Times New Roman"` — would not resolve on macOS/Linux without the alias

**Decision: No `@font-face` fallback descriptor**

The change is purely a CSS custom property value update. No font loading infrastructure changes are needed.

## Risks / Trade-offs

- [Risk] Slight visual difference on systems where `"Times"` renders differently than the previously chosen serif fallback → Mitigation: Times/Times New Roman is the canonical serif baseline; the change is a net improvement.

## Migration Plan

Single-file edit to `styles/styles.css`. No deployment steps beyond normal code deployment. Rollback by reverting the two variable values.
