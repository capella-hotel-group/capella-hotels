import { moveInstrumentation } from '@/app/scripts.js';
import { getPublishBaseUrl } from '@/utils/env.js';

function resolveAssetUrl(damPath?: string | null): string | null {
  if (!damPath) return null;
  if (damPath.startsWith('http')) return damPath;
  const publishBase = getPublishBaseUrl();
  return `${publishBase}${damPath}`;
}

function resolveLinkHref(internalRef: unknown, externalLink?: string | null): string | null {
  // internalRef may be a plain path string or a reference object like { _path }
  const { _path: refPath } = ((typeof internalRef === 'object' && internalRef) as { _path?: string }) || {};
  const internalPath = typeof internalRef === 'string' ? internalRef : refPath;
  if (internalPath) return resolveAssetUrl(internalPath);
  if (externalLink) return externalLink;
  return null;
}

function applyLinkTarget(anchor: HTMLAnchorElement, openInNewTab?: boolean): void {
  if (!openInNewTab) return;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
}

function isPopupEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function containsBlockquote(html: string): boolean {
  const content = document.createElement('div');
  content.innerHTML = html;
  return Boolean(content.querySelector('blockquote'));
}

function removePlainQuoteMarks(html: string): string {
  return html.replace(/^(\s*<p>)(?:&quot;|")([\s\S]*?)(?:&quot;|")(\s*<\/p>\s*)$/i, '$1$2$3');
}

