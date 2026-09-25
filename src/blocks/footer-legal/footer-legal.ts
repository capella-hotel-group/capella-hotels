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

// `link-item`: same collapsed anchor shape as Footer Link — see footer-links.ts.
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

function buildListItem(entry: LinkEntry): HTMLLIElement {
  const item = document.createElement('li');
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

/**
 * loads and decorates the "Footer Legal" block
 * @param {Element} block The footer-legal block element
 */
export default function decorate(block: HTMLElement): void {
  // Own field order: copyrightText (row 0), then one row per Footer Legal Link item.
  const rows = [...block.children];
  const copyrightText = cellOf(rows[0])?.textContent?.trim() || '© 2026 Capella Hotel Group. All Rights Reserved.';
  const entries = rows
    .slice(1)
    .map(parseItemRow)
    .filter((entry): entry is LinkEntry => !!entry);

  const children: Element[] = [];
  if (entries.length) {
    const list = document.createElement('ul');
    list.className = 'footer-legal-list';
    entries.forEach((entry) => list.append(buildListItem(entry)));
    children.push(list);
  }

  const copyright = document.createElement('p');
  copyright.className = 'footer-copyright';
  copyright.textContent = copyrightText;
  if (rows[0]) moveInstrumentation(rows[0], copyright);
  children.push(copyright);

  // `footer-legal` (the xwalk block name) already matches the leaf class footer.css expects
  block.replaceChildren(...children);
}
