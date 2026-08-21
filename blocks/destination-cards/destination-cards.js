import { moveInstrumentation } from '../../scripts/scripts.js';

function textFromCell(cell) {
  if (!cell) return '';
  const textNodes = [...cell.children]
    .map((child) => child.textContent.trim())
    .filter(Boolean);
  return textNodes.length > 1 ? textNodes.join('\n') : cell.textContent.trim();
}

function textFromPart(cell, index) {
  return textFromCell([...cell?.children || []][index] || cell);
}

function isEnabled(value, fallback = false) {
  const text = typeof value === 'string' ? value : textFromCell(value);
  if (!text) return fallback;
  return ['true', 'yes', 'enabled'].includes(text.trim().toLowerCase());
}

function setLinkAttributes(link, href, openInNewTab = false) {
  link.href = href;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
}

function getLinkFromCell(cell) {
  const authoredLink = cell?.querySelector('a');
  return {
    href: authoredLink?.getAttribute('href') || textFromCell(cell),
    label: authoredLink?.textContent?.trim() || textFromCell(cell),
  };
}

function getIntroRows(rows) {
  const firstCardIndex = rows.findIndex((row) => row.children.length > 1);
  return firstCardIndex >= 0 ? rows.slice(0, firstCardIndex) : rows;
}

function getCardFields(row) {
  const cells = [...row.children];
  const isGroupedModel = cells.length <= 4 && cells[1]?.querySelector('picture, img');

  if (isGroupedModel) {
    const [contentCell, mediaCell, ctaCell, settingsCell] = cells;
    const cta = getLinkFromCell(ctaCell);
    const settingsParts = [...settingsCell?.children || []];

    return {
      location: textFromPart(contentCell, 0),
      title: textFromPart(contentCell, 1),
      image: mediaCell.querySelector('picture, img'),
      imageAlt: mediaCell.querySelector('img')?.getAttribute('alt') || textFromPart(mediaCell, 1),
      href: cta.href,
      ctaLabel: cta.label,
      darkOverlay: isEnabled(settingsParts[0] || settingsCell, true),
      openInNewTab: isEnabled(settingsParts[1], false),
    };
  }

  const linkIndex = cells.findIndex((cell, index) => index > 2 && cell.querySelector('a'));
  const hasLegacyAltField = linkIndex >= 5;
  const ctaLabelCell = linkIndex > 3 ? cells[linkIndex - 1] : null;
  const cta = getLinkFromCell(cells[linkIndex]);

  return {
    location: textFromCell(cells[0]),
    title: textFromCell(cells[1]),
    image: cells[2]?.querySelector('picture, img'),
    imageAlt: hasLegacyAltField ? textFromCell(cells[3]) : null,
    href: cta.href,
    ctaLabel: textFromCell(ctaLabelCell) || cta.label,
    darkOverlay: true,
    openInNewTab: false,
  };
}

function buildIntro(rows) {
  const hasAnchor = rows.length > 2;
  const [anchorRow, titleRow, subtitleRow] = hasAnchor ? rows : [null, ...rows];

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
  if (textFromCell(subtitleCell)) {
    const subtitle = document.createElement('div');
    subtitle.className = 'destination-cards-subtitle';
    while (subtitleCell.firstChild) subtitle.append(subtitleCell.firstChild);
    intro.append(subtitle);
  }

  return intro;
}

function buildCta(label, href, openInNewTab) {
  if (!label && !href) return null;

  const cta = document.createElement('a');
  cta.className = 'destination-cards-cta';
  cta.textContent = label || 'Explore';
  setLinkAttributes(cta, href || '#', openInNewTab);
  return cta;
}

function buildCard(row) {
  const {
    location,
    title,
    image,
    href,
    ctaLabel,
    imageAlt,
    darkOverlay,
    openInNewTab,
  } = getCardFields(row);

  const cta = buildCta(ctaLabel, href, openInNewTab);

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
  if (!darkOverlay) media.classList.add('destination-cards-media-no-overlay');

  const mediaContent = href ? document.createElement('a') : document.createElement('div');
  mediaContent.className = 'destination-cards-media-link';
  if (href) {
    setLinkAttributes(mediaContent, href, openInNewTab);
    mediaContent.setAttribute('aria-label', `${title || location || 'Destination'}: ${ctaLabel || 'Explore'}`);
  }

  if (image) {
    const mediaNode = image.tagName.toLowerCase() === 'picture' ? image : image.closest('picture') || image;
    const imageElement = mediaNode.querySelector('img') || (mediaNode.tagName === 'IMG' ? mediaNode : null);
    if (imageElement && imageAlt !== null) imageElement.alt = imageAlt;
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
  if (!rows.length) return;

  const introRows = getIntroRows(rows);
  const intro = buildIntro(introRows);
  const { anchorId } = intro.dataset;
  if (anchorId) block.id = anchorId;
  delete intro.dataset.anchorId;

  const list = document.createElement('ul');
  list.className = 'destination-cards-list';

  rows.slice(introRows.length).forEach((row) => {
    const card = buildCard(row);
    if (card) list.append(card);
  });

  block.replaceChildren(intro, list);
}
