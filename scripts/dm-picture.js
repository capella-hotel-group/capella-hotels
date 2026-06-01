// scripts/dm-picture.js
// ─────────────────────────────────────────────────────────────
// Generic engine. Zero knowledge of specific presets or blocks.
// Blocks call buildResponsivePicture() — that's the only export
// they ever need.
// ─────────────────────────────────────────────────────────────

import { DM_BLOCK_PRESETS } from './dm-presets.js';

// ── STEP A: Detect orientation ────────────────────────────────
//
// DM with OpenAPI exposes asset metadata at:
//   /adobe/assets/{assetId}?api-key=...
//
// For Scene7 URLs the equivalent is:
//   ?req=imageinfo&fmt=json
//
// This function handles both URL shapes automatically.

async function detectOrientation(dmUrl) {
  try {
    let width = 0;
    let height = 0;

    if (dmUrl.includes('/adobe/assets/')) {
      // ── DM with OpenAPI (modern, recommended) ──
      // The metadata endpoint uses the same base URL with
      // ?representation=metadata appended
      const metaUrl = `${dmUrl.split('?')[0]}?representation=metadata`;
      const resp = await fetch(metaUrl);
      const data = await resp.json();
      width  = data?.assetMetadata?.['tiff:ImageWidth']  || 0;
      height = data?.assetMetadata?.['tiff:ImageLength'] || 0;

    } else if (dmUrl.includes('/is/image/')) {
      // ── Scene7 / legacy DM ──
      const infoUrl = `${dmUrl.split('?')[0]}?req=imageinfo&fmt=json`;
      const resp = await fetch(infoUrl);
      const data = await resp.json();
      width  = data?.imageInfo?.width  || 0;
      height = data?.imageInfo?.height || 0;
    }

    return width >= height ? 'landscape' : 'portrait';

  } catch {
    // Safe fallback — landscape is the most common hero orientation
    return 'landscape';
  }
}

// ── STEP B: Build a DM delivery URL with a smart crop preset ─
//
// DM with OpenAPI:  baseUrl?smartcrop=heroLandscapeDesktop
// Scene7 (legacy):  baseUrl?$heroLandscapeDesktop$
//
// The function detects which format to use from the URL itself.

function applyPreset(baseUrl, presetName) {
  const clean = baseUrl.split('?')[0]; // strip any existing params

  if (clean.includes('/adobe/assets/')) {
    // DM with OpenAPI — use ?smartcrop= parameter
    return `${clean}?smartcrop=${presetName}`;
  }
  // Scene7 — use $presetName$ syntax
  return `${clean}?$${presetName}$`;
}

// ── STEP C: The only function blocks need to call ─────────────
//
// Reads the preset config for this block + orientation,
// then builds and returns a <picture> element.
//
// @param {string} dmUrl    - Raw DM asset URL from the DOM
// @param {string} altText  - Alt text for the <img>
// @param {string} blockKey - Must match a key in DM_BLOCK_PRESETS
// @returns {Promise<HTMLPictureElement|null>}

export async function buildResponsivePicture(dmUrl, altText, blockKey) {
  // 1. Look up the preset config for this block
  const blockConfig = DM_BLOCK_PRESETS[blockKey];
  if (!blockConfig) {
    console.error(`[dm-picture] No preset config for block key: "${blockKey}"`);
    return null;
  }

  // 2. Detect orientation from the asset's actual dimensions
  const orientation = await detectOrientation(dmUrl);

  // 3. Pick landscape or portrait sources
  const { sources } = blockConfig[orientation];

  // 4. Build the <picture> element
  const picture = document.createElement('picture');

  // The last source entry (no media attribute) becomes the <img>.
  // All others become <source> elements.
  sources.forEach((entry, index) => {
    const isLast = index === sources.length - 1;
    const url    = applyPreset(dmUrl, entry.preset);

    if (isLast) {
      // ── <img> fallback ──
      const img = document.createElement('img');
      img.src      = url;
      img.alt      = altText || '';
      img.loading  = 'lazy';
      img.decoding = 'async';
      picture.appendChild(img);
    } else {
      // ── <source> for this breakpoint ──
      const source = document.createElement('source');
      source.media  = entry.media;
      source.srcset = url;
      picture.appendChild(source);
    }
  });

  return picture;
}