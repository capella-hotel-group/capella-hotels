## MODIFIED Requirements

### Requirement: Lang detection from URL path
The system SHALL detect the page language from the URL path segment using a validated set of known ISO 639-1 language primaries (`VALID_LANG_PRIMARIES`), and set it on `document.documentElement.lang` before any block decoration occurs. URL alias mappings (`LANG_MAP`) are checked first for non-standard slugs.

#### Scenario: Lang segment present in URL — generic tag
- **WHEN** the URL path contains a bare language segment matching a known primary (e.g. `/ar/page`, `/en/page`)
- **THEN** `document.documentElement.lang` SHALL be set to that segment (e.g. `"ar"`, `"en"`)

#### Scenario: Lang segment present in URL — BCP 47 regional tag
- **WHEN** the URL path contains a BCP 47 regional tag in lowercase (e.g. `/ar-ma/page`, `/ur-in/page`, `/ar-sa/page`)
- **THEN** `document.documentElement.lang` SHALL be set to the normalized form with UPPERCASE region (e.g. `"ar-MA"`, `"ur-IN"`, `"ar-SA"`)

#### Scenario: Market code before lang segment — lang is picked correctly
- **WHEN** the URL path contains a market/country code followed by a lang segment (e.g. `/qa/ar/page`, `/sa/ar-MA/page`)
- **THEN** the market code (`"qa"`, `"sa"`) SHALL be skipped — it is not a valid language primary
- **THEN** `document.documentElement.lang` SHALL be set to the lang segment (`"ar"`, `"ar-MA"`)

#### Scenario: URL alias slug is mapped
- **WHEN** the URL path contains a Capella-specific alias (e.g. `/jp/page`, `/zh-cn/page`)
- **THEN** `document.documentElement.lang` SHALL be set to the BCP 47 canonical value (`"ja"`, `"zh-CN"`)

#### Scenario: No lang segment in URL
- **WHEN** the URL path contains no segment matching a known language primary or alias
- **THEN** `document.documentElement.lang` SHALL default to `"en"`

#### Scenario: Global segment is skipped
- **WHEN** the URL path contains `"global"` followed by a lang segment (e.g. `/global/ar/`)
- **THEN** `"global"` SHALL NOT be treated as the lang — the next valid segment SHALL be used
