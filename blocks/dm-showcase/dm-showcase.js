/**
 * dm-showcase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Test block for validating the Dynamic Media pipeline on EDS.
 *
 * LAYOUT:
 *   Desktop: image left (50%) | text right (50%)
 *   Mobile:  image stacked above text
 *
 * AUTHORING (Universal Editor / Document):
 *   Row 1, Cell 1 → DM image (linked or plain <img>)
 *   Row 1, Cell 2 → Text content (heading + paragraph)
 *
 * DM PRESET SLOT: 'image' (single slot — see dm-presets.js → 'dm-showcase')
 *   Desktop: de768x480
 *   Mobile:  de480x320
 * ─────────────────────────────────────────────────────────────────────────────
 */

import buildResponsivePicture from '../../scripts/dm-picture.js';

export default async function decorate(block) {
  // EDS renders each table row as a <div> containing child <div> cells.
  // Row 0 → the only row in this block
  // Cell 0 → image cell | Cell 1 → text cell
  const [imageCell, textCell] = [...block.children[0].children];

  // ── Extract DM URL ─────────────────────────────────────────────────────────
  // UE wraps DM images in an anchor: <a href="dm-url"><img ...></a>
  // Fall back to reading <img src> directly if no anchor present.
  const anchor = imageCell.querySelector('a');
  const img = imageCell.querySelector('img');
  const dmUrl = anchor?.href || img?.src || '';
  const altText = img?.alt || '';

  if (!dmUrl) return;

  // ── Build responsive <picture> using 'image' slot ─────────────────────────
  // Looks up 'dm-showcase' → 'image' in dm-presets.js
  // Produces: <source media="(width >= 768px)" srcset="...de768x480...">
  //           <img src="...de480x320..." loading="lazy">
  const picture = buildResponsivePicture(dmUrl, altText, 'dm-showcase', 'image');
  if (!picture) return;

  // ── Replace original image cell content with the new <picture> ────────────
  imageCell.innerHTML = '';
  imageCell.appendChild(picture);

  // Semantic class for CSS targeting
  textCell?.classList.add('dm-showcase-text');

  block.classList.add('is-decorated');
}
