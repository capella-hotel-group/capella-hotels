## Purpose

Runtime language detection and RTL direction setup in `scripts/scripts.js`. Ensures `lang` and `dir` attributes are correctly set on `<html>` before any block decoration occurs.

## Requirements

### Requirement: Lang detection from URL path
The system SHALL detect the page language from the URL path segment and set it on `document.documentElement.lang` before any block decoration occurs.

#### Scenario: Lang segment present in URL
- **WHEN** the URL path contains a BCP 47 language segment (e.g. `/global/ar/page`)
- **THEN** `document.documentElement.lang` SHALL be set to that segment (e.g. `"ar"`)

#### Scenario: No lang segment in URL
- **WHEN** the URL path contains no recognizable language segment
- **THEN** `document.documentElement.lang` SHALL default to `"en"`

#### Scenario: Global segment is skipped
- **WHEN** the URL path contains `"global"` followed by a lang segment (e.g. `/global/ar/`)
- **THEN** `"global"` SHALL NOT be treated as the lang — the next segment SHALL be used

---

### Requirement: RTL direction applied before decoration
The system SHALL set `dir="rtl"` on `document.documentElement` and add `is-rtl` to `document.body.classList` for RTL languages, before `decorateTemplateAndTheme()` is called.

#### Scenario: Arabic page loads
- **WHEN** the detected lang is `"ar"` (or any RTL lang: `he`, `fa`, `ur`)
- **THEN** `<html dir="rtl">` SHALL be present in the DOM before any block CSS is applied
- **THEN** `document.body` SHALL have class `is-rtl`

#### Scenario: Non-RTL page loads
- **WHEN** the detected lang is `"en"`, `"zh-cn"`, `"jp"`, or any non-RTL lang
- **THEN** `dir` attribute SHALL NOT be set on `<html>`
- **THEN** `document.body` SHALL NOT have class `is-rtl`

#### Scenario: Order of execution
- **WHEN** `loadEager()` runs
- **THEN** lang detection and `applyDirection()` SHALL execute before `decorateTemplateAndTheme()` and `decorateMain()`
