/**
 * dm-presets.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Central registry of all DM Smart Crop preset configurations for this EDS site.
 *
 * PRESET NAMES:
 *   All preset names follow the convention "de{width}x{height}" (de = delivery).
 *   e.g. de1440x600 = 1440px wide, 600px tall.
 *
 *   These names MUST exactly match the Smart Crop preset names defined in the
 *   AEM Image Profile (Tools → Assets → Image Profiles → Smart Crop rows).
 *
 * IMAGE PROFILE SETUP (one-time, in AEM Admin):
 *   ┌──────────────────┬───────┬────────┐
 *   │ Preset Name      │ Width │ Height │
 *   ├──────────────────┼───────┼────────┤
 *   │ de1920x600       │ 1920  │ 600    │ ← full-width banner desktop
 *   │ de1440x600       │ 1440  │ 600    │ ← hero / wide desktop
 *   │ de1440x810       │ 1440  │ 810    │ ← 16:9 wide desktop
 *   │ de768x480        │ 768   │ 480    │ ← tablet / medium landscape
 *   │ de768x960        │ 768   │ 960    │ ← tall tablet portrait
 *   │ de600x400        │ 600   │ 400    │ ← card desktop landscape
 *   │ de600x750        │ 600   │ 750    │ ← card desktop portrait
 *   │ de480x320        │ 480   │ 320    │ ← mobile landscape
 *   │ de480x600        │ 480   │ 600    │ ← mobile portrait
 *   │ de400x500        │ 400   │ 500    │ ← mobile tall portrait
 *   │ de390x280        │ 390   │ 280    │ ← small mobile landscape
 *   │ de300x300        │ 300   │ 300    │ ← square thumbnail
 *   └──────────────────┴───────┴────────┘
 *   Apply profile to DAM root → "Apply to subfolders" → done forever.
 *
 * STRUCTURE:
 *   Each block key maps to one or more named image SLOTS.
 *   Each slot has a desktop and mobile preset name.
 *
 *   DM_BLOCK_PRESETS = {
 *     [blockKey]: {
 *       [slotKey]: {
 *         desktop: 'de{w}x{h}',   ← used when viewport >= 768px
 *         mobile:  'de{w}x{h}',   ← used when viewport < 768px
 *       }
 *     }
 *   }
 *
 * HOW TO ADD A NEW BLOCK:
 *   1. Add a new key below (e.g. 'my-block')
 *   2. Define one or more slots with desktop + mobile preset names
 *   3. In blocks/my-block/my-block.js, call:
 *        buildResponsivePicture(url, alt, 'my-block', 'image')
 *   4. If the preset names already exist in the Image Profile → zero AEM work
 *      If you need a new crop size → add one row to the Image Profile
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DM_BLOCK_PRESETS = {
  // ── DM SHOWCASE ─────────────────────────────────────────────────────────────
  // Test block: single image + text. Used to validate the DM pipeline.
  // Single slot — author provides one landscape or portrait image.
  'dm-showcase': {
    image: {
      desktop: 'de768x480', // 768×480 — half-width desktop (sits beside text)
      mobile: 'de480x320', // 480×320 — full-width mobile
    },
  },

  // ── DM EDITORIAL ────────────────────────────────────────────────────────────
  // Two-image editorial block:
  //   - imageHorizontal: wide landscape image with short text (top section)
  //   - imageVertical:   tall portrait image with text (bottom section)
  // Each slot has independent desktop + mobile presets.
  'dm-editorial': {
    imageHorizontal: {
      desktop: 'de1440x600', // 1440×600 — wide landscape for desktop
      mobile: 'de480x320', // 480×320  — landscape crop for mobile
    },
    imageVertical: {
      desktop: 'de600x750', // 600×750  — portrait card on desktop
      mobile: 'de480x600', // 480×600  — portrait crop for mobile
    },
  },
};

export default DM_BLOCK_PRESETS;
