## Why

Header and footer currently only load their fragment from metadata (`getMetadata('nav')` / `getMetadata('footer')`). If an author does not set the meta tag on a page, or if the fragment fetch fails, the header/footer will be completely hidden. An automatic fallback mechanism is needed that correctly computes the path — including the site segment (`global`, `bangkok`, `sanya`) and the raw lang segment from the URL (`jp`, `zh-cn`, `ar`) — to ensure the header/footer always renders correctly.

## What Changes

- **`blocks/header/header.js`**: After Option 1 (metadata path) returns `null`, automatically parse the URL to get the site segment and lang segment, build a fallback path, and attempt to load again.
- **`blocks/footer/footer.js`**: Same — add the same fallback logic.
- **Emblem href**: Also use the URL-parsed lang segment as a fallback instead of hardcoding `/`.
- Fallback path rule: `/{site}/{lang}/nav`, or `/{site}/nav` if `en`, or `/{lang}/nav` if no site.
- Lang segment is taken **raw from the URL** (not via `html[lang]`) to avoid alias normalization (`jp→ja`, `zh-cn→zh-CN`).

## Capabilities

### New Capabilities

- `header-footer-lang-fallback`: Automatic fallback mechanism that computes nav/footer/emblem paths from the site segment + raw lang segment in the URL when metadata is absent or the fragment fetch fails.

### Modified Capabilities

- `header-nav-zones`: Changes how the header resolves the nav path and emblem href — adds fallback, does not change layout or zone requirements.

## Impact

- `blocks/header/header.js` — adds URL parsing helper + fallback logic in `decorate()`
- `blocks/footer/footer.js` — adds fallback logic in `decorate()`
- No changes to `scripts/scripts.js`, `fragment.js`, or any CSS
- Non-breaking — Option 1 still runs first; fallback only activates when needed
