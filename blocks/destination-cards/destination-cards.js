import { moveInstrumentation } from '../../scripts/scripts.js';

const INTRO_ROWS = 2;

function textFromCell(cell) {
  return cell?.textContent?.trim() || '';
}

function isEnabled(cell) {
  return textFromCell(cell).toLowerCase() === 'true';
}

function setLinkAttributes(link, href, openInNewTab) {
  link.href = href;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
}

function buildIntro(rows) {
  const [titleRow, subtitleRow] = rows;

  const intro = document.createElement('header');
  intro.className = 'destination-cards-intro';

  const title = textFromCell(titleRow?.firstElementChild || titleRow);
  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'destination-cards-title';
    heading.textContent = title;
    intro.append(heading);
  }

  const subtitleCell = subtitleRow?.firstElementChild || subtitleRow;
  if (textFromCell(subtitleCell)) {
    const subtitle = document.createElement('div');
    subtitle.className = 'destination-cards-subtitle';
    while (subtitleCell.firstChild) subtitle.append(subtitleCell.firstChild);
    intro.append(subtitle);
  }

  return intro;
}

function buildCta(labelCell, href, openInNewTab) {
  const label = textFromCell(labelCell);

  if (!label && !href) return null;

  const cta = document.createElement('a');
  cta.className = 'destination-cards-cta';
  cta.textContent = label || 'Explore';
  setLinkAttributes(cta, href || '#', openInNewTab);
  return cta;
}

function buildCard(row) {
  const cells = [...row.children];
  if (cells.length < 3) return null;

  const location = textFromCell(cells[0]);
  const title = textFromCell(cells[1]);
  const image = cells[2]?.querySelector('picture, img');
  const imageAlt = textFromCell(cells[3]);
  const authoredLink = cells[5]?.querySelector('a');
  const href = authoredLink?.getAttribute('href') || textFromCell(cells[5]);
  const openInNewTab = isEnabled(cells[6]);

  const cta = buildCta(cells[4], href, openInNewTab);

  // Ignore rows that have no authored content at all.
  if (!location && !title && !image && !cta) {
    return null;
  }

  const item = document.createElement('li');
  item.className = 'destination-cards-item';
  moveInstrumentation(row, item);

  const article = document.createElement('article');
  article.className = 'destination-cards-card';

  const media = document.createElement('figure');
  media.className = 'destination-cards-media';

  const mediaContent = href ? document.createElement('a') : document.createElement('div');
  mediaContent.className = 'destination-cards-media-link';
  if (href) {
    setLinkAttributes(mediaContent, href, openInNewTab);
    mediaContent.setAttribute('aria-label', `${title || location || 'Destination'}: ${textFromCell(cells[4]) || 'Explore'}`);
  }

  if (image) {
    const mediaNode = image.tagName.toLowerCase() === 'picture' ? image : image.closest('picture') || image;
    const imageElement = mediaNode.querySelector('img') || (mediaNode.tagName === 'IMG' ? mediaNode : null);
    if (imageElement && imageAlt) imageElement.alt = imageAlt;
    mediaContent.append(mediaNode);
  } else {
    media.classList.add('destination-cards-media-no-image');
  }

  const overlay = document.createElement('figcaption');
  overlay.className = 'destination-cards-overlay';

  if (location) {
    const locationEl = document.createElement('p');
    locationEl.className = 'destination-cards-location';
    locationEl.textContent = location;
    overlay.append(locationEl);
  }

  if (title) {
    const titleEl = document.createElement('h1');
    titleEl.className = 'destination-cards-card-title';
    titleEl.textContent = title;
    overlay.append(titleEl);
  }

  mediaContent.append(overlay);
  media.append(mediaContent);
  article.append(media);

  if (cta) {
    const footer = document.createElement('div');
    footer.className = 'destination-cards-footer';
    footer.append(cta);
    article.append(footer);
  }

  item.append(article);
  return item;
}

export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length < INTRO_ROWS) return;

  const intro = buildIntro(rows.slice(0, INTRO_ROWS));

  const list = document.createElement('ul');
  list.className = 'destination-cards-list';

  rows.slice(INTRO_ROWS).forEach((row) => {
    const card = buildCard(row);
    if (card) list.append(card);
  });

  block.replaceChildren(intro, list);
}
