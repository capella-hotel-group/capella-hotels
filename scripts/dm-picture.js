/**
 * dm-picture.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generic Dynamic Media picture builder for EDS (Edge Delivery Services).
 *
 * RESPONSIBILITIES:
 *   - Build a <picture> element with desktop + mobile <source> / <img> tags
 *   - Apply the correct DM Smart Crop preset per breakpoint
 *   - Support both DM with OpenAPI (modern) and Scene7 (legacy) URL formats
 *
 * WHAT THIS FILE DOES NOT DO:
 *   - It has zero knowledge of specific blocks or preset names
 *   - It does not fetch images or do any network calls
 *   - It does not detect orientation (removed — author controls this via image choice)
 *
 * HOW BLOCKS USE THIS:
 *   import buildResponsivePicture from '../../scripts/dm-picture.js';
 *   const picture = await buildResponsivePicture(dmUrl, altText, 'hero', 'image');
 *
 * ADDING A NEW BLOCK:
 *   1. Add the block key + slot config in scripts/dm-presets.js
 *   2. Call buildResponsivePicture() in your block JS with the right blockKey + slotKey
 *   3. No changes needed here
 * ─────────────────────────────────────────────────────────────────────────────
 */

import DM_BLOCK_PRESETS from './dm-presets.js';

// ── URL BUILDER ───────────────────────────────────────────────────────────────
//
// Appends the Smart Crop preset name to the base DM asset URL.
//
// DM with OpenAPI format:
//   https://delivery-pXXX-eYYY.adobeaemcloud.com/adobe/assets/urn:aaid:aem:xxx/name.jpg
//   → appends: ?smartcrop=de1440x600
//
// Scene7 / legacy DM format:
//   https://company.scene7.com/is/image/Company/asset-name
//   → appends: ?$de1440x600$
//
// Detection is automatic based on the URL shape.

function buildUrl(baseUrl, presetName) {
  // Strip any existing query params to avoid conflicts
  const clean = baseUrl.split('?')[0];

  if (clean.includes('/adobe/assets/')) {
    // DM with OpenAPI — uses ?smartcrop= parameter
    return `${clean}?smartcrop=${presetName}`;
  }

  // Scene7 / legacy DM — uses $presetName$ syntax
  return `${clean}?$${presetName}$`;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
//
// Builds and returns a <picture> element for a given block + image slot.
//
// The <picture> contains:
//   <source media="(width >= 768px)" srcset="...desktop preset...">
//   <img src="...mobile preset..." alt="..." loading="lazy" decoding="async">
//
// @param {string} dmUrl    - Raw DM asset URL from the DOM (from <a href> or <img src>)
// @param {string} altText  - Accessible alt text for the <img> element
// @param {string} blockKey - Must match a top-level key in DM_BLOCK_PRESETS (e.g. 'hero')
// @param {string} slotKey  - Image slot within the block (default: 'image')
//                            Multi-image blocks use e.g. 'imageHorizontal', 'imageVertical'
// @returns {HTMLPictureElement|null} - Returns null if config is missing

export default function buildResponsivePicture(dmUrl, altText, blockKey, slotKey = 'image') {
  // ── 1. Look up block config ──────────────────────────────────────────────
  const blockConfig = DM_BLOCK_PRESETS[blockKey];
  if (!blockConfig) return null;

  // ── 2. Look up the specific image slot within the block ──────────────────
  // e.g. hero → image, dm-showcase → image, dm-editorial → imageHorizontal
  const slotConfig = blockConfig[slotKey];
  if (!slotConfig) return null;

  // ── 3. Build the <picture> element ───────────────────────────────────────
  const picture = document.createElement('picture');

  // Desktop <source> — served when viewport is 768px or wider
  const source = document.createElement('source');
  source.media = '(width >= 768px)';
  source.srcset = buildUrl(dmUrl, slotConfig.desktop);
  picture.appendChild(source);

  // Mobile <img> — default fallback for viewports below 768px
  // Also serves as the canonical img element for SEO and accessibility
  const img = document.createElement('img');
  img.src = buildUrl(dmUrl, slotConfig.mobile);
  img.alt = altText || '';
  img.loading = 'lazy';
  img.decoding = 'async';
  picture.appendChild(img);

  return picture;
}
