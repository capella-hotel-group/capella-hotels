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

  // Content Column (Name, Quote, Description, CTA)
  const contentCol = document.createElement('div');
  contentCol.className = 'destination-tabs-content-col';

  if (cfData.name) {
    const nameEl = document.createElement('p');
    nameEl.className = 'destination-tabs-culturist-name';
    nameEl.textContent = cfData.name;
    contentCol.append(nameEl);
  }

  if (cfData.quote?.html) {
    const quoteEl = document.createElement('blockquote');
    quoteEl.className = 'destination-tabs-quote';
    quoteEl.innerHTML = cfData.quote.html;
    contentCol.append(quoteEl);
  }

  if (cfData.description?.html) {
    const descEl = document.createElement('div');
    descEl.className = 'destination-tabs-description';
    descEl.innerHTML = cfData.description.html;
    contentCol.append(descEl);
  }

  slot.append(contentCol);
}

async function renderGalleryCards(slot1, slot2, cfPath) {
  const cfData = await fetchCFDetails(cfPath);

  if (!cfData || !cfData.cardContentReference || cfData.cardContentReference.length < 2) {
    slot1.textContent = 'No content';
    slot2.textContent = 'No content';
    return;
  }

  // Card 1
  slot1.innerHTML = '';
  const card1 = cfData.cardContentReference[0];
  const { _path: card1ImgPath } = card1.image || {};
  if (card1ImgPath) {
    const card1Img = document.createElement('img');
    card1Img.className = 'destination-tabs-card-slot-img';
    card1Img.src = resolveAssetUrl(card1ImgPath);
    card1Img.alt = card1.title || 'Gallery card';
    slot1.append(card1Img);
  }
  if (card1.title) {
    const card1Title = document.createElement('span');
    card1Title.className = 'destination-tabs-card-title';
    card1Title.textContent = card1.title;
    slot1.append(card1Title);
  }

  // Card 2
  slot2.innerHTML = '';
  const card2 = cfData.cardContentReference[1];
  const { _path: card2ImgPath } = card2.image || {};
  if (card2ImgPath) {
    const card2Img = document.createElement('img');
    card2Img.className = 'destination-tabs-card-slot-img';
    card2Img.src = resolveAssetUrl(card2ImgPath);
    card2Img.alt = card2.title || 'Gallery card';
    slot2.append(card2Img);
  }
  if (card2.title) {
    const card2Title = document.createElement('span');
    card2Title.className = 'destination-tabs-card-title';
    card2Title.textContent = card2.title;
    slot2.append(card2Title);
  }
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

  // Culturist info slot
  const infoSlot = document.createElement('div');
  infoSlot.className = 'destination-tabs-info-slot';

  // Card slots
  const cardSlot1 = document.createElement('div');
  cardSlot1.className = 'destination-tabs-card-slot-1';

  const cardSlot2 = document.createElement('div');
  cardSlot2.className = 'destination-tabs-card-slot-2';

  let currentTabIndex = 0;

  const updateDestinationBtn = () => {
    const tabCells = itemRows[currentTabIndex]?.querySelectorAll(':scope > div');
    const tabNameText = (tabCells && tabCells[0]) ? tabCells[0].textContent.trim() : `Destination ${currentTabIndex + 1}`;
    destinationBtn.textContent = tabNameText || `Destination ${currentTabIndex + 1}`;
  };

  updateDestinationBtn();
  destinationBtn.addEventListener('click', async () => {
    currentTabIndex = (currentTabIndex + 1) % itemRows.length;
    updateDestinationBtn();

    const cfRef = itemRows[currentTabIndex]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
    if (cfRef) {
      await renderCulturistInfo(infoSlot, cfRef);
      await renderGalleryCards(cardSlot1, cardSlot2, cfRef);
    }
  });

  titleBlock.append(destinationBtn);

  const titleBottom = document.createElement('div');
  titleBottom.className = 'destination-tabs-title-bottom';
  titleBottom.textContent = 'CULTURIST';
  titleBlock.append(titleBottom);

  infoCol.append(titleBlock);
  infoCol.append(infoSlot);

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

    infoCol.append(ctaContainer);
  }

  wrapper.append(infoCol);
  wrapper.append(cardSlot1);
  wrapper.append(cardSlot2);

  // Load initial tab data
  const initialCfRef = itemRows[0]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
  if (initialCfRef) {
    await renderCulturistInfo(infoSlot, initialCfRef);
    await renderGalleryCards(cardSlot1, cardSlot2, initialCfRef);
  }

  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
