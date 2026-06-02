/**
 * dm-editorial.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Editorial block with two independent image+text sections:
 *
 *   SECTION 1 — Horizontal (top)
 *     Wide landscape image spanning full width with short caption text overlay.
 *     DM slot: 'imageHorizontal' → de1440x600 (desktop) / de480x320 (mobile)
 *
 *   SECTION 2 — Vertical (bottom)
 *     Tall portrait image on the left, longer text content on the right.
 *     DM slot: 'imageVertical' → de600x750 (desktop) / de480x600 (mobile)
 *
 * AUTHORING TABLE (Universal Editor / Document):
 *   ┌─────────────────────────┬────────────────────────┐
 *   │ Row 1: Horizontal image │ Horizontal caption text │
 *   ├─────────────────────────┼────────────────────────┤
 *   │ Row 2: Vertical image   │ Vertical body text      │
 *   └─────────────────────────┴────────────────────────┘
 *
 * Each row is processed independently with its own DM preset slot.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import buildResponsivePicture from '../../scripts/dm-picture.js';

// ── Helper: extract DM URL + alt from an image cell ──────────────────────────
// UE wraps DM images in <a href="dm-url"><img ...></a>.
// Falls back to plain <img src> if no anchor.
function extractImageInfo(cell) {
  const anchor = cell.querySelector('a');
  const img = cell.querySelector('img');
  return {
    dmUrl: anchor?.href || img?.src || '',
    altText: img?.alt || '',
  };
}

// ── Helper: replace cell image with a built <picture> element ────────────────
async function replaceWithPicture(imageCell, blockKey, slotKey) {
  const { dmUrl, altText } = extractImageInfo(imageCell);
  if (!dmUrl) return;

  const picture = buildResponsivePicture(dmUrl, altText, blockKey, slotKey);
  if (!picture) return;

  imageCell.innerHTML = '';
  imageCell.appendChild(picture);
}

export default async function decorate(block) {
  // EDS renders each authoring row as a child <div> of the block.
  // Each row <div> contains two cell <div>s: [imageCell, textCell].
  const rows = [...block.children];

  // ── Row 0: Horizontal section ─────────────────────────────────────────────
  // Wide landscape image + short caption text
  const [horizImageCell, horizTextCell] = [...(rows[0]?.children || [])];
  if (horizImageCell) {
    await replaceWithPicture(horizImageCell, 'dm-editorial', 'imageHorizontal');
  }
  horizTextCell?.classList.add('dm-editorial-text', 'dm-editorial-text--horizontal');

  // ── Row 1: Vertical section ───────────────────────────────────────────────
  // Tall portrait image + longer body text beside it
  const [vertImageCell, vertTextCell] = [...(rows[1]?.children || [])];
  if (vertImageCell) {
    await replaceWithPicture(vertImageCell, 'dm-editorial', 'imageVertical');
  }
  vertTextCell?.classList.add('dm-editorial-text', 'dm-editorial-text--vertical');

  // Semantic section classes for CSS
  rows[0]?.classList.add('dm-editorial-horizontal');
  rows[1]?.classList.add('dm-editorial-vertical');

  block.classList.add('is-decorated');
}
