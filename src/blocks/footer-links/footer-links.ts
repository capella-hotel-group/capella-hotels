import { moveInstrumentation } from '@/app/scripts.js';

const cellOf = (row?: Element | null) => row?.firstElementChild ?? null;

function isEnabled(text: string | undefined): boolean {
  return (text ?? '').trim().toLowerCase() === 'true';
}

interface LinkEntry {
  row: Element;
  label: string;
  href: string;
  openInNewTab: boolean;
}

// `link-item`: the `link` field renders as a single `<a href>` whose text is the paired
// `linkText` label (verified against footer.plain.html — there is no separate linkText cell).
// Cells: [0] link anchor, [1] openInNewTab.
function parseItemRow(row: Element): LinkEntry | null {
  const cells = [...row.children];
  const linkCell = cells[0] ?? null;
  const anchor = linkCell?.querySelector('a');
  const label = anchor?.textContent?.trim() || '';
  const href = anchor?.getAttribute('href') || linkCell?.textContent?.trim() || '';
  const openInNewTab = isEnabled(cells[1]?.textContent?.trim());

  if (!label && !href) return null;
  return { row, label, href, openInNewTab };
}

function buildLink(entry: LinkEntry): HTMLParagraphElement {
  const item = document.createElement('p');
  item.className = 'footer-nav-link';
  moveInstrumentation(entry.row, item);
  const anchor = document.createElement('a');
  anchor.href = entry.href || '#';
  anchor.textContent = entry.label || entry.href;
  if (entry.openInNewTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  item.append(anchor);
  return item;
}

function buildColumn(entries: LinkEntry[]): HTMLDivElement {
  const col = document.createElement('div');
  col.className = 'footer-nav-col';
  entries.forEach((entry) => col.append(buildLink(entry)));
  return col;
}

/**
 * loads and decorates the "Footer Links" block
 * @param {Element} block The footer-links block element
 */
export default function decorate(block: HTMLElement): void {
  // Own field order: itemsPerColumn (row 0), then one row per Footer Link item.
  const rows = [...block.children];
  const count = Number.parseInt(cellOf(rows[0])?.textContent?.trim() || '5', 10) || 5;
  const entries = rows
    .slice(1)
    .map(parseItemRow)
    .filter((entry): entry is LinkEntry => !!entry);
  if (!entries.length) {
    block.replaceChildren();
    return;
  }

  const firstGroup = entries.slice(0, Math.max(0, count));
  const secondGroup = entries.slice(Math.max(0, count));

  const columns: HTMLDivElement[] = [];
  if (firstGroup.length) columns.push(buildColumn(firstGroup));
  if (secondGroup.length) columns.push(buildColumn(secondGroup));

  // renamed from `footer-links` (the xwalk block name) to the leaf class footer.css expects
  block.className = 'footer-nav-columns';
  block.replaceChildren(...columns);
}
