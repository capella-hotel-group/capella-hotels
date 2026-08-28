import { moveInstrumentation } from '@/app/scripts.js';

function textFromCell(cell?: Element | null): string {
  if (!cell) return '';
  const textNodes = [...cell.children].map((child) => child.textContent?.trim() ?? '').filter(Boolean);
  return textNodes.length > 1 ? textNodes.join('\n') : (cell.textContent?.trim() ?? '');
}

function textFromPart(cell: Element | null | undefined, index: number): string {
  return textFromCell([...(cell?.children || [])][index] || cell);
}

function isEnabled(value?: Element | string | null, fallback = false): boolean {
  const text = typeof value === 'string' ? value : textFromCell(value);
  if (!text) return fallback;
  return ['true', 'yes', 'enabled'].includes(text.trim().toLowerCase());
}

function setLinkAttributes(link: HTMLAnchorElement, href: string, openInNewTab = false): void {
  link.setAttribute('href', href);
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
}

function getLinkFromCell(cell?: Element | null): { href: string; label: string } {
  const authoredLink = cell?.querySelector('a');
  return {
    href: authoredLink?.getAttribute('href') || textFromCell(cell),
    label: authoredLink?.textContent?.trim() || '',
  };
}

function isCardRow(row: Element): boolean {
  return row.children.length > 1;
}

interface CardFields {
  location: string;
  title: string;
  image: Element | null | undefined;
  imageAlt: string | null;
  href: string;
  ctaLabel: string;
  darkOverlay: boolean;
  openInNewTab: boolean;
}

function getCardFields(row: Element): CardFields {
  const cells = [...row.children];
  const isGroupedModel = cells.length <= 4 && !!cells[1]?.querySelector('picture, img');

  if (isGroupedModel) {
    const [contentCell, mediaCell, ctaCell, settingsCell] = cells;
    const cta = getLinkFromCell(ctaCell);
    const settingsParts = [...(settingsCell?.children || [])];

    return {
      location: textFromPart(contentCell, 0),
      title: textFromPart(contentCell, 1),
      image: mediaCell?.querySelector('picture, img'),
      imageAlt: mediaCell?.querySelector('img')?.getAttribute('alt') || textFromPart(mediaCell, 1),
      href: cta.href,
      ctaLabel: cta.label,
      darkOverlay: isEnabled(settingsParts[0] || settingsCell, true),
      openInNewTab: isEnabled(settingsParts[1], false),
    };
  }

  const linkIndex = cells.findIndex((cell, index) => index > 2 && !!cell.querySelector('a'));
  const isNewModelOrder = !!cells[4] && !cells[4].querySelector('a');
  const ctaLabelCell = isNewModelOrder ? cells[4] : cells[linkIndex + 1];
  const ctaLinkCell = isNewModelOrder ? cells[5] : cells[linkIndex];
  const hasLegacyAltField = !isNewModelOrder && linkIndex >= 5;
  const settingsStart = isNewModelOrder ? 6 : linkIndex + 2;
  const cta = getLinkFromCell(ctaLinkCell);

  return {
    location: textFromCell(cells[0]),
    title: textFromCell(cells[1]),
    image: cells[2]?.querySelector('picture, img'),
    imageAlt: isNewModelOrder || hasLegacyAltField ? textFromCell(cells[3]) : null,
    href: cta.href,
    ctaLabel: textFromCell(ctaLabelCell) || cta.label,
    openInNewTab: isEnabled(cells[settingsStart], false),
    darkOverlay: isEnabled(cells[settingsStart + 1], true),
  };
}

function buildIntro(rows: (Element | null)[]): HTMLDivElement {
  const [anchorRow, titleRow, subtitleRow] = rows.length > 2 ? rows : [null, ...rows];
  const intro = document.createElement('div');
  intro.className = 'destination-cards-intro';

  const anchorId = textFromCell(anchorRow?.firstElementChild || anchorRow);
  if (anchorId) intro.dataset.anchorId = anchorId.replace(/^#/, '');

  const title = textFromCell(titleRow?.firstElementChild || titleRow);
  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'destination-cards-title';
    heading.textContent = title;
    intro.append(heading);
  }

  const subtitleCell = subtitleRow?.firstElementChild || subtitleRow;
  if (subtitleCell && textFromCell(subtitleCell)) {
    const subtitle = document.createElement('div');
    subtitle.className = 'destination-cards-subtitle';
    while (subtitleCell.firstChild) subtitle.append(subtitleCell.firstChild);
    intro.append(subtitle);
  }

  return intro;
}

