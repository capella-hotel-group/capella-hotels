import { buildResponsivePicture } from '../../scripts/dm-picture.js';

export default async function decorate(block) {
  // UE / EDS authoring produces two cells in a row:
  //   cell 0 → image (contains an <a> or <img> with the DM URL)
  //   cell 1 → text content (headings, paragraphs, etc.)
  const [imageCell, textCell] = [...block.children[0].children];

  // ── Extract the raw DM URL ───────────────────────────────
  // UE puts a linked image: <a href="...dm-url..."><img ...></a>
  // Fall back to reading the <img src> directly if no anchor.
  const anchor = imageCell.querySelector('a');
  const img = imageCell.querySelector('img');
  const dmUrl = anchor?.href || img?.src || '';
  const altText = img?.alt || '';

  if (!dmUrl) {
    return;
  }

  // ── Build the responsive <picture> ──────────────────────
  const picture = await buildResponsivePicture(dmUrl, altText, 'dm-showcase');
  if (!picture) return;

  // ── Re-assemble the block DOM ────────────────────────────
  imageCell.innerHTML = '';
  imageCell.appendChild(picture);

  // Give the text cell a semantic class for CSS targeting
  textCell?.classList.add('dm-showcase-text');

  block.classList.add('is-decorated');
}
