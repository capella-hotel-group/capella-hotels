import { moveInstrumentation } from '../../scripts/scripts.js';

const INTRO_ROWS = 2;
const MAX_ICONS = 3;

function textFromCell(cell) {
  return cell?.textContent?.trim() || '';
}

function collectMedia(cell) {
  const pics = [...(cell?.querySelectorAll('picture') || [])];
  if (pics.length) return pics;

  const imgs = [...(cell?.querySelectorAll('img') || [])];
  return imgs.map((img) => {
    const picture = document.createElement('picture');
    picture.append(img);
    return picture;
  });
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

function buildCta(labelCell, linkCell) {
  const label = textFromCell(labelCell);
  const authoredLink = linkCell?.querySelector('a');
  const href = authoredLink?.getAttribute('href') || textFromCell(linkCell);

  if (!label && !href) return null;

  const cta = document.createElement('a');
  cta.className = 'destination-cards-cta';
  cta.textContent = label || 'Explore';
  cta.href = href || '#';
  return cta;
}

function buildCard(row) {
  const cells = [...row.children];
  if (cells.length < 3) return null;

  const location = textFromCell(cells[0]);
  const title = textFromCell(cells[1]);
  const image = cells[2]?.querySelector('picture, img');
  if (!image) return null;

  const icons = cells
    .slice(5)
    .flatMap((cell) => collectMedia(cell))
    .slice(0, MAX_ICONS);
  const cta = buildCta(cells[3], cells[4]);

  const item = document.createElement('li');
  item.className = 'destination-cards-item';
  moveInstrumentation(row, item);

  const article = document.createElement('article');
  article.className = 'destination-cards-card';

  const media = document.createElement('figure');
  media.className = 'destination-cards-media';

  const mediaNode = image.tagName.toLowerCase() === 'picture' ? image : image.closest('picture') || image;
  media.append(mediaNode);

  const overlay = document.createElement('figcaption');
  overlay.className = 'destination-cards-overlay';

  if (location) {
    const locationEl = document.createElement('p');
    locationEl.className = 'destination-cards-location';
    locationEl.textContent = location;
    overlay.append(locationEl);
  }

  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.className = 'destination-cards-card-title';
    titleEl.textContent = title;
    overlay.append(titleEl);
  }

  if (icons.length) {
    const iconsWrap = document.createElement('div');
    iconsWrap.className = 'destination-cards-icons';
    icons.forEach((icon) => iconsWrap.append(icon));
    overlay.append(iconsWrap);
  }

  media.append(overlay);
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
