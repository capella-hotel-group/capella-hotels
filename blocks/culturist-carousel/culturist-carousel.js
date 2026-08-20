import { moveInstrumentation } from '../../scripts/scripts.js';
import { getPublishBaseUrl } from '../../scripts/env.js';

function resolveAssetUrl(damPath) {
  if (!damPath) return null;
  if (damPath.startsWith('http')) return damPath;
  const publishBase = getPublishBaseUrl();
  return `${publishBase}${damPath}`;
}

async function fetchCFDetails(cfPath) {
  try {
    const publishBase = getPublishBaseUrl();
    const url = `${publishBase}/graphql/execute.json/capella-hotels/TabList;path=${cfPath}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.data?.tabDetailsByPath?.item || null;
  } catch (error) {
    return null;
  }
}

async function renderCulturistInfo(slot, cfPath) {
  const cfData = await fetchCFDetails(cfPath);

  if (!cfData) {
    slot.textContent = 'Failed to load content';
    return;
  }

  slot.innerHTML = '';

  // Avatar + Signature Column
  const photoSigCol = document.createElement('div');
  photoSigCol.className = 'culturist-carousel-photo-sig-col';

  const { _path: avatarPath } = cfData.image || {};
  if (avatarPath) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'culturist-carousel-avatar';
    avatarImg.src = resolveAssetUrl(avatarPath);
    avatarImg.alt = cfData.name || 'Avatar';
    photoSigCol.append(avatarImg);
  }

  const { _path: signaturePath } = cfData.signatureImage || {};
  if (signaturePath) {
    const sigImg = document.createElement('img');
    sigImg.className = 'culturist-carousel-signature';
    sigImg.src = resolveAssetUrl(signaturePath);
    sigImg.alt = `${cfData.name || 'Culturist'} Signature`;
    photoSigCol.append(sigImg);
  }

  slot.append(photoSigCol);

  // Content Column (Quote, Name, Description, CTA)
  const contentCol = document.createElement('div');
  contentCol.className = 'culturist-carousel-content-col';

  if (cfData.quote?.html) {
    const quoteEl = document.createElement('blockquote');
    quoteEl.className = 'culturist-carousel-quote';
    quoteEl.innerHTML = cfData.quote.html;
    contentCol.append(quoteEl);
  }

  if (cfData.name) {
    const nameEl = document.createElement('p');
    nameEl.className = 'culturist-carousel-culturist-name';
    nameEl.textContent = `- ${cfData.name}`;
    contentCol.append(nameEl);
  }

  if (cfData.description?.html) {
    const descEl = document.createElement('div');
    descEl.className = 'culturist-carousel-description';
    descEl.innerHTML = cfData.description.html;
    contentCol.append(descEl);
  }

  slot.append(contentCol);
}

function buildCarouselCard(card) {
  const slide = document.createElement('li');
  slide.className = 'culturist-carousel-carousel-card';

  const { _path: cardImgPath } = card.image || {};
  if (cardImgPath) {
    const cardImg = document.createElement('img');
    cardImg.className = 'culturist-carousel-card-slot-img';
    cardImg.src = resolveAssetUrl(cardImgPath);
    cardImg.alt = card.title || 'Gallery card';
    slide.append(cardImg);
  }
  if (card.title) {
    const cardTitle = document.createElement('span');
    cardTitle.className = 'culturist-carousel-card-title';
    cardTitle.textContent = card.title;
    slide.append(cardTitle);
  }

  return slide;
}

async function renderGalleryCarousel(carouselCol, cfPath) {
  const track = carouselCol.querySelector('.culturist-carousel-carousel-track');
  const prevBtn = carouselCol.querySelector('.culturist-carousel-carousel-prev');
  const nextBtn = carouselCol.querySelector('.culturist-carousel-carousel-next');

  const cfData = await fetchCFDetails(cfPath);
  track.innerHTML = '';

  const cards = cfData?.cardContentReference || [];
  if (!cards.length) {
    track.textContent = 'No content';
    carouselCol.classList.add('culturist-carousel-carousel--empty');
    return;
  }

  carouselCol.classList.remove('culturist-carousel-carousel--empty');
  cards.forEach((card) => track.append(buildCarouselCard(card)));

  const hasMultiple = cards.length > 2;
  prevBtn.hidden = !hasMultiple;
  nextBtn.hidden = !hasMultiple;

  const scrollByCard = (direction) => {
    const card = track.querySelector('.culturist-carousel-carousel-card');
    if (!card) return;
    const amount = card.getBoundingClientRect().width + 4;
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  prevBtn.onclick = () => scrollByCard(-1);
  nextBtn.onclick = () => scrollByCard(1);
}

export default async function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Detect if first row is an image (backwards compatibility with old authored blocks)
  let firstDataRowIndex = 0;
  const hasImage = rows[0]?.querySelector('picture, img');
  if (hasImage) {
    firstDataRowIndex = 1; // Skip the image row
  }

  const ctaLabelRow = rows[firstDataRowIndex + 1];
  const ctaLinkRow = rows[firstDataRowIndex + 2];
  const itemRows = rows.slice(firstDataRowIndex + 3).filter((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    return cells.some((cell) => cell.textContent.trim() !== '');
  });

  if (!itemRows.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'culturist-carousel-grid';

  // Left column: culturist info + title + CTA
  const infoCol = document.createElement('div');
  infoCol.className = 'culturist-carousel-info-col';

  // Title block (MEET YOUR [DESTINATION] CULTURIST)
  const titleBlock = document.createElement('div');
  titleBlock.className = 'culturist-carousel-title-block';

  const titleTop = document.createElement('div');
  titleTop.className = 'culturist-carousel-title-top';
  titleTop.textContent = 'MEET YOUR';
  titleBlock.append(titleTop);

  const destinationBtn = document.createElement('button');
  destinationBtn.className = 'culturist-carousel-destination-btn';
  destinationBtn.setAttribute('type', 'button');

  // Invisible spacer mirrors the arrow's width so the label stays visually centered
  const destinationSpacer = document.createElement('span');
  destinationSpacer.className = 'culturist-carousel-destination-arrow culturist-carousel-destination-arrow--spacer';
  destinationSpacer.setAttribute('aria-hidden', 'true');
  destinationSpacer.textContent = '⌄';
  destinationBtn.append(destinationSpacer);

  const destinationLabel = document.createElement('span');
  destinationLabel.className = 'culturist-carousel-destination-label';
  destinationBtn.append(destinationLabel);

  const destinationArrow = document.createElement('span');
  destinationArrow.className = 'culturist-carousel-destination-arrow';
  destinationArrow.setAttribute('aria-hidden', 'true');
  destinationArrow.textContent = '⌄';
  destinationBtn.append(destinationArrow);

  // Culturist info slot
  const infoSlot = document.createElement('div');
  infoSlot.className = 'culturist-carousel-info-slot';

  // Panel wraps the avatar/quote row + CTA, so tablet can background just this part
  const panel = document.createElement('div');
  panel.className = 'culturist-carousel-panel';
  panel.append(infoSlot);

  // Carousel column (replaces the previous two static card slots)
  const carouselCol = document.createElement('div');
  carouselCol.className = 'culturist-carousel-carousel-col';

  const carouselTrack = document.createElement('ul');
  carouselTrack.className = 'culturist-carousel-carousel-track';
  carouselCol.append(carouselTrack);

  const carouselPrevBtn = document.createElement('button');
  carouselPrevBtn.type = 'button';
  carouselPrevBtn.className = 'culturist-carousel-carousel-prev';
  carouselPrevBtn.setAttribute('aria-label', 'Previous cards');
  carouselCol.append(carouselPrevBtn);

  const carouselNextBtn = document.createElement('button');
  carouselNextBtn.type = 'button';
  carouselNextBtn.className = 'culturist-carousel-carousel-next';
  carouselNextBtn.setAttribute('aria-label', 'Next cards');
  carouselCol.append(carouselNextBtn);

  let currentTabIndex = 0;

  const updateDestinationBtn = () => {
    const tabCells = itemRows[currentTabIndex]?.querySelectorAll(':scope > div');
    const tabNameText = (tabCells && tabCells[0]) ? tabCells[0].textContent.trim() : `Destination ${currentTabIndex + 1}`;
    destinationLabel.textContent = tabNameText || `Destination ${currentTabIndex + 1}`;
  };

  updateDestinationBtn();
  destinationBtn.addEventListener('click', async () => {
    currentTabIndex = (currentTabIndex + 1) % itemRows.length;
    updateDestinationBtn();

    const cfRef = itemRows[currentTabIndex]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
    if (cfRef) {
      await renderCulturistInfo(infoSlot, cfRef);
      await renderGalleryCarousel(carouselCol, cfRef);
    }
  });

  titleBlock.append(destinationBtn);

  const titleBottom = document.createElement('div');
  titleBottom.className = 'culturist-carousel-title-bottom';
  titleBottom.textContent = 'CULTURIST';
  titleBlock.append(titleBottom);

  infoCol.append(titleBlock);
  infoCol.append(panel);

  // CTA
  const ctaLabelText = ctaLabelRow?.textContent?.trim() || 'EXPLORE';
  const ctaLinkEl = ctaLinkRow?.querySelector('a');
  const ctaHref = ctaLinkEl?.getAttribute('href') || ctaLinkRow?.textContent?.trim() || '#';

  if (ctaLabelText && ctaLabelText !== ctaHref) {
    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'culturist-carousel-cta';

    const cta = document.createElement('a');
    cta.className = 'culturist-carousel-cta-link';
    cta.href = ctaHref;
    cta.textContent = ctaLabelText;
    ctaContainer.append(cta);

    panel.append(ctaContainer);
  }

  wrapper.append(infoCol);
  wrapper.append(carouselCol);

  // Load initial tab data
  const initialCfRef = itemRows[0]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
  if (initialCfRef) {
    await renderCulturistInfo(infoSlot, initialCfRef);
    await renderGalleryCarousel(carouselCol, initialCfRef);
  }

  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
