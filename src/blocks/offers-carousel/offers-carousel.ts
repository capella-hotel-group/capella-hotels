import { applyBlockIdentity } from '@/utils/block-identity.js';
import { isUniversalEditor } from '@/utils/env.js';

const CARD_MODEL = 'offers-carousel-item';

// the stack in the design only has room for three cards, so any extra item is dropped
const CARD_LIMIT = 3;

function isEnabled(value: string): boolean {
  return ['true', 'yes', 'enabled'].includes(value.trim().toLowerCase());
}

function isBooleanFlag(element: Element): boolean {
  return /^(true|false)$/i.test(element.textContent?.trim() || '');
}

function getField(root: Element, property: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-aue-prop="${property}"]`);
}

function applyTarget(anchor: HTMLAnchorElement, openInNewTab: boolean): void {
  if (!openInNewTab) return;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
}

// in the editor every item row carries the item model; outside it we fall back to the cell shape
function isCardRow(row: HTMLElement): boolean {
  if (row.dataset.aueModel) return row.dataset.aueModel === CARD_MODEL;
  return row.children.length >= 3 || !!row.querySelector('picture, img');
}

/**
 * Walks past wrapper divs to the element that directly holds the authored paragraphs.
 * Outside the editor that is the row's cell; in the Universal Editor `decorateRichtext`
 * nests one more instrumented div inside it, which would otherwise break both the
 * second-line indent and the soft-break split.
 */
function resolveCopyField(row: HTMLElement): HTMLElement {
  let field = row;
  while (field.children.length === 1 && field.firstElementChild?.tagName === 'DIV') {
    field = field.firstElementChild as HTMLElement;
  }
  return field;
}

/**
 * Rewrites `<p>one<br>two</p>` as `<p>one</p><p>two</p>` so a heading written with
 * soft breaks lines up with one written as separate paragraphs. The stylesheet
 * indents the second child, which only works when each line is its own element.
 */
function splitOnLineBreaks(container: Element): void {
  [...container.children].forEach((element) => {
    if (!element.querySelector('br')) return;

    const lines = [document.createDocumentFragment()];
    [...element.childNodes].forEach((node) => {
      if (node.nodeName === 'BR') lines.push(document.createDocumentFragment());
      else lines[lines.length - 1]!.append(node);
    });

    const paragraphs = lines
      .filter((line) => line.textContent?.trim())
      .map((line) => {
        // a fresh element rather than a clone, so no data-aue-* attribute is duplicated
        const paragraph = document.createElement(element.tagName);
        paragraph.append(line);
        return paragraph;
      });

    if (paragraphs.length) element.replaceWith(...paragraphs);
  });
}

// AEM turns a url authored without a label into <a href="X">X</a>, so an anchor whose text is
// just its own url means the author never set a label
function hasLabel(anchor: HTMLAnchorElement): boolean {
  const text = anchor.textContent?.trim();
  if (!text) return false;
  return text !== anchor.getAttribute('href')?.trim() && text !== anchor.href;
}

// each CTA is authored as url + label (collapsed into one anchor) followed by an open-in-new-tab boolean
function decorateCtas(cell: HTMLElement): void {
  cell.classList.add('offers-carousel-card-ctas');

  const authored = [...cell.children] as HTMLElement[];

  // label-less anchors are left inside their paragraph, which the last step hides, so the
  // editor still sees the authored value instead of the page showing a raw url
  [...cell.querySelectorAll<HTMLAnchorElement>('a')].filter(hasLabel).forEach((anchor, index) => {
    anchor.classList.add('offers-carousel-card-cta');
    // pair by position, since a CTA whose url is empty renders as plain text with no anchor
    const wrapper = authored.findIndex((element) => element === anchor || element.contains(anchor));
    const flag = wrapper < 0 ? undefined : authored.slice(wrapper + 1).find(isBooleanFlag);
    applyTarget(anchor, isEnabled(flag?.textContent?.trim() || ''));
    if (index) {
      const divider = document.createElement('span');
      divider.className = 'offers-carousel-card-cta-divider';
      divider.setAttribute('aria-hidden', 'true');
      cell.append(divider);
    }
    // lift the anchor out of its paragraph so the CTAs become adjacent flex siblings
    cell.append(anchor);
  });

  // the booleans and the paragraphs the anchors were lifted out of are authoring artefacts
  authored
    .filter((element) => !element.matches('a'))
    .forEach((element) => element.classList.add('offers-carousel-card-cta-flag'));
}

// decoration happens in place so that every instrumented cell survives for the Universal Editor
function decorateCard(row: HTMLElement): void {
  row.classList.add('offers-carousel-card');

  const [mediaCell, contentCell, ctaCell] = [...row.children] as HTMLElement[];
  if (!mediaCell || !contentCell) return;

  const overlayField = getField(row, 'darkOverlay') || row.children[3];
  if (overlayField) {
    mediaCell.classList.toggle(
      'offers-carousel-card-media-no-overlay',
      overlayField.textContent?.trim().toLowerCase() === 'false',
    );
    overlayField.classList.add('offers-carousel-hidden');
  }

  mediaCell.classList.add('offers-carousel-card-media');
  contentCell.classList.add('offers-carousel-card-overlay');

  const parts = [...contentCell.children] as HTMLElement[];
  const taken = new Set<HTMLElement>();
  // outside the editor there are no field markers, so fall back to the authored order
  const pick = (property: string, index: number): HTMLElement | undefined => {
    const part = getField(contentCell, property) || parts[index];
    if (!part || taken.has(part)) return undefined;
    taken.add(part);
    return part;
  };

  const eyebrow = pick('content_cardEyebrow', 0);
  const headline = pick('content_headline', 1);
  const description = pick('content_cardDescription', 2);

  eyebrow?.classList.add('offers-carousel-card-eyebrow');

  const body = document.createElement('div');
  body.className = 'offers-carousel-card-body';

  if (headline) {
    headline.classList.add('offers-carousel-card-title');
    headline.setAttribute('role', 'heading');
    headline.setAttribute('aria-level', '3');
    body.append(headline);
  }

  if (description) {
    description.classList.add('offers-carousel-card-description');
    body.append(description);
  }

  contentCell.append(body);

  // the CTA row spans the full card, so it stays a sibling of the narrower text column
  if (ctaCell) {
    decorateCtas(ctaCell);
    contentCell.append(ctaCell);
  }

  mediaCell.append(contentCell);
}

// durations mirror the .is-ghost / .is-enter-front transitions in the stylesheet
const LEAVE_MS = 750;
const FADE_MS = 350;
const ENTER_FRONT_MS = 800;
// the next move may start before the previous one has settled
const BUSY_MS = 450;
// a click on the rear card takes two steps, the second one this long after the first
const DOUBLE_STEP_MS = 500;

// gesture tuning: drag distance that counts as a swipe, wheel distance that counts as one step,
// the idle gap that ends a wheel gesture, and how long a swipe keeps the trailing click quiet
const SWIPE_THRESHOLD = 40;
const WHEEL_THRESHOLD = 24;
const WHEEL_IDLE_MS = 220;
const CLICK_SWALLOW_MS = 300;

// the stack advances by itself at this pace while nobody hovers or focuses it
const AUTOPLAY_MS = 6000;

function applyStackState(cards: HTMLElement[], activeIndex: number): void {
  const total = cards.length;

  cards.forEach((card, index) => {
    const rank = (index - activeIndex + total) % total;

    card.classList.remove('is-active', 'is-next-1', 'is-next-2', 'is-hidden');

    if (rank === 0) card.classList.add('is-active');
    else if (rank === 1) card.classList.add('is-next-1');
    else if (rank === 2) card.classList.add('is-next-2');
    else card.classList.add('is-hidden');

    // only the front card is read out and reachable by Tab; the ones behind are scenery
    card.setAttribute('aria-hidden', rank ? 'true' : 'false');
    card.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
      anchor.tabIndex = rank ? -1 : 0;
    });
  });
}

function shouldAutoplay(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // a stack that moves on its own would pull the card out from under an author
  return !isUniversalEditor();
}

/**
 * A copy of a card plays its exit while the card itself is already moving into its new slot,
 * so the leaving and the arriving motion overlap without a gap. Editor markers are stripped so
 * the Universal Editor never sees a duplicate of an instrumented node.
 */
function createGhost(card: HTMLElement): HTMLElement {
  const ghost = card.cloneNode(true) as HTMLElement;
  [ghost, ...ghost.querySelectorAll<HTMLElement>('*')].forEach((element) => {
    [...element.attributes]
      .filter((attribute) => /^data-(aue|richtext)-/.test(attribute.name) || attribute.name === 'id')
      .forEach((attribute) => element.removeAttribute(attribute.name));
  });
  ghost.classList.add('is-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  card.after(ghost);
  return ghost;
}

// while the intro reveal runs the stack ignores every gesture, so a card cannot step forward
// halfway through being placed; onUnlock lets autoplay start once the reveal has landed
type Gate = { locked: boolean; onUnlock?: () => void };

// covers the slowest intro transition: front copy delay 1.5s plus its 0.8s rise, with margin
const INTRO_DURATION_MS = 2600;

function shouldAnimateIntro(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return !isUniversalEditor() && 'IntersectionObserver' in window;
}

// each title line rises inside its own mask, so the text needs an inner wrapper to translate
function prepareTitleLines(layout: HTMLElement): void {
  const title = layout.querySelector('.offers-carousel-title');
  if (!title) return;
  [...title.children].forEach((line, index) => {
    const inner = document.createElement('span');
    inner.className = 'offers-carousel-title-line-inner';
    inner.append(...line.childNodes);
    line.append(inner);
    line.classList.add('offers-carousel-title-line');
    (line as HTMLElement).style.setProperty('--line-index', String(index + 1));
  });
}

/**
 * First view: the eyebrow and title lines rise, the cards build from the back to the front out
 * of depth, then the front card's copy follows.
 */
function initIntro(layout: HTMLElement, gate: Gate): void {
  gate.locked = true;

  const play = () => {
    layout.classList.add('is-building');
    requestAnimationFrame(() => requestAnimationFrame(() => layout.classList.add('is-in')));
    window.setTimeout(() => {
      layout.classList.remove('is-building');
      gate.locked = false;
      gate.onUnlock?.();
    }, INTRO_DURATION_MS);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      play();
    },
    { threshold: 0.2 },
  );
  observer.observe(layout);
}

function wireInteraction(root: HTMLElement, cards: HTMLElement[], gate: Gate): void {
  // the first authored card leads the stack; Figma lists it last only because of paint order
  let activeIndex = 0;
  let busy = false;

  const prevBtn = root.querySelector('.offers-carousel-nav-prev');
  const nextBtn = root.querySelector('.offers-carousel-nav-next');
  const stack = root.querySelector<HTMLElement>('.offers-carousel-cards');

  const update = () => applyStackState(cards, activeIndex);

  // autoplay: every move restarts the countdown, hovering or focusing the stack holds it
  const autoplay = shouldAutoplay() && cards.length > 1;
  let timer = 0;
  let paused = false;
  let goNextRef: () => void = () => {};
  const tick = () => {
    window.clearTimeout(timer);
    if (autoplay && !paused && !gate.locked) timer = window.setTimeout(() => goNextRef(), AUTOPLAY_MS);
  };

  // the front card's ghost flies forward and fades while the card itself fades in at the back
  const goNext = () => {
    if (gate.locked || busy || cards.length < 2) return;
    busy = true;
    tick();

    const front = cards[activeIndex]!;
    const ghost = createGhost(front);
    activeIndex = (activeIndex + 1) % cards.length;

    front.classList.add('is-enter-back');
    update();
    // commit the start state before releasing it, so the move is transitioned
    void front.offsetWidth;
    front.classList.remove('is-enter-back');
    void ghost.offsetWidth;
    ghost.classList.add('is-leaving');

    window.setTimeout(() => ghost.remove(), LEAVE_MS);
    window.setTimeout(() => {
      busy = false;
    }, BUSY_MS);
  };

  // the rear card's ghost sinks away while the card itself comes down into the front slot
  const goPrev = () => {
    if (gate.locked || busy || cards.length < 2) return;
    busy = true;
    tick();

    activeIndex = (activeIndex - 1 + cards.length) % cards.length;
    const back = cards[activeIndex]!;
    const ghost = createGhost(back);

    back.classList.add('is-enter-front');
    update();
    void back.offsetWidth;
    back.classList.add('is-go');
    void ghost.offsetWidth;
    ghost.classList.add('is-fading');

    window.setTimeout(() => ghost.remove(), FADE_MS);
    window.setTimeout(() => {
      back.classList.remove('is-enter-front', 'is-go');
      busy = false;
    }, ENTER_FRONT_MS);
  };

  goNextRef = goNext;

  prevBtn?.addEventListener('click', () => goPrev());
  nextBtn?.addEventListener('click', () => goNext());

  if (stack) {
    const hold = () => {
      paused = true;
      tick();
    };
    const release = () => {
      paused = false;
      tick();
    };
    stack.addEventListener('mouseenter', hold);
    stack.addEventListener('mouseleave', release);
    stack.addEventListener('focusin', hold);
    stack.addEventListener('focusout', (event) => {
      // moving focus between links of the same card is not leaving the stack
      if (!stack.contains(event.relatedTarget as Node | null)) release();
    });

    // keys reach the stack from the front card's links, the only focusable things inside it
    stack.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      }
    });
  }

  // with an intro the countdown starts once it lands, otherwise straight away
  gate.onUnlock = tick;

  // a gentle tilt towards the pointer, so the depth between the cards reads
  if (stack && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    stack.addEventListener('pointermove', (event) => {
      const bounds = stack.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      stack.style.setProperty('--stack-ry', `${(x * 7).toFixed(2)}deg`);
      stack.style.setProperty('--stack-rx', `${(y * -5).toFixed(2)}deg`);
    });
    stack.addEventListener('pointerleave', () => {
      stack.style.removeProperty('--stack-ry');
      stack.style.removeProperty('--stack-rx');
    });
  }

  // a swipe that ends on a card is followed by a click, which would advance the stack twice
  let swallowClick = false;

  cards.forEach((card, index) => {
    card.addEventListener('focusin', () => {
      if (gate.locked || busy) return;
      activeIndex = index;
      update();
    });
    card.addEventListener('click', (event) => {
      if (swallowClick || gate.locked || busy) return;
      if ((event.target as Element)?.closest('a')) return;
      // a card behind the front one is brought forward one step at a time
      const rank = (index - activeIndex + cards.length) % cards.length;
      if (!rank) return;
      goNext();
      if (rank === 2) window.setTimeout(goNext, DOUBLE_STEP_MS);
    });
  });

  // both gestures are bound to the stack itself, so a wheel or drag anywhere else in the
  // section is left to the page
  let start: { x: number; y: number } | null = null;

  stack?.addEventListener('pointerdown', (event) => {
    if (gate.locked) return;
    event.stopPropagation();
    start = { x: event.clientX, y: event.clientY };
  });

  // the gesture ends on the window so a drag that leaves the stack still counts; pointer
  // capture is avoided because it would retarget the trailing click away from the card
  window.addEventListener('pointercancel', () => {
    start = null;
  });

  window.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;

    const vertical = Math.abs(dy) > Math.abs(dx);
    const delta = vertical ? dy : dx;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;

    // the gesture belongs to the stack, nothing outside it should react to the release
    event.stopPropagation();
    swallowClick = true;
    window.setTimeout(() => {
      swallowClick = false;
    }, CLICK_SWALLOW_MS);

    // dragging down sends the front card away with the finger; sideways, left is the usual next
    if (vertical ? delta > 0 : delta < 0) goNext();
    else goPrev();
  });

  let wheelDelta = 0;
  let wheelLocked = false;
  let wheelIdle = 0;

  // non-passive: a wheel over the stack drives the reel instead of scrolling the page
  stack?.addEventListener(
    'wheel',
    (event) => {
      // during the intro the stack is inert, so the wheel keeps scrolling the page; a sideways
      // wheel is not a gesture on the stack either
      if (gate.locked || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      event.stopPropagation();

      // one step per gesture: the rest of the burst, trackpad momentum included, is swallowed
      // until the wheel has been idle again
      window.clearTimeout(wheelIdle);
      wheelIdle = window.setTimeout(() => {
        wheelLocked = false;
        wheelDelta = 0;
      }, WHEEL_IDLE_MS);
      if (wheelLocked) return;

      const delta = event.deltaY;
      // a change of direction starts a fresh gesture
      if (Math.sign(delta) !== Math.sign(wheelDelta)) wheelDelta = 0;
      wheelDelta += delta;

      if (Math.abs(wheelDelta) < WHEEL_THRESHOLD) return;
      wheelDelta = 0;
      wheelLocked = true;
      // scrolling down brings the next offer, scrolling up brings the previous one back
      if (delta > 0) goNext();
      else goPrev();
    },
    { passive: false },
  );

  update();
  tick();
}

export default function decorate(block: HTMLElement): void {
  if (block.querySelector(':scope > .offers-carousel-layout')) return;

  const rows = [...block.children] as HTMLElement[];
  const cardRows = rows.filter(isCardRow);
  const [eyebrowRow, titleRow] = applyBlockIdentity(
    block,
    rows.filter((row) => !cardRows.includes(row)),
    { hiddenClass: 'offers-carousel-hidden', contentRows: 2 },
  );

  const copy = document.createElement('div');
  copy.className = 'offers-carousel-copy';

  if (eyebrowRow) {
    resolveCopyField(eyebrowRow).classList.add('offers-carousel-eyebrow');
    copy.append(eyebrowRow);
  }

  if (titleRow) {
    const title = resolveCopyField(titleRow);
    title.classList.add('offers-carousel-title');
    splitOnLineBreaks(title);
    copy.append(titleRow);
  }

  const cards = document.createElement('div');
  cards.className = 'offers-carousel-cards';

  const rendered = cardRows.slice(0, CARD_LIMIT);
  rendered.forEach((row) => {
    decorateCard(row);
    cards.append(row);
  });
  cards.style.setProperty('--card-count', String(rendered.length));

  // extras stay put so the editor keeps showing them in the content tree
  cardRows.slice(CARD_LIMIT).forEach((row) => row.classList.add('offers-carousel-hidden'));

  const stage = document.createElement('div');
  stage.className = 'offers-carousel-stage';
  stage.append(cards);

  const layout = document.createElement('div');
  layout.className = 'offers-carousel-layout';
  layout.append(copy, stage);

  // the hidden start state is set before the layout is attached, so it never transitions in
  const animateIntro = shouldAnimateIntro();
  if (animateIntro) {
    layout.classList.add('is-animated');
    prepareTitleLines(layout);
  }

  block.append(layout);

  const gate: Gate = { locked: false };
  if (animateIntro) initIntro(layout, gate);
  if (rendered.length) wireInteraction(layout, rendered, gate);
}