function buildCta(label: string, href: string, openInNewTab: boolean): HTMLAnchorElement | null {
  if (!label || !href) return null;
  const cta = document.createElement('a');
  cta.className = 'destination-cards-cta';
  cta.textContent = label;
  setLinkAttributes(cta, href, openInNewTab);
  return cta;
}

function buildCarouselControls(list: HTMLUListElement): HTMLDivElement {
  const controls = document.createElement('div');
  controls.className = 'destination-cards-controls';

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'destination-cards-control destination-cards-control-prev';
  previous.setAttribute('aria-label', 'Previous destination card');

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'destination-cards-control destination-cards-control-next';
  next.setAttribute('aria-label', 'Next destination card');

  const scrollByCard = (direction: number): void => {
    const firstCard = list.querySelector('.destination-cards-item');
    const cardWidth = firstCard?.getBoundingClientRect().width || list.clientWidth;
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    list.scrollBy({ left: direction * (cardWidth + gap), behavior: 'smooth' });
  };

  previous.addEventListener('click', () => scrollByCard(-1));
  next.addEventListener('click', () => scrollByCard(1));
  controls.append(previous, next);
  return controls;
}

function buildCard(row: Element): HTMLLIElement {
  const fields = getCardFields(row);
  const cta = buildCta(fields.ctaLabel, fields.href, fields.openInNewTab);
  const item = document.createElement('li');
  item.className = 'destination-cards-item';
  moveInstrumentation(row, item);

  const article = document.createElement('article');
  article.className = 'destination-cards-card';
  const media = document.createElement('figure');
  media.className = 'destination-cards-media';
  if (!fields.darkOverlay) media.classList.add('destination-cards-media-no-overlay');

  const mediaContent = fields.href ? document.createElement('a') : document.createElement('div');
  mediaContent.className = 'destination-cards-media-link';
  if (fields.href && mediaContent instanceof HTMLAnchorElement) {
    setLinkAttributes(mediaContent, fields.href, fields.openInNewTab);
    mediaContent.setAttribute(
      'aria-label',
      `${fields.title || fields.location || 'Destination'}: ${fields.ctaLabel || 'Explore'}`,
    );
  }

  if (fields.image) {
    const mediaNode =
      fields.image.tagName.toLowerCase() === 'picture' ? fields.image : fields.image.closest('picture') || fields.image;
    const imageElement =
      mediaNode.querySelector('img') || (mediaNode.tagName === 'IMG' ? (mediaNode as HTMLImageElement) : null);
    if (imageElement && fields.imageAlt !== null) imageElement.alt = fields.imageAlt;
    mediaContent.append(mediaNode);
  } else {
    media.classList.add('destination-cards-media-no-image');
  }

  const overlay = document.createElement('figcaption');
  overlay.className = 'destination-cards-overlay';
  if (fields.location) {
    const location = document.createElement('p');
    location.className = 'destination-cards-location';
    location.textContent = fields.location;
    overlay.append(location);
  }
  if (fields.title) {
    const title = document.createElement('h3');
    title.className = 'destination-cards-card-title';
    title.textContent = fields.title;
    overlay.append(title);
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

export default function decorate(block: HTMLElement): HTMLElement {
  const rows = [...block.children];
  const firstCardIndex = rows.findIndex(isCardRow);
  if (firstCardIndex < 0) return block;

  const introRows = rows.slice(0, firstCardIndex);
  const cardRows = rows.slice(firstCardIndex);
  const intro = buildIntro(introRows);
  const { anchorId } = intro.dataset;
  if (anchorId) block.id = anchorId;
  delete intro.dataset.anchorId;

  const list = document.createElement('ul');
  list.className = 'destination-cards-list';
  cardRows.forEach((row) => list.append(buildCard(row)));
  const carousel = document.createElement('div');
  carousel.className = 'destination-cards-carousel';
  carousel.append(list);
  if (cardRows.length > 1) {
    carousel.classList.add('destination-cards-carousel-with-controls');
    carousel.append(buildCarouselControls(list));
  }
  block.replaceChildren(intro, carousel);
  return block;
}
