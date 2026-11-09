import { moveInstrumentation } from '@/app/scripts.js';
import { getPublishBaseUrl } from '@/utils/env.js';

// Keeps combobox/option ids unique when several blocks share a page.
let blockInstanceCount = 0;

// Matches the reference motion: ~3.2s, slow start, gradual settle.
const SLIDE_DURATION_MS = 1200;
const SLIDE_EASING = 'cubic-bezier(0.37, 0, 0.63, 1)';
const SWIPE_THRESHOLD_PX = 40;

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
    const item = data.data?.culturistTabDetailsByPath?.item || null;
    if (!item) {
      console.error(`[culturist-carousel] No culturistTabDetailsByPath item returned for ${cfPath}`, data);
    }
    return item;
  } catch (error) {
    console.error(`[culturist-carousel] Failed to fetch CF details for ${cfPath}`, error);
    return null;
  }
}

function renderCulturistInfo(slot: HTMLElement, cfData: Record<string, any> | null): void {
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

function buildCarouselCard(card: Record<string, any>): HTMLLIElement {
  const slide = document.createElement('li');
  slide.className = 'culturist-carousel-carousel-card';

  const cardHref = resolveLinkHref(card.cardLink, card.cardExternalLink);
  const cardContent: HTMLElement = cardHref ? document.createElement('a') : document.createElement('div');
  cardContent.className = 'culturist-carousel-card-content';
  if (cardContent instanceof HTMLAnchorElement && cardHref) {
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
  const { _path: hoverImgPath } = card.hoverImage || {};
  const hoverDescription: string = card.hoverDescription?.plaintext || '';
  if (hoverImgPath || hoverDescription) {
    cardContent.classList.add('culturist-carousel-card-content--has-hover');
    const hover = document.createElement('div');
    hover.className = 'culturist-carousel-card-hover';
    if (hoverImgPath) {
      const hoverImg = document.createElement('img');
      hoverImg.className = 'culturist-carousel-card-hover-img';
      hoverImg.src = resolveAssetUrl(hoverImgPath) ?? '';
      hoverImg.alt = '';
      hoverImg.loading = 'lazy';
      hover.append(hoverImg);
    }
    if (hoverDescription) {
      const hoverText = document.createElement('p');
      hoverText.className = 'culturist-carousel-card-hover-text';
      hoverText.textContent = hoverDescription;
      hover.append(hoverText);
    }
    cardContent.append(hover);
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

function createGalleryCarousel(
  carouselCol: HTMLElement,
  viewport: HTMLElement,
  track: HTMLElement,
  prevBtn: HTMLButtonElement,
  nextBtn: HTMLButtonElement,
): (cfData: Record<string, any> | null) => void {
  // Track offsets (px) each arrow/swipe step settles on; the last one is clamped so the track never overshoots.
  let positions = [0];
  let index = 0;
  const offsetAt = (i: number): number => positions[i] ?? 0;

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const updateButtons = () => {
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= positions.length - 1;
  };

  const measure = () => {
    const slides = [...track.children] as HTMLElement[];
    const maxOffset = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const offsets = slides.map((slide) => Math.min(slide.offsetLeft, maxOffset));
    positions = offsets.filter((offset, i) => i === 0 || offset > (offsets[i - 1] ?? 0) + 1);
    if (!positions.length) positions = [0];
    index = Math.min(index, positions.length - 1);
    const canNavigate = positions.length > 1;
    viewport.classList.toggle('is-grabbable', canNavigate);
    prevBtn.hidden = !canNavigate;
    nextBtn.hidden = !canNavigate;
    updateButtons();
  };

  const applyTransform = (animate: boolean, dragOffset = 0) => {
    track.style.transition =
      animate && !prefersReducedMotion() ? `transform ${SLIDE_DURATION_MS}ms ${SLIDE_EASING}` : 'none';
    track.style.transform = `translate3d(${dragOffset - offsetAt(index)}px, 0, 0)`;
  };

  // Retargeting mid-transition continues from the current visual position, so rapid clicks never corrupt state.
  const goTo = (target: number, animate = true) => {
    index = Math.max(0, Math.min(target, positions.length - 1));
    updateButtons();
    applyTransform(animate);
  };

  const currentTranslateX = (): number => {
    const { transform } = getComputedStyle(track);
    if (!transform || transform === 'none' || typeof DOMMatrixReadOnly === 'undefined') return -offsetAt(index);
    return new DOMMatrixReadOnly(transform).m41;
  };

  prevBtn.addEventListener('click', () => goTo(index - 1));
  nextBtn.addEventListener('click', () => goTo(index + 1));

  carouselCol.addEventListener('keydown', (event) => {
    if (!track.contains(event.target as Node)) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    }
  });

  // Focus on an off-screen card makes the browser scroll the clipped viewport; undo that and move the track instead.
  viewport.addEventListener('scroll', () => {
    viewport.scrollLeft = 0;
  });
  track.addEventListener('focusin', (event) => {
    const slide = (event.target as Element).closest<HTMLElement>('.culturist-carousel-carousel-card');
    if (!slide) return;
    const visibleStart = offsetAt(index);
    const fullyVisible =
      slide.offsetLeft >= visibleStart && slide.offsetLeft + slide.offsetWidth <= visibleStart + viewport.clientWidth;
    if (fullyVisible) return;
    const target = positions.reduce((best, offset, i) => (offset <= slide.offsetLeft ? i : best), 0);
    goTo(target);
  });

  // Pointer swipe (touch, pen, mouse with grab cursor): the track follows the pointer, then eases to the neighbouring position.
  let dragStartX: number | null = null;
  let dragBase = 0;
  let dragDelta = 0;
  let suppressClick = false;

  const endDrag = (commit: boolean) => {
    if (dragStartX === null) return;
    dragStartX = null;
    viewport.classList.remove('is-grabbing');
    if (commit && dragDelta <= -SWIPE_THRESHOLD_PX) goTo(index + 1);
    else if (commit && dragDelta >= SWIPE_THRESHOLD_PX) goTo(index - 1);
    else goTo(index);
    suppressClick = Math.abs(dragDelta) > SWIPE_THRESHOLD_PX / 2;
  };

  viewport.addEventListener('pointerdown', (event) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || positions.length < 2) return;
    const visualX = currentTranslateX();
    index = positions.reduce(
      (best, offset, i) => (Math.abs(offset + visualX) < Math.abs(offsetAt(best) + visualX) ? i : best),
      0,
    );
    dragBase = visualX + offsetAt(index);
    dragStartX = event.clientX;
    dragDelta = 0;
    viewport.classList.add('is-grabbing');
    applyTransform(false, dragBase);
  });
  viewport.addEventListener('pointermove', (event) => {
    if (dragStartX === null) return;
    dragDelta = event.clientX - dragStartX;
    // Capture only once it's a real drag, so a plain click still reaches the card link.
    if (Math.abs(dragDelta) > 5 && !viewport.hasPointerCapture(event.pointerId)) {
      viewport.setPointerCapture(event.pointerId);
    }
    applyTransform(false, dragBase + dragDelta);
  });
  viewport.addEventListener('pointerup', () => endDrag(true));
  viewport.addEventListener('pointercancel', () => endDrag(false));
  viewport.addEventListener('pointerleave', (event) => {
    if (!viewport.hasPointerCapture(event.pointerId)) endDrag(false);
  });
  // Stop the browser's native image/link drag from hijacking a mouse swipe.
  viewport.addEventListener('dragstart', (event) => event.preventDefault());
  viewport.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      measure();
      applyTransform(false);
    }).observe(viewport);
  }

  return (cfData) => {
    // Skip any null/empty entries so one bad card doesn't break the rest
    const cards: Record<string, any>[] = (cfData?.cardContentReference || []).filter(Boolean);
    index = 0;
    if (!cards.length) {
      track.textContent = 'No content';
      carouselCol.classList.add('culturist-carousel-carousel--empty');
      measure();
      applyTransform(false);
      return;
    }

    carouselCol.classList.remove('culturist-carousel-carousel--empty');
    const slides: HTMLLIElement[] = [];
    cards.forEach((card) => {
      try {
        slides.push(buildCarouselCard(card));
      } catch (error) {
        console.error('[culturist-carousel] Skipping malformed card', card, error);
      }
    });
    track.replaceChildren(...slides);
    measure();
    applyTransform(false);
  };
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
  const instanceId = (blockInstanceCount += 1);
  const destinationListId = `culturist-carousel-destination-list-${instanceId}`;
  const destinationOptionId = (index: number) => `culturist-carousel-destination-option-${instanceId}-${index}`;

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
  if (hasMultipleDestinations) {
    destinationBtn.setAttribute('role', 'combobox');
    destinationBtn.setAttribute('aria-haspopup', 'listbox');
    destinationBtn.setAttribute('aria-controls', destinationListId);
    destinationBtn.setAttribute('aria-expanded', 'false');
    destinationBtn.setAttribute('aria-label', 'Select destination');
  } else {
    destinationBtn.disabled = true;
  }

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
  destinationList.id = destinationListId;
  destinationList.setAttribute('role', 'listbox');

  const destinationOptions: HTMLLIElement[] = [];

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

  const carouselViewport = document.createElement('div');
  carouselViewport.className = 'culturist-carousel-carousel-viewport';

  const carouselTrack = document.createElement('ul');
  carouselTrack.className = 'culturist-carousel-carousel-track';
  carouselViewport.append(carouselTrack);
  carouselCol.append(carouselViewport);

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

  const renderGallery = createGalleryCarousel(
    carouselCol,
    carouselViewport,
    carouselTrack,
    carouselPrevBtn,
    carouselNextBtn,
  );

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

  const applyOverlay = (index: number) => {
    const overlayText = itemRows[index]?.querySelectorAll(':scope > div')[2]?.textContent?.trim().toLowerCase() ?? '';
    const showOverlay = overlayText !== 'false' && overlayText !== 'no';
    carouselCol.classList.toggle('culturist-carousel-carousel-col--no-overlay', !showOverlay);
  };

  const selectTab = async (index: number) => {
    currentTabIndex = index;
    updateDestinationBtn();

    // Bump the generation so a slower, superseded call can detect it's stale and bail out below.
    const generation = ++selectTabGeneration;

    const cfRef = itemRows[currentTabIndex]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
    if (!cfRef) return;

    // Previous destination stays on screen until the new data arrives, then both columns swap in the same frame.
    const cfData = await fetchCFDetails(cfRef);
    if (generation !== selectTabGeneration) return;

    renderCulturistInfo(infoSlot, cfData);
    renderGallery(cfData);
    applyOverlay(currentTabIndex);
  };

  updateDestinationBtn();

  // Highlight while the listbox is open; stays separate from currentTabIndex so arrow keys
  // never trigger a destination fetch - only Enter/Space/Tab commit the highlight.
  let activeIndex = 0;
  let closeTimer: number | undefined;
  // `hidden` only flips after the 200ms fade-out, so it can't be used to test open-ness.
  let isListOpen = false;

  const setActiveIndex = (index: number) => {
    activeIndex = Math.max(0, Math.min(index, destinationOptions.length - 1));
    destinationOptions.forEach((option, optionIndex) => {
      option.classList.toggle('is-active', optionIndex === activeIndex);
    });
    const activeOption = destinationOptions[activeIndex];
    if (!activeOption) return;
    destinationBtn.setAttribute('aria-activedescendant', activeOption.id);
    activeOption.scrollIntoView({ block: 'nearest' });
  };

  const closeDestinationList = () => {
    if (!isListOpen) return;
    isListOpen = false;
    destinationDropdown.classList.remove('is-open');
    destinationBtn.setAttribute('aria-expanded', 'false');
    destinationBtn.removeAttribute('aria-activedescendant');
    destinationOptions.forEach((option) => option.classList.remove('is-active'));
    closeTimer = window.setTimeout(() => {
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
    if (isListOpen) return;
    isListOpen = true;
    // Without this, a close that is still inside its 200ms fade-out would hide the reopened list.
    window.clearTimeout(closeTimer);
    destinationDropdown.hidden = false;
    destinationBtn.setAttribute('aria-expanded', 'true');
    setActiveIndex(currentTabIndex);
    requestAnimationFrame(() => {
      destinationDropdown.classList.add('is-open');
      updateDestinationScrollbar();
    });
  };

  const commitActiveOption = () => {
    closeDestinationList();
    if (activeIndex !== currentTabIndex) {
      void selectTab(activeIndex);
    }
  };

  itemRows.forEach((row, index) => {
    const tabCells = row.querySelectorAll(':scope > div');
    const tabNameText = tabCells[0] ? tabCells[0].textContent?.trim() : `Destination ${index + 1}`;

    const listItem = document.createElement('li');
    listItem.className = 'culturist-carousel-destination-option';
    listItem.id = destinationOptionId(index);
    listItem.setAttribute('role', 'option');
    listItem.setAttribute('aria-selected', 'false');
    moveInstrumentation(row, listItem);
    listItem.textContent = tabNameText || `Destination ${index + 1}`;

    listItem.addEventListener('click', async () => {
      setActiveIndex(index);
      closeDestinationList();
      destinationBtn.focus();
      if (index !== currentTabIndex) {
        await selectTab(index);
      }
    });

    destinationOptions.push(listItem);
    destinationList.append(listItem);
  });

  destinationList.addEventListener('scroll', updateDestinationScrollbar);

  updateDestinationBtn();

  destinationBtn.addEventListener('click', () => {
    if (!hasMultipleDestinations) return;
    if (isListOpen) {
      closeDestinationList();
    } else {
      openDestinationList();
    }
  });

  destinationBtn.addEventListener('keydown', (event) => {
    if (!hasMultipleDestinations) return;

    if (!isListOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Spacebar'].includes(event.key)) {
        event.preventDefault();
        openDestinationList();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(activeIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(destinationOptions.length - 1);
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        event.preventDefault();
        commitActiveOption();
        break;
      case 'Tab':
        // No preventDefault: the APG select-only combobox commits the highlight, then lets focus move on.
        commitActiveOption();
        break;
      case 'Escape':
        event.preventDefault();
        closeDestinationList();
        break;
      default:
        break;
    }
  });

  document.addEventListener('click', (event) => {
    if (!destinationWrapper.contains(event.target as Node)) {
      closeDestinationList();
    }
  });

  // Escape from anywhere else on the page; the trigger's own handler marks its Escape as handled.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
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

  applyOverlay(0);

  // Load initial tab data
  const initialCfRef = itemRows[0]?.querySelectorAll(':scope > div')[1]?.textContent?.trim() || '';
  if (initialCfRef) {
    const initialData = await fetchCFDetails(initialCfRef);
    renderCulturistInfo(infoSlot, initialData);
    renderGallery(initialData);
  }

  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