async function fetchCFDetails(cfPath: string): Promise<Record<string, any> | null> {
  try {
    const publishBase = getPublishBaseUrl();
    const url = `${publishBase}/graphql/execute.json/capella-hotels/TabList;path=${cfPath}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.error(`[culturist-carousel] GraphQL request failed (${response.status}) for ${cfPath}`);
      return null;
    }

    const data = await response.json();
    const item = data.data?.tabDetailsByPath?.item || null;
    if (!item) {
      console.error(`[culturist-carousel] No tabDetailsByPath item returned for ${cfPath}`, data);
    }
    return item;
  } catch (error) {
    console.error(`[culturist-carousel] Failed to fetch CF details for ${cfPath}`, error);
    return null;
  }
}

async function renderCulturistInfo(slot: HTMLElement, cfPath: string): Promise<void> {
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
    avatarImg.src = resolveAssetUrl(avatarPath) ?? '';
    avatarImg.alt = cfData.imageAltText || cfData.name || 'Avatar';
    photoSigCol.append(avatarImg);
  }

  const { _path: signaturePath } = cfData.signatureImage || {};
  if (signaturePath) {
    const sigImg = document.createElement('img');
    sigImg.className = 'culturist-carousel-signature';
    sigImg.src = resolveAssetUrl(signaturePath) ?? '';
    sigImg.alt = cfData.signatureAltText || `${cfData.name || 'Culturist'} Signature`;
    photoSigCol.append(sigImg);
  }

  slot.append(photoSigCol);

  // Content Column (Quote, Name, Description, CTA)
  const contentCol = document.createElement('div');
  contentCol.className = 'culturist-carousel-content-col';

  // Scrollable area holds the quote/name/description; CTA stays outside so it's always visible
  const contentScroll = document.createElement('div');
  contentScroll.className = 'culturist-carousel-content-scroll';

  if (cfData.quote?.html) {
    const isQuote = containsBlockquote(cfData.quote.html);
    const quoteEl = document.createElement(isQuote ? 'blockquote' : 'div');
    quoteEl.className = isQuote ? 'culturist-carousel-quote' : 'culturist-carousel-quote-content';
    quoteEl.innerHTML = isQuote ? cfData.quote.html : removePlainQuoteMarks(cfData.quote.html);
    contentScroll.append(quoteEl);
  }

  if (cfData.name) {
    const nameEl = document.createElement('p');
    nameEl.className = 'culturist-carousel-culturist-name';
    nameEl.textContent = `- ${cfData.name}`;
    contentScroll.append(nameEl);
  }

  if (cfData.description?.html) {
    const descEl = document.createElement('div');
    descEl.className = 'culturist-carousel-description';
    descEl.innerHTML = cfData.description.html;
    contentScroll.append(descEl);
  }

  contentCol.append(contentScroll);

  const ctaHref = resolveLinkHref(cfData.ctaLink, cfData.ctaExternalLink);
  if (cfData.ctaLabel && ctaHref) {
    const ctaContainer = document.createElement('div');
    ctaContainer.className = 'culturist-carousel-cta';

    const cta = document.createElement('a');
    cta.className = 'culturist-carousel-cta-link';
    cta.href = ctaHref;
    cta.textContent = cfData.ctaLabel;
    applyLinkTarget(cta, cfData.ctaOpenInNewTab ?? false);
    ctaContainer.append(cta);

    contentCol.append(ctaContainer);
  }

  slot.append(contentCol);
}

function buildCardModal(root: HTMLElement): { openModal: (card: Record<string, any>) => void } {
  const modal = document.createElement('div');
  modal.className = 'culturist-carousel-card-modal';
  modal.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'culturist-carousel-card-modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'culturist-carousel-card-modal-close';
  closeBtn.setAttribute('aria-label', 'Close popup');

  const image = document.createElement('img');
  image.className = 'culturist-carousel-card-modal-image';

  const title = document.createElement('p');
  title.className = 'culturist-carousel-card-modal-title';

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('culturist-carousel-modal-open');
  };

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  panel.append(closeBtn, image, title);
  modal.append(panel);
  root.append(modal);

  const openModal = (card: Record<string, any>) => {
    const { _path: cardImgPath } = card.image || {};
    // Nothing to show a popup for; keep the modal closed instead of an empty white box.
    if (!cardImgPath && !card.title) return;

    image.hidden = !cardImgPath;
    if (cardImgPath) {
      image.src = resolveAssetUrl(cardImgPath) ?? '';
      image.alt = card.imagealt || card.title || '';
    }
    title.hidden = !card.title;
    title.textContent = card.title || '';
    panel.classList.toggle('culturist-carousel-card-modal-panel--no-image', !cardImgPath);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('culturist-carousel-modal-open');
  };

  return { openModal };
}

function buildCarouselCard(
  card: Record<string, any>,
  openCardModal: (card: Record<string, any>) => void,
): HTMLLIElement {
  const slide = document.createElement('li');
  slide.className = 'culturist-carousel-carousel-card';

  const cardHref = resolveLinkHref(card.cardLink, card.cardExternalLink);
  const openAsPopup = isPopupEnabled(card.openAsPopup);
  let cardContent: HTMLElement;
  if (openAsPopup) {
    const popupButton = document.createElement('button');
    popupButton.type = 'button';
    popupButton.addEventListener('click', () => openCardModal(card));
    cardContent = popupButton;
  } else {
    cardContent = cardHref ? document.createElement('a') : document.createElement('div');
  }
  cardContent.className = 'culturist-carousel-card-content';
  if (!openAsPopup && cardHref && cardContent instanceof HTMLAnchorElement) {
    cardContent.href = cardHref;
    applyLinkTarget(cardContent, card.openInNewTab ?? false);
  }

  const { _path: cardImgPath } = card.image || {};
  if (cardImgPath) {
    const cardImg = document.createElement('img');
    cardImg.className = 'culturist-carousel-card-slot-img';
    cardImg.src = resolveAssetUrl(cardImgPath) ?? '';
    cardImg.alt = card.imagealt || card.title || 'Gallery card';
    cardContent.append(cardImg);
  }
  if (card.title) {
    const cardTitle = document.createElement('span');
    cardTitle.className = 'culturist-carousel-card-title';
    cardTitle.textContent = card.title;
    cardContent.append(cardTitle);
  }

  slide.append(cardContent);
  return slide;
}

async function renderGalleryCarousel(
  carouselCol: HTMLElement,
  cfPath: string,
  openCardModal: (card: Record<string, any>) => void,
): Promise<void> {
  const track = carouselCol.querySelector<HTMLElement>('.culturist-carousel-carousel-track');
  const prevBtn = carouselCol.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-prev');
  const nextBtn = carouselCol.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-next');
  if (!track || !prevBtn || !nextBtn) return;

  const cfData = await fetchCFDetails(cfPath);
  track.innerHTML = '';

  // Skip any null/empty entries so one bad card doesn't break the rest
  const cards: Record<string, any>[] = (cfData?.cardContentReference || []).filter(Boolean);
  if (!cards.length) {
    track.textContent = 'No content';
    carouselCol.classList.add('culturist-carousel-carousel--empty');
    return;
  }

  carouselCol.classList.remove('culturist-carousel-carousel--empty');
  cards.forEach((card) => {
    try {
      track.append(buildCarouselCard(card, openCardModal));
    } catch (error) {
      console.error('[culturist-carousel] Skipping malformed card', card, error);
    }
  });
  track.scrollLeft = 0;

  const hasMultiple = cards.length > 2;
  prevBtn.hidden = !hasMultiple;
  nextBtn.hidden = !hasMultiple;

  const jumpToBoundary = (position: number) => {
    const previousSnapType = track.style.scrollSnapType;
    const previousScrollBehavior = track.style.scrollBehavior;
    track.style.scrollSnapType = 'none';
    track.style.scrollBehavior = 'auto';
    track.scrollLeft = position;
    track.style.scrollSnapType = previousSnapType;
    track.style.scrollBehavior = previousScrollBehavior;
  };

  const scrollByCard = (direction: number) => {
    const card = track.querySelector('.culturist-carousel-carousel-card');
    if (!card) return;
    const amount = card.getBoundingClientRect().width + 4;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    if (direction > 0 && track.scrollLeft >= maxScrollLeft - 1) {
      jumpToBoundary(0);
      return;
    }
    if (direction < 0 && track.scrollLeft <= 0) {
      jumpToBoundary(maxScrollLeft);
      return;
    }
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  };

  // Desktop navigates via the prev/next arrows only; wheel/drag scrolling is a tablet/mobile-only affordance
  const isDesktop = window.matchMedia('(min-width: 1200px)').matches;
  if (!isDesktop && track.dataset.loopEvents !== 'true') {
    let touchStartX: number | null = null;
    let touchStartedAtBoundary = false;
    let isScrollSettled = true;
    let boundaryTimer: number | undefined;
    track.dataset.loopEvents = 'true';

    const wrapAtBoundary = (direction: number): boolean => {
      const maxScrollLeft = track.scrollWidth - track.clientWidth;
      const atEnd = track.scrollLeft >= maxScrollLeft - 1;
      const atStart = track.scrollLeft <= 0;
      if (!isScrollSettled) return false;
      if (direction > 0 && atEnd) {
        jumpToBoundary(0);
        isScrollSettled = false;
        return true;
      }
      if (direction < 0 && atStart) {
        jumpToBoundary(maxScrollLeft);
        isScrollSettled = false;
        return true;
      }
      return false;
    };

    const updateBoundary = () => {
      isScrollSettled = true;
    };

    track.addEventListener('scroll', () => {
      isScrollSettled = false;
      window.clearTimeout(boundaryTimer);
      boundaryTimer = window.setTimeout(updateBoundary, 200);
    });

    track.addEventListener(
      'wheel',
      (event) => {
        if (wrapAtBoundary(event.deltaX || event.deltaY)) event.preventDefault();
      },
      { passive: false },
    );

    track.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') {
        touchStartX = event.clientX;
        const maxScrollLeft = track.scrollWidth - track.clientWidth;
        touchStartedAtBoundary = isScrollSettled && (track.scrollLeft <= 0 || track.scrollLeft >= maxScrollLeft - 1);
      }
    });

    track.addEventListener('pointerup', (event) => {
      if (touchStartX === null) return;
      const direction = touchStartX - event.clientX;
      touchStartX = null;
      if (touchStartedAtBoundary && Math.abs(direction) > 30) wrapAtBoundary(direction);
      touchStartedAtBoundary = false;
    });

    track.addEventListener('pointercancel', () => {
      touchStartX = null;
    });

    track.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' && wrapAtBoundary(1)) event.preventDefault();
      if (event.key === 'ArrowLeft' && wrapAtBoundary(-1)) event.preventDefault();
    });
  }
  prevBtn.onclick = () => scrollByCard(-1);
  nextBtn.onclick = () => scrollByCard(1);
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const idRow = rows.find(
    (row) => row.getAttribute('data-aue-prop') === 'id' || row.querySelector('[data-aue-prop="id"]'),
  );
  const blockId = idRow?.textContent?.trim();
  if (blockId) block.id = blockId;

  // Detect if first row is an image (backwards compatibility with old authored blocks)
  let firstDataRowIndex = 0;
  const hasImage = rows[0]?.querySelector('picture, img');
  if (hasImage) {
    firstDataRowIndex = 1; // Skip the image row
  }

  const titlePrefixRow = rows[firstDataRowIndex];
  const titleSuffixRow = rows[firstDataRowIndex + 1];
  const itemRows = rows.slice(firstDataRowIndex + 2).filter((row) => {
    if (row === idRow) return false;
    const cells = [...row.querySelectorAll(':scope > div')];
    return cells.some((cell) => cell.textContent?.trim() !== '');
  });

  if (!itemRows.length) return;

  const hasMultipleDestinations = itemRows.length > 1;

  const wrapper = document.createElement('div');
  wrapper.className = 'culturist-carousel-grid';

  // Left column: culturist info + title
  const infoCol = document.createElement('div');
  infoCol.className = 'culturist-carousel-info-col';

  // Title block ([PREFIX] [DESTINATION] [SUFFIX])
  const titleBlock = document.createElement('div');
  titleBlock.className = 'culturist-carousel-title-block';

  const titlePrefixText = titlePrefixRow?.textContent?.trim() || '';
  if (titlePrefixText) {
    const titleTop = document.createElement('div');
    titleTop.className = 'culturist-carousel-title-top';
    titleTop.textContent = titlePrefixText;
    titleBlock.append(titleTop);
  }

  // Wrapper positions the dropdown list relative to the button
  const destinationWrapper = document.createElement('div');
  destinationWrapper.className = 'culturist-carousel-destination-wrapper';

  const destinationBtn = document.createElement('button');
  destinationBtn.className = 'culturist-carousel-destination-btn';
  destinationBtn.setAttribute('type', 'button');
  destinationBtn.setAttribute('aria-haspopup', 'listbox');
  destinationBtn.setAttribute('aria-expanded', 'false');

  const destinationLabel = document.createElement('span');
  destinationLabel.className = 'culturist-carousel-destination-label';
  destinationBtn.append(destinationLabel);

  const destinationArrow = document.createElement('span');
  destinationArrow.className = 'culturist-carousel-destination-arrow';
  destinationArrow.setAttribute('aria-hidden', 'true');
  destinationArrow.hidden = !hasMultipleDestinations;
  destinationBtn.append(destinationArrow);

  const destinationList = document.createElement('ul');
  destinationList.className = 'culturist-carousel-destination-list';
  destinationList.setAttribute('role', 'listbox');

  const destinationScrollbar = document.createElement('div');
  destinationScrollbar.className = 'culturist-carousel-destination-scrollbar';
  destinationScrollbar.setAttribute('aria-hidden', 'true');
  destinationScrollbar.hidden = true;
  const destinationScrollbarThumb = document.createElement('span');
  destinationScrollbarThumb.className = 'culturist-carousel-destination-scrollbar-thumb';
  destinationScrollbar.append(destinationScrollbarThumb);

  // Groups the list and its custom scrollbar into a single dropdown box
  const destinationDropdown = document.createElement('div');
  destinationDropdown.className = 'culturist-carousel-destination-dropdown';
  destinationDropdown.hidden = true;
  destinationDropdown.append(destinationList, destinationScrollbar);

  // Culturist info slot
  const infoSlot = document.createElement('div');
  infoSlot.className = 'culturist-carousel-info-slot';

  // Panel wraps the avatar/quote row, so tablet can background just this part
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

  const cardModal = buildCardModal(wrapper);

  let currentTabIndex = 0;
  let selectTabGeneration = 0;

  const updateDestinationBtn = () => {
    const tabCells = itemRows[currentTabIndex]?.querySelectorAll(':scope > div');
    const tabNameText =
      tabCells && tabCells[0] ? tabCells[0].textContent?.trim() : `Destination ${currentTabIndex + 1}`;
    destinationLabel.textContent = tabNameText || `Destination ${currentTabIndex + 1}`;
    destinationList.querySelectorAll('.culturist-carousel-destination-option').forEach((option, index) => {
      option.setAttribute('aria-selected', String(index === currentTabIndex));
    });
  };

  const selectTab = async (index: number) => {
    currentTabIndex = index;
    updateDestinationBtn();

    // Bump the generation so a slower, superseded call can detect it's stale and bail out below.
    const generation = ++selectTabGeneration;

    const cfRef = itemRows[currentTabIndex]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
    if (!cfRef) return;

    infoSlot.classList.add('is-fading');
    carouselCol.classList.add('is-fading');
    await new Promise((resolve) => {
      window.setTimeout(resolve, 280);
    });
    if (generation !== selectTabGeneration) return;

    await renderCulturistInfo(infoSlot, cfRef);
    await renderGalleryCarousel(carouselCol, cfRef, cardModal.openModal);
    if (generation !== selectTabGeneration) return;

    infoSlot.classList.remove('is-fading');
    carouselCol.classList.remove('is-fading');
  };

  updateDestinationBtn();

  const closeDestinationList = () => {
    if (destinationDropdown.hidden) return;
    destinationDropdown.classList.remove('is-open');
    destinationBtn.setAttribute('aria-expanded', 'false');
    window.setTimeout(() => {
      destinationDropdown.hidden = true;
    }, 200);
  };

  const updateDestinationScrollbar = () => {
    const maxScrollTop = destinationList.scrollHeight - destinationList.clientHeight;
    destinationScrollbar.hidden = maxScrollTop <= 0;
    if (maxScrollTop <= 0) return;
    const thumbTravel = 80;
    const thumbOffset = (destinationList.scrollTop / maxScrollTop) * thumbTravel;
    destinationScrollbarThumb.style.transform = `translateY(${thumbOffset}px)`;
  };

  const openDestinationList = () => {
    destinationDropdown.hidden = false;
    destinationBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      destinationDropdown.classList.add('is-open');
      updateDestinationScrollbar();
    });
  };

  itemRows.forEach((row, index) => {
    const tabCells = row.querySelectorAll(':scope > div');
    const tabNameText = tabCells[0] ? tabCells[0].textContent?.trim() : `Destination ${index + 1}`;

    const listItem = document.createElement('li');
    listItem.setAttribute('role', 'option');
    moveInstrumentation(row, listItem);

    const optionBtn = document.createElement('button');
    optionBtn.type = 'button';
    optionBtn.className = 'culturist-carousel-destination-option';
    optionBtn.textContent = tabNameText || `Destination ${index + 1}`;
    optionBtn.addEventListener('click', async () => {
      closeDestinationList();
      if (index !== currentTabIndex) {
        await selectTab(index);
      }
    });

    listItem.append(optionBtn);
    destinationList.append(listItem);
  });

  destinationList.addEventListener('scroll', updateDestinationScrollbar);

  updateDestinationBtn();

  destinationBtn.addEventListener('click', () => {
    if (!hasMultipleDestinations) return;
    if (destinationDropdown.hidden) {
      openDestinationList();
    } else {
      closeDestinationList();
    }
  });

  document.addEventListener('click', (event) => {
    if (!destinationWrapper.contains(event.target as Node)) {
      closeDestinationList();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDestinationList();
    }
  });

  destinationWrapper.append(destinationBtn);
  destinationWrapper.append(destinationDropdown);
  titleBlock.append(destinationWrapper);

  const titleSuffixText = titleSuffixRow?.textContent?.trim() || '';
  if (titleSuffixText) {
    const titleBottom = document.createElement('div');
    titleBottom.className = 'culturist-carousel-title-bottom';
    titleBottom.textContent = titleSuffixText;
    titleBlock.append(titleBottom);
  }

  infoCol.append(titleBlock);
  infoCol.append(panel);

  wrapper.append(infoCol);
  wrapper.append(carouselCol);

  // Load initial tab data
  const initialCfRef = itemRows[0]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
  if (initialCfRef) {
    await renderCulturistInfo(infoSlot, initialCfRef);
    await renderGalleryCarousel(carouselCol, initialCfRef, cardModal.openModal);
  }

  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
