import { moveInstrumentation } from '@/app/scripts.js';

// Row indices mirror the field order of the `destination-introduction` model
// (eyebrow, title, body, footerCta). Changing that field list is a contract
// change and must update these indices in the same commit.
const COPY_FIELDS = ['eyebrow', 'title', 'body', 'footer-cta'];
const GALLERY_START = COPY_FIELDS.length;

/**
 * Stub decoration: establishes the block class hooks only. Gallery layout,
 * responsive rules, and art direction land in a follow-up change.
 * @param block The block element
 */
export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];

  COPY_FIELDS.forEach((field, index) => {
    const row = rows[index];
    // A trailing empty row can be trimmed when the markup round-trips through markdown.
    if (!row) return;
    row.classList.add('destination-introduction-copy', `destination-introduction-${field}`);
  });

  const items = rows.slice(GALLERY_START);
  if (items.length === 0) return;

  const gallery = document.createElement('div');
  gallery.className = 'destination-introduction-gallery';

  items.forEach((row) => {
    const item = document.createElement('div');
    item.className = 'destination-introduction-gallery-item';
    moveInstrumentation(row, item);
    while (row.firstChild) item.append(row.firstChild);
    gallery.append(item);
    row.remove();
  });

  block.append(gallery);
}
