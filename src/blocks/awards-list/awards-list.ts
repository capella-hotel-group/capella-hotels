import { moveInstrumentation } from '@/app/scripts.js';

function textFromCell(cell?: Element | null): string {
  return cell?.textContent?.trim() || '';
}

function buildAward(row: Element): HTMLLIElement | null {
  const cells = [...row.children];
  if (!cells.length || cells.every((cell) => !textFromCell(cell) && !cell.querySelector('picture, img'))) return null;

  const picture = cells[0]?.querySelector('picture');
  const image = picture?.querySelector('img');
  const hasCollapsedImage = cells.length < 4;
  const altText = hasCollapsedImage ? image?.getAttribute('alt') || '' : textFromCell(cells[1]);
  const awardTextCell = hasCollapsedImage ? cells[1] : cells[2];
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

  item.append(logo, label);
  return item;
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const blockId = block.querySelector('[data-aue-prop="id"]')?.textContent?.trim();
  if (blockId) block.id = blockId;
  const title = textFromCell(rows[0]);
  const description = rows[1]?.firstElementChild;

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
    .slice(2)
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
