import { moveInstrumentation } from '@/app/scripts.js';

function textFromCell(cell?: Element | null): string {
  return cell?.textContent?.trim() || '';
}

function getFieldCell(row: Element, fieldName: string): Element | undefined {
  return [...row.children].find(
    (cell) => cell.getAttribute('data-aue-prop') === fieldName || !!cell.querySelector(`[data-aue-prop="${fieldName}"]`),
  );
}

function isBooleanCell(cell: Element): boolean {
  return ['true', 'false', 'yes', 'no'].includes(textFromCell(cell).toLowerCase());
}

function setLinkAttributes(link: HTMLAnchorElement, href: string, openInNewTab: boolean): void {
  link.href = href;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
}

function buildAward(row: Element): HTMLLIElement | null {
  const cells = [...row.children];
  if (!cells.length || cells.every((cell) => !textFromCell(cell) && !cell.querySelector('picture, img'))) return null;

  const imageCell = cells.find((cell) => cell.querySelector('picture, img'));
  const picture = imageCell?.querySelector('picture');
  const image = picture?.querySelector('img');
  const altCell = getFieldCell(row, 'imageAlt');
  const linkCell = getFieldCell(row, 'link') || cells.find((cell) => cell.querySelector('a'));
  const openInNewTabCell = getFieldCell(row, 'openInNewTab') || cells.find((cell) => isBooleanCell(cell));
  const awardTextCell =
    getFieldCell(row, 'description') ||
    cells.find(
      (cell) =>
        cell !== imageCell &&
        cell !== linkCell &&
        cell !== openInNewTabCell &&
        cell !== altCell &&
        !cell.querySelector('picture, img, a') &&
        !isBooleanCell(cell),
    );
  const altText = textFromCell(altCell) || image?.getAttribute('alt') || '';
  const awardText = textFromCell(awardTextCell);
  if (!picture && !awardText) return null;

  const item = document.createElement('li');
  item.className = 'awards-list-item';
  moveInstrumentation(row, item);

  const logo = document.createElement('div');
  logo.className = 'awards-list-item-logo';
  if (picture) {
    const clonedPicture = picture.cloneNode(true) as HTMLElement;
    const clonedImage = clonedPicture.querySelector('img');
    if (clonedImage && altText) clonedImage.alt = altText;
    logo.append(clonedPicture);
  }

  const label = document.createElement('div');
  label.className = 'awards-list-item-text';
  if (awardTextCell?.children.length) {
    [...awardTextCell.children].forEach((child) => label.append(child.cloneNode(true)));
  } else {
    label.textContent = awardText;
  }

  const href = linkCell?.querySelector('a')?.getAttribute('href') || textFromCell(linkCell);
  const openInNewTab = ['true', 'yes'].includes(textFromCell(openInNewTabCell).toLowerCase());
  if (href) {
    const link = document.createElement('a');
    setLinkAttributes(link, href, openInNewTab);
    link.append(logo, label);
    item.append(link);
  } else {
    item.append(logo, label);
  }
  return item;
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const blockId = block.querySelector('[data-aue-prop="id"]')?.textContent?.trim();
  if (blockId) block.id = blockId;
  const firstAwardIndex = rows.findIndex((row) => row.querySelector('picture, img'));
  const headerRows = rows.slice(0, firstAwardIndex < 0 ? rows.length : firstAwardIndex);
  const titleRow = rows.find((row) => getFieldCell(row, 'title')) || headerRows[0];
  const descriptionRow = rows.find((row) => getFieldCell(row, 'description')) || headerRows[1];
  const title = textFromCell(titleRow);
  const description = descriptionRow?.firstElementChild;

  const header = document.createElement('div');
  header.className = 'awards-list-header';

  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'awards-list-title';
    heading.textContent = title;
    header.append(heading);
  }

  if (description) {
    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'awards-list-description';
    descriptionElement.innerHTML = description.innerHTML;
    header.append(descriptionElement);
  }

  const grid = document.createElement('ul');
  grid.className = 'awards-list-grid';
  rows
    .slice(firstAwardIndex < 0 ? rows.length : firstAwardIndex)
    .filter((row) => row.querySelector('picture, img'))
    .forEach((row) => {
      const award = buildAward(row);
      if (award) grid.append(award);
    });

  const wrapper = document.createElement('div');
  wrapper.className = 'awards-list-content';
  wrapper.append(header, grid);
  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
