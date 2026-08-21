import { moveInstrumentation } from '../../scripts/scripts.js';

function textFromCell(cell) {
  return cell?.textContent?.trim() || '';
}

function readToggleTexts(cell) {
  const values = [...cell.querySelectorAll('p')]
    .filter((p) => !p.querySelector('a'))
    .map((p) => p.textContent.trim().toLowerCase());

  return values;
}

function applyTarget(anchor, openInNewTab) {
  if (!openInNewTab) return;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
}

function appendTitleLines(element, text) {
  text.split(/\r?\n/).forEach((line, index, lines) => {
    const lineElement = document.createElement('span');
    lineElement.className = 'offers-carousel-title-line';
    lineElement.textContent = line;
    element.append(lineElement);
    if (index < lines.length - 1) element.append(document.createElement('br'));
  });
}

function parseCard(row) {
  const cells = [...row.children];
  if (cells.length < 3) return null;

  const mediaCell = cells[0];
  const contentCell = cells[1];
  const ctaCell = cells[2];

  const media = mediaCell.querySelector('picture, img');
  if (!media) return null;

  const paragraphs = [...contentCell.querySelectorAll('p')];
  const eyebrow = paragraphs[0]?.textContent?.trim() || '';
  const headline = paragraphs[1]?.textContent?.trim() || '';
  const description = contentCell.querySelector('div')?.innerHTML || '';

  const links = [...ctaCell.querySelectorAll('a')];
  const toggles = readToggleTexts(ctaCell);

  const primary = links[0] ? {
    href: links[0].getAttribute('href') || '#',
    label: links[0].textContent.trim() || 'ENQUIRE',
    openInNewTab: toggles[0] === 'true',
  } : null;

  const secondary = links[1] ? {
    href: links[1].getAttribute('href') || '#',
    label: links[1].textContent.trim() || 'DETAILS',
    openInNewTab: toggles[1] === 'true',
  } : null;

  return {
    media,
    eyebrow,
    headline,
    description,
    primary,
    secondary,
  };
}

function createCard(card, row) {
  const item = document.createElement('li');
  item.className = 'offers-carousel-card';
  moveInstrumentation(row, item);

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'offers-carousel-card-media';

  const mediaNode = card.media.tagName.toLowerCase() === 'picture'
    ? card.media
    : card.media.closest('picture') || card.media;
  mediaWrap.append(mediaNode);

  const overlay = document.createElement('div');
  overlay.className = 'offers-carousel-card-overlay';

  if (card.eyebrow) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'offers-carousel-card-eyebrow';
    eyebrow.textContent = card.eyebrow;
    overlay.append(eyebrow);
  }

  const body = document.createElement('div');
  body.className = 'offers-carousel-card-body';

  if (card.headline) {
    const headline = document.createElement('h3');
    headline.className = 'offers-carousel-card-title';
    headline.textContent = card.headline;
    body.append(headline);
  }

  if (card.description) {
    const description = document.createElement('div');
    description.className = 'offers-carousel-card-description';
    description.innerHTML = card.description;
    body.append(description);
  }

  const ctas = document.createElement('div');
  ctas.className = 'offers-carousel-card-ctas';

  if (card.primary) {
    const primary = document.createElement('a');
    primary.className = 'offers-carousel-card-cta';
    primary.href = card.primary.href;
    primary.textContent = card.primary.label;
    applyTarget(primary, card.primary.openInNewTab);
    ctas.append(primary);
  }

  if (card.secondary) {
    const secondary = document.createElement('a');
    secondary.className = 'offers-carousel-card-cta';
    secondary.href = card.secondary.href;
    secondary.textContent = card.secondary.label;
    applyTarget(secondary, card.secondary.openInNewTab);
    ctas.append(secondary);
  }

  body.append(ctas);
  overlay.append(body);
  mediaWrap.append(overlay);
  item.append(mediaWrap);

  return item;
}

function applyStackState(cards, activeIndex) {
  const total = cards.length;

  cards.forEach((card, index) => {
    const rank = (index - activeIndex + total) % total;

    card.classList.remove('is-active', 'is-next-1', 'is-next-2', 'is-hidden');

    if (rank === 0) card.classList.add('is-active');
    else if (rank === 1) card.classList.add('is-next-1');
    else if (rank === 2) card.classList.add('is-next-2');
    else card.classList.add('is-hidden');
  });
}

function wireInteraction(root, cards) {
  let activeIndex = 0;

  const prevBtn = root.querySelector('.offers-carousel-nav-prev');
  const nextBtn = root.querySelector('.offers-carousel-nav-next');
  const stage = root.querySelector('.offers-carousel-stage');

  const update = () => applyStackState(cards, activeIndex);

  const goNext = () => {
    activeIndex = (activeIndex + 1) % cards.length;
    update();
  };

  const goPrev = () => {
    activeIndex = (activeIndex - 1 + cards.length) % cards.length;
    update();
  };

  prevBtn?.addEventListener('click', goPrev);
  nextBtn?.addEventListener('click', goNext);

  cards.forEach((card, index) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      activeIndex = index;
      update();
    });
  });

  let startX = 0;
  stage?.addEventListener('pointerdown', (event) => {
    startX = event.clientX;
  });

  stage?.addEventListener('pointerup', (event) => {
    const delta = event.clientX - startX;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) goNext();
    else goPrev();
  });

  update();
}

export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length < 3) return;

  const eyebrow = textFromCell(rows[0].firstElementChild || rows[0]);
  const title = textFromCell(rows[1].firstElementChild || rows[1]);

  const cardRows = rows.slice(2);
  const cardsData = cardRows
    .map((row) => parseCard(row))
    .filter(Boolean);

  if (!cardsData.length) return;

  const root = document.createElement('div');
  root.className = 'offers-carousel-layout';

  const copy = document.createElement('div');
  copy.className = 'offers-carousel-copy';

  if (eyebrow) {
    const eyebrowEl = document.createElement('p');
    eyebrowEl.className = 'offers-carousel-eyebrow';
    eyebrowEl.textContent = eyebrow;
    copy.append(eyebrowEl);
  }

  if (title) {
    const titleEl = document.createElement('h2');
    titleEl.className = 'offers-carousel-title';
    appendTitleLines(titleEl, title);
    copy.append(titleEl);
  }

  const stage = document.createElement('div');
  stage.className = 'offers-carousel-stage';

  const cards = document.createElement('ul');
  cards.className = 'offers-carousel-cards';

  const cardEls = cardsData.map((card, index) => {
    const element = createCard(card, cardRows[index]);
    cards.append(element);
    return element;
  });

  stage.append(cards);

  root.append(copy, stage);
  block.replaceChildren(root);

  wireInteraction(root, cardEls);
}
