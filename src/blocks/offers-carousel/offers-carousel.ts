import { applyBlockIdentity } from '@/utils/block-identity.js';

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
const LEAVE_MS = 220;

// gesture tuning: drag distance that counts as a swipe, wheel distance that counts as one step,
// the idle gap that ends a wheel gesture, and how long a swipe keeps the trailing click quiet
const SWIPE_THRESHOLD = 40;
const WHEEL_THRESHOLD = 90;
const WHEEL_IDLE_MS = 200;
const CLICK_SWALLOW_MS = 300;

// `skip` keeps the card that is currently swiping out on its own state, so the rest of the
// stack can already step forward while it drops away
function applyStackState(cards: HTMLElement[], activeIndex: number, skip?: HTMLElement): void {
  const total = cards.length;

  cards.forEach((card, index) => {
    if (card === skip) return;

    const rank = (index - activeIndex + total) % total;

    card.classList.remove('is-active', 'is-next-1', 'is-next-2', 'is-hidden');

    if (rank === 0) card.classList.add('is-active');
    else if (rank === 1) card.classList.add('is-next-1');
    else if (rank === 2) card.classList.add('is-next-2');
    else card.classList.add('is-hidden');
  });
}

// places a card in its new slot without animating, then releases it so it rises and fades in
function playEntry(card: HTMLElement, place: () => void): void {
  card.classList.add('is-entering');
  place();
  // read back the layout so the new slot is committed before the entry transition starts
  void card.offsetHeight;
  requestAnimationFrame(() => card.classList.remove('is-entering'));
}

function wireInteraction(root: HTMLElement, cards: HTMLElement[]): void {
  // the first authored card leads the stack; Figma lists it last only because of paint order
  let activeIndex = 0;
  let swiping = false;

  const prevBtn = root.querySelector('.offers-carousel-nav-prev');
  const nextBtn = root.querySelector('.offers-carousel-nav-next');
  const stack = root.querySelector<HTMLElement>('.offers-carousel-cards');

  const update = () => applyStackState(cards, activeIndex);

  // reel swipe: the front card slides down out of view, the cards behind push forward, and the
  // card that left reappears at the rear of the stack
  const goNext = () => {
    if (swiping || cards.length < 2) return;
    swiping = true;

    const leaving = cards[activeIndex]!;
    leaving.classList.add('is-leaving');
    activeIndex = (activeIndex + 1) % cards.length;
    applyStackState(cards, activeIndex, leaving);

    window.setTimeout(() => {
      leaving.classList.remove('is-leaving');
      playEntry(leaving, update);
      swiping = false;
    }, LEAVE_MS);
  };

  // the reverse: the rear card comes up into the front slot while the others step back
  const goPrev = () => {
    if (swiping || cards.length < 2) return;
    activeIndex = (activeIndex - 1 + cards.length) % cards.length;
    playEntry(cards[activeIndex]!, update);
  };

  prevBtn?.addEventListener('click', goPrev);
  nextBtn?.addEventListener('click', goNext);

  // a swipe that ends on a card is followed by a click, which would advance the stack twice
  let swallowClick = false;

  cards.forEach((card, index) => {
    card.addEventListener('focusin', () => {
      if (swiping) return;
      activeIndex = index;
      update();
    });
    card.addEventListener('click', (event) => {
      if (swallowClick) return;
      if ((event.target as Element)?.closest('a')) return;
      goNext();
    });
  });

  // both gestures are bound to the stack itself, so a wheel or drag anywhere else in the
  // section is left to the page
  let start: { x: number; y: number } | null = null;

  stack?.addEventListener('pointerdown', (event) => {
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

  if (rendered.length) wireInteraction(layout, rendered);
}
