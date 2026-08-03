import { moveInstrumentation } from '../../scripts/scripts.js';

function moveChildren(from, to) {
  while (from.firstChild) to.append(from.firstChild);
}

function firstText(el) {
  return el?.textContent?.trim() || '';
}

function classifyIntroCell(cell, idx) {
  if (idx === 0) return 'content-card-eyebrow';
  if (idx === 1) return 'content-card-title';
  return 'content-card-copy';
}

function createMediaFigure(mediaCell) {
  const figure = document.createElement('figure');
  figure.className = 'content-card-media';

  const picture = mediaCell.querySelector('picture');
  if (picture) {
    figure.append(picture);
  } else {
    const img = mediaCell.querySelector('img');
    if (img) figure.append(img);
  }

  return figure;
}

function createOverlay(locationText, titleText) {
  if (!locationText && !titleText) return null;

  const overlay = document.createElement('figcaption');
  overlay.className = 'content-card-overlay';

  if (locationText) {
    const location = document.createElement('p');
    location.className = 'content-card-location';
    location.textContent = locationText;
    overlay.append(location);
  }

  if (titleText) {
    const heading = document.createElement('h3');
    heading.className = 'content-card-heading';
    heading.textContent = titleText;
    overlay.append(heading);
  }

  return overlay;
}

function ensureImageAlt(figure, titleText, locationText) {
  const mediaImg = figure.querySelector('img');
  if (mediaImg && !mediaImg.alt) {
    mediaImg.alt = titleText || locationText || 'Content card image';
  }
}

function createCtaWrap(link) {
  const ctaWrap = document.createElement('p');
  ctaWrap.className = 'content-card-cta';
  ctaWrap.append(link);
  return ctaWrap;
}

function appendBodyContent(body, details) {
  const lastIdx = details.length - 1;

  details.forEach((cell, idx) => {
    const link = cell.querySelector('a');
    const hasLinkOnly = link && firstText(cell) === firstText(link);

    if (hasLinkOnly && idx === lastIdx) {
      body.append(createCtaWrap(link));
      return;
    }

    const meta = document.createElement('div');
    meta.className = idx === 0 ? 'content-card-meta' : 'content-card-text';
    moveChildren(cell, meta);
    body.append(meta);
  });
}

function buildIntro(row) {
  const intro = document.createElement('header');
  intro.className = 'content-card-intro';

  [...row.children].forEach((cell, idx) => {
    const part = document.createElement('div');
    part.className = classifyIntroCell(cell, idx);
    moveChildren(cell, part);
    intro.append(part);
  });

  return intro;
}

function buildCard(row) {
  const cells = [...row.children];
  const mediaCell = cells.find((cell) => cell.querySelector('picture, img'));
  const contentCells = cells.filter((cell) => cell !== mediaCell && firstText(cell));

  if (!mediaCell && contentCells.length === 0) return null;

  const li = document.createElement('li');
  li.className = 'content-card-item';
  moveInstrumentation(row, li);

  const article = document.createElement('article');
  article.className = 'content-card-article';

  const locationText = firstText(contentCells[0]);
  const titleText = firstText(contentCells[1]);

  if (mediaCell) {
    const figure = createMediaFigure(mediaCell);
    const overlay = createOverlay(locationText, titleText);
    if (overlay) figure.append(overlay);

    // Keep authored alt if present; otherwise provide a fallback.
    ensureImageAlt(figure, titleText, locationText);

    article.append(figure);
  }

  const body = document.createElement('div');
  body.className = 'content-card-body';

  appendBodyContent(body, contentCells.slice(2));

  if (body.childElementCount > 0) article.append(body);

  li.append(article);
  return li;
}

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const introRow = rows.shift();
  const intro = buildIntro(introRow);

  const list = document.createElement('ul');
  list.className = 'content-card-list';

  rows.forEach((row) => {
    const card = buildCard(row);
    if (card) list.append(card);
  });

  block.replaceChildren(intro, list);
}
