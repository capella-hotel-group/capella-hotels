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

// each CTA is authored as url + label (collapsed into one anchor) followed by an open-in-new-tab boolean
function decorateCtas(cell: HTMLElement): void {
  cell.classList.add('offers-carousel-card-ctas');

  const authored = [...cell.children] as HTMLElement[];

  [...cell.querySelectorAll<HTMLAnchorElement>('a')].forEach((anchor, index) => {
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

// mirrors the .is-leaving transition duration in the stylesheet
const LEAVE_MS = 420;

// gesture tuning: drag distance that counts as a swipe, wheel distance that counts as one step,
// the idle gap that ends a wheel gesture, and how long a swipe keeps the trailing click quiet
const SWIPE_THRESHOLD = 40;
const WHEEL_THRESHOLD = 90;
const WHEEL_IDLE_MS = 200;
const CLICK_SWALLOW_MS = 300;
// gap between two steps of the same move; shorter than LEAVE_MS so the next card is already on
// its way out while the previous one is still falling
const STEP_INTERVAL_MS = 290;

// `skip` keeps the cards that are currently swiping out on their own state, so the rest of the
// stack can already step forward while they drop away
function applyStackState(cards: HTMLElement[], activeIndex: number, skip: HTMLElement[] = []): void {
  const total = cards.length;

  cards.forEach((card, index) => {
    if (skip.includes(card)) return;

    const rank = (index - activeIndex + total) % total;

    card.classList.remove('is-active', 'is-next-1', 'is-next-2', 'is-hidden');

    if (rank === 0) card.classList.add('is-active');
    else if (rank === 1) card.classList.add('is-next-1');
    else if (rank === 2) card.classList.add('is-next-2');
    else card.classList.add('is-hidden');
  });
}

// places cards in their new slots without animating, then releases them so they rise and fade in
function playEntry(entering: HTMLElement[], place: () => void): void {
  entering.forEach((card) => card.classList.add('is-entering'));
  place();
  // read back the layout so the new slots are committed before the entry transition starts
  void entering[0]?.offsetHeight;
  requestAnimationFrame(() => entering.forEach((card) => card.classList.remove('is-entering')));
}

// while the intro reveal runs the stack ignores every gesture, so a card cannot step forward
// halfway through being placed
type Gate = { locked: boolean };

const INTRO_STAGGER_MS = 600;
// mirrors --card-move-duration under `.offers-carousel-cards.is-intro` in the stylesheet
const INTRO_DURATION_MS = 1200;

/**
 * Reveals the stack the first time it reaches the viewport: each card starts below its slot and
 * rises into place while fading in, the rearmost card leading so the front card lands last.
 */
function initIntro(stack: HTMLElement, cards: HTMLElement[], gate: Gate): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (isUniversalEditor() || !('IntersectionObserver' in window)) return;

  gate.locked = true;
  stack.classList.add('is-intro');
  cards.forEach((card) => card.classList.add('is-intro-pending'));

  const play = () => {
    [...cards].reverse().forEach((card, step) => {
      card.style.transitionDelay = `${step * INTRO_STAGGER_MS}ms`;
    });
    // read back the layout so the offsets and delays are committed before the cards are released
    void stack.offsetHeight;

    requestAnimationFrame(() => {
      cards.forEach((card) => card.classList.remove('is-intro-pending'));
      window.setTimeout(
        () => {
          cards.forEach((card) => card.style.removeProperty('transition-delay'));
          stack.classList.remove('is-intro');
          gate.locked = false;
        },
        (cards.length - 1) * INTRO_STAGGER_MS + INTRO_DURATION_MS,
      );
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      play();
    },
    { threshold: 0.25 },
  );
  observer.observe(stack);
}

function wireInteraction(root: HTMLElement, cards: HTMLElement[], gate: Gate): void {
  // the first authored card leads the stack; Figma lists it last only because of paint order
  let activeIndex = 0;
  let swiping = false;

  const prevBtn = root.querySelector('.offers-carousel-nav-prev');
  const nextBtn = root.querySelector('.offers-carousel-nav-next');
  const stack = root.querySelector<HTMLElement>('.offers-carousel-cards');

  // cards are skipped by the stack layout while they fall, and there can be more than one of them
  // at a time once a move runs several overlapping steps
  const falling = new Set<HTMLElement>();

  const update = () => applyStackState(cards, activeIndex, [...falling]);

  // reel swipe: the front card slides down out of view, the cards behind push forward, and the
  // card that left reappears at the rear of the stack
  const step = (continuing = false) => {
    const leaving = cards[activeIndex]!;
    falling.add(leaving);
    // a card that is still travelling when it starts to leave keeps its speed, otherwise the
    // eased fall would set off from a standstill and the move stalls at the handover
    if (continuing) leaving.style.setProperty('--card-leave-easing', 'linear');
    leaving.classList.add('is-leaving');
    activeIndex = (activeIndex + 1) % cards.length;
    update();

    window.setTimeout(() => {
      leaving.classList.remove('is-leaving');
      leaving.style.removeProperty('--card-leave-easing');
      falling.delete(leaving);
      playEntry([leaving], update);
    }, LEAVE_MS);
  };

  // several steps are started one after another without waiting for the previous one to finish,
  // so a card that is already falling and a card that is re-entering are both in motion
  const goNext = (steps = 1) => {
    if (gate.locked || swiping || cards.length < 2) return;
    const count = Math.min(Math.max(steps, 1), cards.length - 1);
    swiping = true;

    // the hops before the last one run at constant speed and end exactly when the next one
    // starts, so a card that is retargeted mid-flight never eases to a halt at the junction
    if (count > 1) stack?.classList.add('is-chaining');

    for (let index = 0; index < count; index += 1) {
      const run = () => {
        if (index === count - 1) stack?.classList.remove('is-chaining');
        step(index > 0);
      };
      if (index) window.setTimeout(run, index * STEP_INTERVAL_MS);
      else run();
    }

    window.setTimeout(
      () => {
        swiping = false;
      },
      (count - 1) * STEP_INTERVAL_MS + LEAVE_MS,
    );
  };

  // the reverse: the rear card comes up into the front slot while the others step back
  const goPrev = () => {
    if (gate.locked || swiping || cards.length < 2) return;
    activeIndex = (activeIndex - 1 + cards.length) % cards.length;
    playEntry([cards[activeIndex]!], update);
  };

  prevBtn?.addEventListener('click', () => goPrev());
  nextBtn?.addEventListener('click', () => goNext());

  // a swipe that ends on a card is followed by a click, which would advance the stack twice
  let swallowClick = false;

  cards.forEach((card, index) => {
    card.addEventListener('focusin', () => {
      if (gate.locked || swiping) return;
      activeIndex = index;
      update();
    });
    card.addEventListener('click', (event) => {
      if (swallowClick || gate.locked || swiping) return;
      if ((event.target as Element)?.closest('a')) return;
      // only the cards behind the front one step the stack forward, by as many steps as their rank
      const rank = (index - activeIndex + cards.length) % cards.length;
      if (rank) goNext(rank);
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
      // during the intro the stack is inert, so the wheel keeps scrolling the page
      if (gate.locked) return;
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

      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      // a change of direction starts a fresh gesture
      if (Math.sign(delta) !== Math.sign(wheelDelta)) wheelDelta = 0;
      wheelDelta += delta;

      if (Math.abs(wheelDelta) < WHEEL_THRESHOLD) return;
      wheelDelta = 0;
      wheelLocked = true;
      // matches the macOS wheel direction: pushing the content up pulls the next card forward
      if (delta < 0) goNext();
      else goPrev();
    },
    { passive: false },
  );

  update();
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
  block.append(layout);

  if (!rendered.length) return;

  const gate: Gate = { locked: false };
  wireInteraction(layout, rendered, gate);
  initIntro(cards, rendered, gate);
}
