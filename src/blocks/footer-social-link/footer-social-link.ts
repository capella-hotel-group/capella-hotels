import { moveInstrumentation } from '@/app/scripts.js';
import { createFooterLink, newTabHint } from '@/utils/footer-link.js';

let headingCount = 0;

function isEnabled(text: string | undefined): boolean {
  return (text ?? '').trim().toLowerCase() === 'true';
}

function hrefFromCell(cell: Element | null): string {
  return cell?.querySelector('a')?.getAttribute('href') || cell?.textContent?.trim() || '';
}

interface SocialEntry {
  row: Element;
  icon: Element | null;
  iconAlt: string;
  href: string;
  openInNewTab: boolean;
}

// `footer-social-item`: the icon reference field auto-sets its paired `iconAlt` label onto the
// rendered `<img alt>` (verified against footer.plain.html — there is no separate iconAlt cell).
// Find the icon and URL independently of the removed leading dropdown cell.
function parseItemRow(row: Element): SocialEntry | null {
  const cells = [...row.children];
  const icon = row.querySelector('picture');
  const iconAlt = icon?.querySelector('img')?.getAttribute('alt') || '';
  const linkCell =
    cells.find((cell) => !cell.querySelector('picture') && cell.querySelector('a[href]')) ||
    cells.find((cell) => !cell.querySelector('picture') && /^(?:https?:\/\/|\/)/i.test(cell.textContent?.trim() || ''));
  const href = hrefFromCell(linkCell ?? null);
  const openInNewTab = isEnabled(linkCell ? cells[cells.indexOf(linkCell) + 1]?.textContent?.trim() : undefined);

  if (!href) return null;
  return { row, icon, iconAlt, href, openInNewTab };
}

function buildListItem(entry: SocialEntry): HTMLLIElement {
  const item = document.createElement('li');
  moveInstrumentation(entry.row, item);
  const anchor = createFooterLink(entry.href, entry.openInNewTab);

  if (entry.icon) {
    // wrapped in `.icon` so the existing `.footer-social-list .icon` sizing rule still applies
    const iconWrap = document.createElement('span');
    iconWrap.className = 'icon';
    const picture = entry.icon.cloneNode(true) as HTMLElement;
    const img = picture.querySelector('img');
    if (img) img.alt = entry.iconAlt || 'Social media icon';
    iconWrap.append(picture);
    anchor.append(iconWrap);
  } else {
    anchor.append('Link');
  }

  if (entry.href && entry.openInNewTab) anchor.append(newTabHint());
  item.append(anchor);
  return item;
}

/**
 * loads and decorates the "Footer Social Link" block
 * @param {Element} block The footer-social-link block element
 */
export default function decorate(block: HTMLElement): void {
  // Own field order: title (row 0), then one row per Footer Social Item.
  const rows = [...block.children];
  const items = rows
    .slice(1)
    .map(parseItemRow)
    .filter((entry): entry is SocialEntry => !!entry);
  if (!items.length) {
    block.replaceChildren();
    return;
  }

  headingCount += 1;
  const heading = document.createElement('h2');
  heading.id = `footer-social-heading-${headingCount}`;
  heading.className = 'footer-heading';
  heading.textContent = rows[0]?.firstElementChild?.textContent?.trim() || 'Follow Us On';
  if (rows[0]) moveInstrumentation(rows[0], heading);

  const list = document.createElement('ul');
  list.className = 'footer-social-list';
  list.setAttribute('aria-labelledby', heading.id);
  items.forEach((entry) => list.append(buildListItem(entry)));

  // renamed from `footer-social-link` (the xwalk block name) to the leaf class footer.css expects
  block.className = 'footer-social';
  block.replaceChildren(heading, list);
}
