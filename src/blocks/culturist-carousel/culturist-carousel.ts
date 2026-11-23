import { moveInstrumentation } from '@/app/scripts.js';
import { getPublishBaseUrl } from '@/utils/env.js';

// Keeps combobox/option ids unique when several blocks share a page.
let blockInstanceCount = 0;

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

// Card descriptions may arrive as plain text or as a rich-text object; the overlay only needs text
function cardDescriptionText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const { plaintext, html } = (value as { plaintext?: string; html?: string } | null) || {};
  if (plaintext) return plaintext.trim();
  if (!html) return '';
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return (holder.textContent || '').trim();
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
  const location = typeof card.eyebrowLocation === 'string' ? card.eyebrowLocation.trim() : '';
  const description = cardDescriptionText(card.description);
  if (location || card.title || description) {
    const cardText = document.createElement('div');
    cardText.className = 'culturist-carousel-card-text';

    if (location) {
      const cardLocation = document.createElement('span');
      cardLocation.className = 'culturist-carousel-card-location';
      cardLocation.textContent = location;
      cardText.append(cardLocation);
    }

    if (card.title) {
      const cardTitle = document.createElement('span');
      cardTitle.className = 'culturist-carousel-card-title';
      cardTitle.textContent = card.title;
      cardText.append(cardTitle);
    }

    if (description) {
      const cardDescription = document.createElement('p');
      cardDescription.className = 'culturist-carousel-card-description';
      cardDescription.textContent = description;
      cardText.append(cardDescription);
      cardContent.classList.add('culturist-carousel-card-content--has-description');
    }

    cardContent.append(cardText);
  }

  slide.append(cardContent);
  return slide;
}

const CARD_SELECTOR = '.culturist-carousel-carousel-card';
const REAL_CARD_SELECTOR = `${CARD_SELECTOR}:not([data-clone])`;
const SETTLE_DELAY_MS = 120;
const INTERACTION_RESUME_MS = 4000;

interface CarouselNavigator {
  reset: () => void;
}

const navigators = new WeakMap<HTMLElement, CarouselNavigator>();

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

// Includes loop clones: they are scroll positions the track can rest on
function getSlides(track: HTMLElement): HTMLElement[] {
  return [...track.querySelectorAll<HTMLElement>(CARD_SELECTOR)];
}

function getRealSlides(track: HTMLElement): HTMLElement[] {
  return [...track.querySelectorAll<HTMLElement>(REAL_CARD_SELECTOR)];
}

// Loop clones are visual copies: hidden from assistive tech and the tab order, but still clickable
function cloneSlide(slide: HTMLElement): HTMLElement {
  const clone = slide.cloneNode(true) as HTMLElement;
  clone.dataset.clone = '';
  clone.setAttribute('aria-hidden', 'true');
  clone.classList.remove('is-active');
  clone.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'));
  return clone;
}

function slideOffset(track: HTMLElement, slide: HTMLElement): number {
  const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
  const offset = slide.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
  return Math.min(Math.max(0, Math.round(offset)), maxScrollLeft);
}

