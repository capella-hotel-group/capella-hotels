## ADDED Requirements

### Requirement: URL-based site and lang segment extraction
The system SHALL extract site segment and raw lang segment directly from `window.location.pathname` to build fallback paths. Site segment is the first pathname segment matching `supportedSites`. Lang segment is the next segment that matches `VALID_LANG_PRIMARIES` or `LANG_MAP` keys. English (`en`) produces no lang segment in the path.

#### Scenario: Site and lang both present
- **WHEN** URL is `/global/ar/some-page`
- **THEN** system SHALL extract site=`global`, lang=`ar`, building path `/global/ar/nav`

#### Scenario: Site present, English (no lang segment)
- **WHEN** URL is `/bangkok/some-page`
- **THEN** system SHALL extract site=`bangkok`, lang=`en`, building path `/bangkok/nav`

#### Scenario: Lang alias slug (jp)
- **WHEN** URL is `/global/jp/some-page`
- **THEN** system SHALL extract raw slug `jp` and build path `/global/jp/nav` (NOT `/global/ja/nav`)

#### Scenario: No site segment
- **WHEN** URL is `/ar/some-page`
- **THEN** system SHALL extract site=`''`, lang=`ar`, building path `/ar/nav`

#### Scenario: No site, no lang (English root)
- **WHEN** URL is `/some-page`
- **THEN** system SHALL build path `/nav`

### Requirement: Header nav fallback path
When `getMetadata('nav')` returns no value or `loadFragment(metadataPath)` returns `null`, header SHALL attempt `loadFragment(fallbackPath)` where `fallbackPath` is computed from URL site + lang segments.

#### Scenario: Metadata absent — uses URL-based fallback
- **WHEN** `getMetadata('nav')` returns a falsy value
- **THEN** header SHALL attempt `loadFragment` with path built from URL segments

#### Scenario: Metadata fetch fails — uses URL-based fallback
- **WHEN** `loadFragment(metadataPath)` returns `null`
- **THEN** header SHALL attempt `loadFragment(fallbackPath)` from URL segments

#### Scenario: Both options fail — header hides
- **WHEN** both metadata path and fallback path return `null`
- **THEN** header SHALL hide (existing behavior preserved)

### Requirement: Footer nav fallback path
When `getMetadata('footer')` returns no value or `loadFragment(metadataPath)` returns `null`, footer SHALL attempt `loadFragment(fallbackPath)` built from URL site + lang segments.

#### Scenario: Metadata absent — footer uses URL-based fallback
- **WHEN** `getMetadata('footer')` returns a falsy value
- **THEN** footer SHALL attempt `loadFragment` with path built from URL segments

#### Scenario: Both options fail — footer exits silently
- **WHEN** both metadata path and fallback path return `null`
- **THEN** footer SHALL return without rendering (existing behavior preserved)

### Requirement: Emblem href lang fallback
When no language href in `langList` matches the current path via `startsWith`, the emblem `<a>` href SHALL fall back to the URL-derived lang root (`/{site}/{lang}/` or `/{lang}/` or `/`).

#### Scenario: langList match fails due to path prefix
- **WHEN** current URL is `/global/ar/some-page` and langList hrefs are `/ar/`
- **THEN** emblem SHALL link to `/global/ar/` (URL-derived), not `/`
