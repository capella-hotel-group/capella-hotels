// scripts/dm-presets.js
// ─────────────────────────────────────────────────────────────
// Central registry of all DM Smart Crop preset configurations.
//
// HOW TO READ THIS FILE:
//   - Each top-level key is a block name (e.g. 'hero', 'banner')
//   - Inside each block, keys are orientation variants:
//       'landscape' — image is wider than tall
//       'portrait'  — image is taller than wide
//   - Inside each orientation, 'sources' is an ordered list of
//     <source> entries for the <picture> tag.
//     The LAST entry becomes the <img> fallback (mobile/default).
//
// HOW TO ADD A NEW BLOCK:
//   1. Add a new key here (e.g. 'card')
//   2. Define landscape and portrait sources
//   3. In blocks/card/card.js, call buildResponsivePicture(url, alt, 'card')
//   That's it. No other file needs to change.
// ─────────────────────────────────────────────────────────────

const DM_BLOCK_PRESETS = {

  'dm-showcase': {
    landscape: {
      sources: [
        { media: '(min-width: 1024px)', preset: 'dmShowcaseLandscapeDesktop' },
        { media: '(min-width: 600px)', preset: 'dmShowcaseLandscapeTablet' },
        { preset: 'dmShowcaseLandscapeMobile' },
      ],
    },
    portrait: {
      sources: [
        { media: '(min-width: 768px)', preset: 'dmShowcasePortraitDesktop' },
        { preset: 'dmShowcasePortraitMobile' },
      ],
    },
  },
  // Add more blocks below — copy the pattern above
};
export default DM_BLOCK_PRESETS;
