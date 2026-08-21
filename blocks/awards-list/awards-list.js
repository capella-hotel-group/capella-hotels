import { moveInstrumentation } from '../../scripts/scripts.js';

function textFromCell(cell) {
  return cell?.textContent?.trim() || '';
}

function getCtaFields(cell) {
  const elements = [...(cell?.children || [])];
  const link = cell?.querySelector('a');
  const label = elements.find((element) => !element.querySelector('a') && textFromCell(element) !== 'true' && textFromCell(element) !== 'false');
  const openInNewTab = elements.some((element) => textFromCell(element).toLowerCase() === 'true');
  return { label: textFromCell(label), href: link?.getAttribute('href') || '', openInNewTab };
}

function buildCta(cell) {
  const { label, href, openInNewTab } = getCtaFields(cell);
  if (!label || !href) return null;

  const cta = document.createElement('a');
  cta.className = 'awards-list-cta';
  cta.href = href;
  cta.textContent = label;
  if (openInNewTab) cta.target = '_blank';
  return cta;
}

function buildAward(row) {
  const cells = [...row.children];
  const picture = cells[0]?.querySelector('picture');
  const image = picture?.querySelector('img');
  const hasCollapsedImage = cells.length < 4;
  const altText = hasCollapsedImage ? image?.getAttribute('alt') || '' : textFromCell(cells[1]);
  const awardText = hasCollapsedImage ? textFromCell(cells[1]) : textFromCell(cells[2]);
  if (!picture && !awardText) return null;

  const item = document.createElement('li');
  item.className = 'awards-list-item';
  moveInstrumentation(row, item);

  const logo = document.createElement('div');
  logo.className = 'awards-list-item-logo';
  if (picture) {
    const clonedPicture = picture.cloneNode(true);
    const clonedImage = clonedPicture.querySelector('img');
    if (clonedImage && altText) clonedImage.alt = altText;
    logo.append(clonedPicture);
  }

  const label = document.createElement('p');
  label.className = 'awards-list-item-text';
  label.textContent = awardText;

  item.append(logo, label);
  return item;
}

export default function decorate(block) {
  const rows = [...block.children];
  const title = textFromCell(rows[0]);
  const description = rows[1]?.firstElementChild;
  const cta = buildCta(rows[2]?.firstElementChild);

  const header = document.createElement('header');
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

  if (cta) {
    const ctaWrapper = document.createElement('div');
    ctaWrapper.className = 'awards-list-cta-wrapper';
    ctaWrapper.append(cta);
    header.append(ctaWrapper);
  }

  const grid = document.createElement('ul');
  grid.className = 'awards-list-grid';
  rows.slice(3).forEach((row) => {
    const award = buildAward(row);
    if (award) grid.append(award);
  });

  block.replaceChildren(header, grid);
}
