import { moveInstrumentation } from '@/app/scripts.js';

function isEnabled(text: string | undefined): boolean {
  return (text ?? '').trim().toLowerCase() === 'true';
}

function hrefFromCell(cell: Element | null): string {
  return cell?.querySelector('a')?.getAttribute('href') || cell?.textContent?.trim() || '';
}

interface SocialEntry {
  row: Element;
  platform: string;
  icon: Element | null;
  iconAlt: string;
  href: string;
  openInNewTab: boolean;
}

// `footer-social-item`: the icon reference field auto-sets its paired `iconAlt` label onto the
// rendered `<img alt>` (verified against footer.plain.html — there is no separate iconAlt cell).
// Cells: [0] platform, [1] icon (picture), [2] link, [3] openInNewTab.
function parseItemRow(row: Element): SocialEntry | null {
  const cells = [...row.children];
  const platform = cells[0]?.textContent?.trim() || '';
  const icon = cells[1]?.querySelector('picture') ?? null;
  const iconAlt = icon?.querySelector('img')?.getAttribute('alt') || '';
  const href = hrefFromCell(cells[2] ?? null);
  const openInNewTab = isEnabled(cells[3]?.textContent?.trim());

  if (!href && !platform) return null;
  return { row, platform, icon, iconAlt, href, openInNewTab };
}

function buildListItem(entry: SocialEntry): HTMLLIElement {
  const item = document.createElement('li');
  moveInstrumentation(entry.row, item);
  const anchor = document.createElement('a');
  anchor.href = entry.href || '#';
  anchor.setAttribute('aria-label', entry.platform || 'Social media');
  if (entry.openInNewTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }

  if (entry.icon) {
    // wrapped in `.icon` so the existing `.footer-social-list .icon` sizing rule still applies
    const iconWrap = document.createElement('span');
    iconWrap.className = 'icon';
    const picture = entry.icon.cloneNode(true) as HTMLElement;
    const img = picture.querySelector('img');
    if (img) img.alt = entry.iconAlt || entry.platform || 'Social media icon';
    iconWrap.append(picture);
    anchor.append(iconWrap);
  } else {
    anchor.textContent = entry.platform || 'Link';
  }

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

  const heading = document.createElement('p');
  heading.className = 'footer-heading';
  heading.textContent = rows[0]?.firstElementChild?.textContent?.trim() || 'Follow Us On';
  if (rows[0]) moveInstrumentation(rows[0], heading);

  const list = document.createElement('ul');
  list.className = 'footer-social-list';
  items.forEach((entry) => list.append(buildListItem(entry)));

  // renamed from `footer-social-link` (the xwalk block name) to the leaf class footer.css expects
  block.className = 'footer-social';
  block.replaceChildren(heading, list);
}