function nearestSlideIndex(track: HTMLElement, slides: HTMLElement[]): number {
  let nearest = 0;
  let closestDistance = Infinity;
  slides.forEach((slide, index) => {
    const distance = Math.abs(slideOffset(track, slide) - track.scrollLeft);
    if (distance < closestDistance) {
      closestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

// Mobile has no hover, so the leftmost card shows its description by default (design request CAP-114)
function markActiveSlide(track: HTMLElement, activeSlide?: HTMLElement): void {
  track.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((slide) => {
    slide.classList.toggle('is-active', slide === activeSlide);
  });
}

// Scrolls without smooth animation or snap interference, used for resets and re-alignment
function setScrollInstant(track: HTMLElement, left: number): void {
  track.style.scrollSnapType = 'none';
  track.style.scrollBehavior = 'auto';
  track.scrollLeft = left;
  track.style.scrollSnapType = '';
  track.style.scrollBehavior = '';
}

interface CarouselOptions {
  loop: boolean;
  autoplayMs: number;
}

// Author toggles arrive as block classes (classes_loop -> "loop", classes_autoplay -> "autoplay-6s"), never as rows
function readCarouselOptions(block: Element): CarouselOptions {
  const classes = [...block.classList];
  const autoplayClass = classes.map((name) => /^autoplay-(\d+)s$/.exec(name)).find(Boolean);
  const seconds = autoplayClass ? Number(autoplayClass[1]) : 0;
  return {
    loop: classes.includes('loop'),
    autoplayMs: seconds > 0 ? seconds * 1000 : 0,
  };
}

function createNavigator(
  track: HTMLElement,
  prevBtn: HTMLButtonElement,
  nextBtn: HTMLButtonElement,
  options: CarouselOptions,
): CarouselNavigator {
  const carouselCol = track.parentElement as HTMLElement;
  // Index into getSlides() (clones included) of the slide the carousel is at, or animating towards
  let currentIndex = 0;
  // Loop clones before the first real card; 0 when not looping
  let lead = 0;
  let isProgrammatic = false;
  let isTouching = false;
  let settleTimer: number | undefined;
  let frame = 0;

  const realCount = () => getRealSlides(track).length;
  const loops = () => lead > 0;
  const realIndex = () => {
    const count = realCount();
    return count ? (((currentIndex - lead) % count) + count) % count : 0;
  };
  const atStart = () => realIndex() === 0;
  const atEnd = () => realIndex() >= realCount() - 1;

  const updateButtons = () => {
    prevBtn.disabled = !loops() && atStart();
    nextBtn.disabled = !loops() && atEnd();
  };

  // Loop mode surrounds the real cards with whole copies of the set, enough to fill the visible width on each side
  const syncClones = () => {
    const real = getRealSlides(track);
    const count = real.length;
    const logicalIndex = realIndex();
    let perSide = 0;
    if (options.loop && count > 1) {
      const stride = real[1]!.getBoundingClientRect().left - real[0]!.getBoundingClientRect().left;
      const visible = stride > 0 ? Math.ceil(track.clientWidth / stride) : 0;
      perSide = count * Math.ceil((visible + 2) / count);
    }
    const clones = track.querySelectorAll(`${CARD_SELECTOR}[data-clone]`);
    if (clones.length !== perSide * 2) {
      clones.forEach((clone) => clone.remove());
      const before: HTMLElement[] = [];
      const after: HTMLElement[] = [];
      for (let i = 0; i < perSide; i += 1) {
        before.push(cloneSlide(real[i % count]!));
        after.push(cloneSlide(real[i % count]!));
      }
      track.prepend(...before);
      track.append(...after);
    }
    lead = perSide;
    currentIndex = lead + logicalIndex;
    track.classList.toggle('is-looping', loops());
  };

  // Swaps a clone for its identical real card by shifting scrollLeft; the visible picture doesn't change
  const recenter = () => {
    if (!loops()) return;
    const target = lead + realIndex();
    if (target === currentIndex) return;
    const slides = getSlides(track);
    const from = slides[currentIndex];
    const to = slides[target];
    if (!from || !to) return;
    const shift = to.getBoundingClientRect().left - from.getBoundingClientRect().left;
    track.classList.add('is-jumping');
    setScrollInstant(track, track.scrollLeft + shift);
    currentIndex = target;
    markActiveSlide(track, to);
    // Flush styles so the moved is-active state doesn't replay the description fade
    track.getBoundingClientRect();
    track.classList.remove('is-jumping');
  };

  const goTo = (index: number, smooth = true) => {
    const slides = getSlides(track);
    if (!slides.length) return;
    const instant = !smooth || prefersReducedMotion();
    currentIndex = Math.min(Math.max(index, 0), slides.length - 1);
    // Nothing animates on an instant move, so land straight on the real card rather than a clone
    if (instant && loops()) currentIndex = lead + realIndex();
    const slide = slides[currentIndex]!;
    const target = slideOffset(track, slide);
    markActiveSlide(track, slide);
    updateButtons();
    if (instant) {
      setScrollInstant(track, target);
      return;
    }
    if (Math.abs(track.scrollLeft - target) < 1) return;
    isProgrammatic = true;
    track.scrollTo({ left: target, behavior: 'smooth' });
  };

  // Returns false when the step is blocked (bounded carousel at an end)
  const step = (direction: 1 | -1): boolean => {
    const count = realCount();
    if (count < 2) return false;
    if (loops()) {
      // Rapid clicks can outrun the settle; re-anchor on the real cards so the clones never run out
      recenter();
      goTo(currentIndex + direction);
      return true;
    }
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= count) return false;
    goTo(nextIndex);
    return true;
  };

  // ---- Autoplay -------------------------------------------------------------
  // Autoplay runs only while no pause reason is active; each reason is tracked independently
  const pauseReasons = new Set<string>();
  let autoplayTimer: number | undefined;
  let interactionTimer: number | undefined;
  let userPaused = false;
  let autoplayEnded = false;
  let autoplayBtn: HTMLButtonElement | null = null;

  const autoplayAvailable = () => options.autoplayMs > 0 && realCount() > 1 && !prefersReducedMotion();

  const updateAutoplayButton = () => {
    if (!autoplayBtn) return;
    autoplayBtn.hidden = !autoplayAvailable();
    const playing = !userPaused && !autoplayEnded;
    autoplayBtn.classList.toggle('is-paused', !playing);
    autoplayBtn.setAttribute('aria-label', playing ? 'Pause carousel autoplay' : 'Play carousel autoplay');
  };

  const stopAutoplayTimer = () => {
    window.clearTimeout(autoplayTimer);
    autoplayTimer = undefined;
  };

  const scheduleAutoplay = () => {
    stopAutoplayTimer();
    if (!autoplayAvailable() || userPaused || autoplayEnded || pauseReasons.size) return;
    autoplayTimer = window.setTimeout(() => {
      autoplayTimer = undefined;
      if (!step(1)) {
        // Bounded carousel: autoplay finishes on the last card
        autoplayEnded = true;
        updateAutoplayButton();
        return;
      }
      if (!loops() && atEnd()) {
        autoplayEnded = true;
        updateAutoplayButton();
        return;
      }
      scheduleAutoplay();
    }, options.autoplayMs);
  };

  const pause = (reason: string) => {
    pauseReasons.add(reason);
    stopAutoplayTimer();
  };

  const resume = (reason: string) => {
    pauseReasons.delete(reason);
    scheduleAutoplay();
  };

  // Swipes, drags and wheel scrolling pause autoplay until the user has been idle for a moment
  const noteInteraction = () => {
    if (!options.autoplayMs) return;
    pause('interaction');
    window.clearTimeout(interactionTimer);
    interactionTimer = window.setTimeout(() => resume('interaction'), INTERACTION_RESUME_MS);
  };

  if (options.autoplayMs > 0) {
    autoplayBtn = document.createElement('button');
    autoplayBtn.type = 'button';
    autoplayBtn.className = 'culturist-carousel-carousel-autoplay';
    autoplayBtn.addEventListener('click', () => {
      if (autoplayEnded) {
        // Restart a finished bounded autoplay from the first card
        autoplayEnded = false;
        userPaused = false;
        goTo(0);
      } else {
        userPaused = !userPaused;
      }
      updateAutoplayButton();
      scheduleAutoplay();
    });
    carouselCol.append(autoplayBtn);

    carouselCol.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') pause('hover');
    });
    carouselCol.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') resume('hover');
    });
    // Keyboard focus inside the carousel pauses; the play/pause button itself must not, or "Play" could never resume
    carouselCol.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (target === autoplayBtn) resume('focus');
      else if (target.matches(':focus-visible')) pause('focus');
    });
    carouselCol.addEventListener('focusout', (event) => {
      if (!carouselCol.contains(event.relatedTarget as Node | null)) resume('focus');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause('hidden');
      else resume('hidden');
    });
    if ('IntersectionObserver' in window) {
      // Start paused until the observer confirms the carousel is on screen
      pauseReasons.add('offscreen');
      new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) resume('offscreen');
        else pause('offscreen');
      }).observe(carouselCol);
    }
  }

  // ---- Native scroll sync (tablet + mobile scroll natively, desktop via the arrows) ----
  const settle = () => {
    isProgrammatic = false;
    const slides = getSlides(track);
    currentIndex = nearestSlideIndex(track, slides);
    markActiveSlide(track, slides[currentIndex]);
    // Moving scrollLeft under a finger fights the gesture on iOS, so wait for touchend
    if (!isTouching) recenter();
    updateButtons();
  };

  track.addEventListener(
    'scroll',
    () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (isProgrammatic) return;
        const slides = getSlides(track);
        markActiveSlide(track, slides[nearestSlideIndex(track, slides)]);
      });
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(settle, SETTLE_DELAY_MS);
    },
    { passive: true },
  );

  track.addEventListener(
    'touchstart',
    () => {
      isTouching = true;
      noteInteraction();
    },
    { passive: true },
  );

  const endTouch = () => {
    isTouching = false;
    noteInteraction();
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, SETTLE_DELAY_MS);
  };
  track.addEventListener('touchend', endTouch, { passive: true });
  track.addEventListener('touchcancel', endTouch, { passive: true });

  track.addEventListener(
    'wheel',
    (event) => {
      // Vertical wheel scrolls the page, it isn't carousel interaction
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) noteInteraction();
    },
    { passive: true },
  );

  // Tabbing to an off-screen card lets the browser scroll the clipped track; snap back onto the card grid
  track.addEventListener('focusin', (event) => {
    const slide = (event.target as HTMLElement).closest<HTMLElement>(CARD_SELECTOR);
    const index = slide ? getSlides(track).indexOf(slide) : -1;
    if (index >= 0 && index !== currentIndex) goTo(index);
  });

  // Card widths change across breakpoints (and the block is laid out only after decorate),
  // so re-size the clone sets and re-align to the current card without animating
  const realign = () => {
    syncClones();
    goTo(currentIndex, false);
  };
  let resizeFrame = 0;
  const scheduleRealign = () => {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(realign);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleRealign).observe(track);
  else window.addEventListener('resize', scheduleRealign);

  // A manual step restarts the autoplay countdown so the next auto-advance never comes right after a click
  prevBtn.addEventListener('click', () => {
    step(-1);
    scheduleAutoplay();
  });
  nextBtn.addEventListener('click', () => {
    step(1);
    scheduleAutoplay();
  });

  return {
    reset: () => {
      window.clearTimeout(settleTimer);
      isProgrammatic = false;
      autoplayEnded = false;
      lead = 0;
      currentIndex = 0;
      realign();
      updateButtons();
      updateAutoplayButton();
      scheduleAutoplay();
    },
  };
}

