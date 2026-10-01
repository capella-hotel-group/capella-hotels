import { moveInstrumentation } from '@/app/scripts.js';
import { createCarouselControls } from './carousel.js';

function stripHtml(html: string): string {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  return wrapper.textContent?.trim() ?? '';
}

// richtext fields (title/headline) author line breaks as <p> paragraphs or <br> inside a
// single paragraph; flatten both into '\n'-joined plain text (CSS applies white-space: pre-line).
function textFromCell(cell?: Element | null): string {
  if (!cell) return '';
  const paragraphs = [...cell.querySelectorAll('p')];
  const sources = paragraphs.length ? paragraphs.map((p) => p.innerHTML) : [cell.innerHTML];
  const lines = sources
    .flatMap((html) => html.split(/<br\s*\/?>/i))
    .map(stripHtml)
    .filter(Boolean);
  return lines.length ? lines.join('\n') : (cell.textContent?.trim() ?? '');
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
  return !!row.querySelector('picture, img');
}

function getCellByProp(cells: Element[], property: string): Element | undefined {
  return cells.find(
    (cell) => cell.getAttribute('data-aue-prop') === property || !!cell.querySelector(`[data-aue-prop="${property}"]`),
  );
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
  const ctaLinkCell = getCellByProp(cells, 'ctaLink');
  const ctaLabelCell = getCellByProp(cells, 'ctaName');
  const openInNewTabCell = getCellByProp(cells, 'openInNewTab');
  const darkOverlayCell = getCellByProp(cells, 'darkOverlay');
  const imageAltCell = getCellByProp(cells, 'imageAlt');
  const isNewModelOrder = !!ctaLinkCell;
  const fallbackCtaLinkCell = isNewModelOrder ? cells[5] : cells[linkIndex];
  // ctaName is authored right before ctaLink, not after it
  const fallbackCtaLabelCell = isNewModelOrder ? cells[4] : cells[linkIndex - 1];
  const hasLegacyAltField = !isNewModelOrder && linkIndex >= 5;
  const cta = getLinkFromCell(ctaLinkCell || fallbackCtaLinkCell);

  return {
    location: textFromCell(cells[0]),
    title: textFromCell(cells[1]),
    image: cells[2]?.querySelector('picture, img'),
    imageAlt: imageAltCell
      ? textFromCell(imageAltCell)
      : isNewModelOrder || hasLegacyAltField
        ? textFromCell(cells[3])
        : null,
    href: cta.href,
    ctaLabel: textFromCell(ctaLabelCell || fallbackCtaLabelCell) || cta.label,
    // cell order after the CTA link is: openInNewTab, darkOverlay
    openInNewTab: isEnabled(openInNewTabCell || cells[isNewModelOrder ? 6 : linkIndex + 1], false),
    darkOverlay: isEnabled(darkOverlayCell || cells[isNewModelOrder ? 7 : linkIndex + 2], true),
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

function buildCta(label: string): HTMLSpanElement | null {
  if (!label) return null;
  const cta = document.createElement('span');
  cta.className = 'destination-cards-cta';
  cta.textContent = label;
  return cta;
}

function setupCarousel(carousel: HTMLDivElement, list: HTMLUListElement, label: string): void {
  carousel.classList.add('destination-cards-carousel-with-controls');
  const controls = createCarouselControls({
    track: list,
    itemSelector: '.destination-cards-item',
    classNames: {
      controls: 'destination-cards-controls',
      control: 'destination-cards-control',
      controlPrev: 'destination-cards-control-prev',
      controlNext: 'destination-cards-control-next',
    },
    labels: {
      track: label || 'Destinations',
      previous: 'Previous destination card',
      next: 'Next destination card',
    },
  });
  carousel.append(controls);
}

function buildCard(row: Element): HTMLLIElement {
  const fields = getCardFields(row);
  const cta = buildCta(fields.ctaLabel);
  const item = document.createElement('li');
  item.className = 'destination-cards-item';
  moveInstrumentation(row, item);

  const article = document.createElement('article');
  article.className = 'destination-cards-card';

  // Single link per card (media + CTA share one destination) to avoid duplicate tab stops.
  const cardLink = fields.href ? document.createElement('a') : document.createElement('div');
  cardLink.className = 'destination-cards-card-link';
  if (fields.href && cardLink instanceof HTMLAnchorElement) {
    setLinkAttributes(cardLink, fields.href, fields.openInNewTab);
  }

  const media = document.createElement('figure');
  media.className = 'destination-cards-media';
  if (!fields.darkOverlay) media.classList.add('destination-cards-media-no-overlay');

  if (fields.image) {
    const mediaNode =
      fields.image.tagName.toLowerCase() === 'picture' ? fields.image : fields.image.closest('picture') || fields.image;
    const imageElement =
      mediaNode.querySelector('img') || (mediaNode.tagName === 'IMG' ? (mediaNode as HTMLImageElement) : null);
    if (imageElement && fields.imageAlt !== null) imageElement.alt = fields.imageAlt;
    media.append(mediaNode);
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
  media.append(overlay);

  cardLink.append(media);
  if (cta) {
    const footer = document.createElement('div');
    footer.className = 'destination-cards-footer';
    footer.append(cta);
    cardLink.append(footer);
  }
  article.append(cardLink);
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
  const authoredAnchorId = block.querySelector('[data-aue-prop="id"]')?.textContent?.trim();
  const resolvedAnchorId = authoredAnchorId || anchorId;
  if (resolvedAnchorId) block.id = resolvedAnchorId.replace(/^#/, '');
  delete intro.dataset.anchorId;

  const list = document.createElement('ul');
  list.className = 'destination-cards-list';
  cardRows.forEach((row) => list.append(buildCard(row)));
  const carousel = document.createElement('div');
  carousel.className = 'destination-cards-carousel';
  carousel.append(list);
  block.replaceChildren(intro, carousel);
  // matches the Figma component variants: 3 cards or fewer stay a static row, more than 3
  // becomes a carousel with prev/next controls
  if (cardRows.length > 3) {
    const title = intro.querySelector('.destination-cards-title')?.textContent?.trim() || '';
    setupCarousel(carousel, list, title);
  }
  return block;
}
