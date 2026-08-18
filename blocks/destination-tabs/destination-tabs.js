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
  photoSigCol.className = 'destination-tabs-photo-sig-col';

  const { _path: avatarPath } = cfData.image || {};
  if (avatarPath) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'destination-tabs-avatar';
    avatarImg.src = resolveAssetUrl(avatarPath);
    avatarImg.alt = cfData.name || 'Avatar';
    photoSigCol.append(avatarImg);
  }

  const { _path: signaturePath } = cfData.signatureImage || {};
  if (signaturePath) {
    const sigImg = document.createElement('img');
    sigImg.className = 'destination-tabs-signature';
    sigImg.src = resolveAssetUrl(signaturePath);
    sigImg.alt = `${cfData.name || 'Culturist'} Signature`;
    photoSigCol.append(sigImg);
  }

  slot.append(photoSigCol);

  // Content Column (Quote, Name, Description, CTA)
  const contentCol = document.createElement('div');
  contentCol.className = 'destination-tabs-content-col';

  if (cfData.quote?.html) {
    const quoteEl = document.createElement('blockquote');
    quoteEl.className = 'destination-tabs-quote';
    quoteEl.innerHTML = cfData.quote.html;
    contentCol.append(quoteEl);
  }

  if (cfData.name) {
    const nameEl = document.createElement('p');
    nameEl.className = 'destination-tabs-culturist-name';
    nameEl.textContent = `- ${cfData.name}`;
    contentCol.append(nameEl);
  }

  if (cfData.description?.html) {
    const descEl = document.createElement('div');
    descEl.className = 'destination-tabs-description';
    descEl.innerHTML = cfData.description.html;
    contentCol.append(descEl);
  }

  slot.append(contentCol);
}

function buildCarouselCard(card) {
  const slide = document.createElement('li');
  slide.className = 'destination-tabs-carousel-card';

  const { _path: cardImgPath } = card.image || {};
  if (cardImgPath) {
    const cardImg = document.createElement('img');
    cardImg.className = 'destination-tabs-card-slot-img';
    cardImg.src = resolveAssetUrl(cardImgPath);
    cardImg.alt = card.title || 'Gallery card';
    slide.append(cardImg);
  }
  if (card.title) {
    const cardTitle = document.createElement('span');
    cardTitle.className = 'destination-tabs-card-title';
    cardTitle.textContent = card.title;
    slide.append(cardTitle);
  }

  return slide;
}

async function renderGalleryCarousel(carouselCol, cfPath) {
  const track = carouselCol.querySelector('.destination-tabs-carousel-track');
  const prevBtn = carouselCol.querySelector('.destination-tabs-carousel-prev');
  const nextBtn = carouselCol.querySelector('.destination-tabs-carousel-next');

  const cfData = await fetchCFDetails(cfPath);
  track.innerHTML = '';

  const cards = cfData?.cardContentReference || [];
  if (!cards.length) {
    track.textContent = 'No content';
    carouselCol.classList.add('destination-tabs-carousel--empty');
    return;
  }

  carouselCol.classList.remove('destination-tabs-carousel--empty');
  cards.forEach((card) => track.append(buildCarouselCard(card)));

  const hasMultiple = cards.length > 2;
  prevBtn.hidden = !hasMultiple;
  nextBtn.hidden = !hasMultiple;

  const scrollByCard = (direction) => {
    const card = track.querySelector('.destination-tabs-carousel-card');
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
  wrapper.className = 'destination-tabs-grid';

  // Left column: culturist info + title + CTA
  const infoCol = document.createElement('div');
  infoCol.className = 'destination-tabs-info-col';

  // Title block (MEET YOUR [DESTINATION] CULTURIST)
  const titleBlock = document.createElement('div');
  titleBlock.className = 'destination-tabs-title-block';

  const titleTop = document.createElement('div');
  titleTop.className = 'destination-tabs-title-top';
  titleTop.textContent = 'MEET YOUR';
  titleBlock.append(titleTop);

  const destinationBtn = document.createElement('button');
  destinationBtn.className = 'destination-tabs-destination-btn';
  destinationBtn.setAttribute('type', 'button');

  // Invisible spacer mirrors the arrow's width so the label stays visually centered
  const destinationSpacer = document.createElement('span');
  destinationSpacer.className = 'destination-tabs-destination-arrow destination-tabs-destination-arrow--spacer';
  destinationSpacer.setAttribute('aria-hidden', 'true');
  destinationSpacer.textContent = '⌄';
  destinationBtn.append(destinationSpacer);

  const destinationLabel = document.createElement('span');
  destinationLabel.className = 'destination-tabs-destination-label';
  destinationBtn.append(destinationLabel);

  const destinationArrow = document.createElement('span');
  destinationArrow.className = 'destination-tabs-destination-arrow';
  destinationArrow.setAttribute('aria-hidden', 'true');
  destinationArrow.textContent = '⌄';
  destinationBtn.append(destinationArrow);

  // Culturist info slot
  const infoSlot = document.createElement('div');
  infoSlot.className = 'destination-tabs-info-slot';

  // Panel wraps the avatar/quote row + CTA, so tablet can background just this part
  const panel = document.createElement('div');
  panel.className = 'destination-tabs-panel';
  panel.append(infoSlot);

  // Carousel column (replaces the previous two static card slots)
  const carouselCol = document.createElement('div');
  carouselCol.className = 'destination-tabs-carousel-col';

  const carouselTrack = document.createElement('ul');
  carouselTrack.className = 'destination-tabs-carousel-track';
  carouselCol.append(carouselTrack);

  const carouselPrevBtn = document.createElement('button');
  carouselPrevBtn.type = 'button';
  carouselPrevBtn.className = 'destination-tabs-carousel-prev';
  carouselPrevBtn.setAttribute('aria-label', 'Previous cards');
  carouselCol.append(carouselPrevBtn);

  const carouselNextBtn = document.createElement('button');
  carouselNextBtn.type = 'button';
  carouselNextBtn.className = 'destination-tabs-carousel-next';
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
  titleBottom.className = 'destination-tabs-title-bottom';
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
    ctaContainer.className = 'destination-tabs-cta';

    const cta = document.createElement('a');
    cta.className = 'destination-tabs-cta-link';
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