async function renderGalleryCarousel(
  carouselCol: HTMLElement,
  cfPath: string,
  options: CarouselOptions,
): Promise<void> {
  const track = carouselCol.querySelector<HTMLElement>('.culturist-carousel-carousel-track');
  const prevBtn = carouselCol.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-prev');
  const nextBtn = carouselCol.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-next');
  if (!track || !prevBtn || !nextBtn) return;

  let navigator = navigators.get(track);
  if (!navigator) {
    navigator = createNavigator(track, prevBtn, nextBtn, options);
    navigators.set(track, navigator);
  }

  const cfData = await fetchCFDetails(cfPath);
  track.innerHTML = '';

  // Skip any null/empty entries so one bad card doesn't break the rest
  const cards: Record<string, any>[] = (cfData?.cardContentReference || []).filter(Boolean);
  const slides: HTMLLIElement[] = [];
  cards.forEach((card) => {
    try {
      const slide = buildCarouselCard(card);
      // A card with no image and no text would be an empty grey tile
      if (slide.querySelector('.culturist-carousel-card-content')?.childElementCount) slides.push(slide);
    } catch (error) {
      console.error('[culturist-carousel] Skipping malformed card', card, error);
    }
  });
  carouselCol.classList.toggle('culturist-carousel-carousel--empty', !slides.length);
  if (slides.length) track.append(...slides);
  else track.textContent = 'No content';

  // Even two cards overflow on desktop (the second only peeks), so arrows are needed from two up
  const hasMultiple = slides.length > 1;
  prevBtn.hidden = !hasMultiple;
  nextBtn.hidden = !hasMultiple;

  // Also runs for the empty state so a previous destination's autoplay stops
  navigator.reset();
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
  // Read before decoration: the carousel column isn't attached to the block until the end of decorate
  const carouselOptions = readCarouselOptions(block);
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

    infoSlot.classList.add('is-fading');
    carouselCol.classList.add('is-fading');
    await new Promise((resolve) => {
      window.setTimeout(resolve, 280);
    });
    if (generation !== selectTabGeneration) return;

    await renderCulturistInfo(infoSlot, cfRef);
    await renderGalleryCarousel(carouselCol, cfRef, carouselOptions);
    if (generation !== selectTabGeneration) return;

    applyOverlay(currentTabIndex);

    infoSlot.classList.remove('is-fading');
    carouselCol.classList.remove('is-fading');
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
    await renderCulturistInfo(infoSlot, initialCfRef);
    await renderGalleryCarousel(carouselCol, initialCfRef, carouselOptions);
  }

  moveInstrumentation(block, wrapper);
  block.replaceChildren(wrapper);
}
