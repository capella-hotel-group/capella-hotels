import { moveInstrumentation } from '@/app/scripts';
import { applyBlockIdentity } from '@/utils/block-identity';

/*
 * hotel-architect
 * The block holds only its identity fields; all content lives in `hotel-architect-ritual`
 * items, plus an optional `hotel-architect-card`. One ritual renders the classic
 * architect layout with its card; two or more add a tab bar and drop the card.
 */

const RITUAL_MODEL = 'hotel-architect-ritual';
const CARD_MODEL = 'hotel-architect-card';

// Cell order of the `hotel-architect-ritual` model. That order is the contract between
// author and code: changing the model field list must update this list in the same
// commit. Grouped fields (each multifield, each CTA) collapse into one cell.
const RITUAL_FIELDS = [
  'tabLabel',
  'eyebrow',
  'title',
  'body',
  'thumbnails',
  'primaryCta',
  'secondaryCta',
  'media',
] as const;
type RitualField = (typeof RITUAL_FIELDS)[number];

// the card (photo, name, role, CTA) is the widest item that is not a ritual
const CARD_CELL_COUNT = 4;
const MAX_THUMBNAILS = 3;
const FLAGS = ['true', 'false'];

// Exported from the Figma "arrow-icon" component (28x28). fill is currentColor
// so the stylesheet owns the colour.
const ARROW_PATHS: Record<'prev' | 'next', string> = {
  prev: 'M19.71 4C15.98 7.16 12.47 10.56 9 14C10.79 15.78 12.59 17.56 14.44 19.27C15.96 20.68 18.13 22.69 19.71 24C16.71 20.46 11 14 11 14C11 14 18.2116 5.76279 19.71 4Z',
  next: 'M9 4C12.73 7.16 16.24 10.56 19.71 14C17.92 15.78 16.12 17.56 14.27 19.27C12.75 20.68 10.58 22.69 9 24C12 20.46 17.5 14 17.5 14C17.5 14 10.4984 5.76279 9 4Z',
};

let blockCount = 0;

function textOf(node?: Element | null): string {
  return node?.textContent?.trim() || '';
}

function cellsOf(row: Element): HTMLElement[] {
  return [...row.querySelectorAll<HTMLElement>(':scope > div')];
}

function hasContent(cell: Element | null | undefined): cell is Element {
  return !!cell && (textOf(cell) !== '' || !!cell.querySelector('picture, img, a'));
}

function isFlag(element: Element | null | undefined): boolean {
  return !!element && FLAGS.includes(textOf(element).toLowerCase());
}

/**
 * In the editor every item row carries its model. Outside it a ritual is told
 * apart from the card by its cell count, and the identity fields are single cells.
 */
function itemModelOf(row: HTMLElement): string | null {
  const model = row.dataset.aueModel;
  if (model) return [RITUAL_MODEL, CARD_MODEL].includes(model) ? model : null;

  const cells = cellsOf(row);
  if (cells.length < 2) return null;
  return cells.length > CARD_CELL_COUNT ? RITUAL_MODEL : CARD_MODEL;
}

/** Alt text collapses into the cell of the field it suffixes, arriving as a sibling of the asset. */
function altOf(cell?: Element | null): string {
  const authored = cell?.querySelector('img')?.getAttribute('alt');
  if (authored) return authored;
  const sibling = [...(cell?.children || [])].find(
    (element) => !element.matches('a, picture, img') && !element.querySelector('picture, img, a'),
  );
  return textOf(sibling);
}

function buildPicture(cell: Element | null | undefined): HTMLElement | null {
  const picture = cell?.querySelector('picture');
  if (!picture) return null;
  const img = picture.querySelector('img');
  if (img && !img.getAttribute('alt')) img.setAttribute('alt', altOf(cell));
  return picture;
}

/**
 * A multifield renders one `<li><picture>` per entry. A cell that arrives without
 * the list (for example while the multi-field flag is off) still yields one entry
 * per picture.
 */
function multifieldEntries(cell: Element | null | undefined): HTMLElement[] {
  if (!cell) return [];
  const listItems = [...cell.querySelectorAll<HTMLElement>('li')];
  return listItems.length ? listItems : [...cell.querySelectorAll<HTMLElement>('picture')];
}

/** Moves one multifield entry into a fresh list item, keeping its editor instrumentation. */
function buildEntry(entry: HTMLElement, className: string): { item: HTMLLIElement; picture: HTMLElement | null } {
  const item = document.createElement('li');
  item.className = className;
  if (entry.matches('li')) moveInstrumentation(entry, item);
  const picture = entry.matches('picture') ? entry : buildPicture(entry);
  if (picture) item.append(picture);
  return { item, picture };
}

/** Creates the list that replaces an authored multifield, carrying its instrumentation. */
function buildList(cell: Element | null | undefined, className: string): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = className;
  const authored = cell?.querySelector('ul');
  if (authored) moveInstrumentation(authored, list);
  return list;
}

/**
 * Reads an element-grouped CTA cell, which holds the label, the link and the
 * open-in-new-tab flag as separate children rather than as separate cells.
 */
function readCta(cell: Element | null | undefined): { label: string; href: string; openInNewTab: boolean } {
  const children = [...(cell?.children || [])];
  const link = cell?.querySelector('a');
  const label = children.find((element) => !element.querySelector('a') && !isFlag(element));

  return {
    // an authored link with no label renders as its own href, which still beats
    // dropping the CTA and leaving the author with nothing on the page
    label: textOf(label) || textOf(link),
    href: link?.getAttribute('href') || '',
    openInNewTab: children.some((element) => textOf(element).toLowerCase() === 'true'),
  };
}

function buildLink(cell: Element | null | undefined, testId: string): HTMLAnchorElement | null {
  const { label, href, openInNewTab } = readCta(cell);
  if (!label || !href) return null;

  const link = document.createElement('a');
  link.href = href;
  link.textContent = label;
  link.dataset.testid = testId;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  return link;
}

function buildCopy(cell: Element | null | undefined, field: string): HTMLElement | null {
  if (!hasContent(cell)) return null;
  const wrapper = document.createElement('div');
  wrapper.className = `hotel-architect-${field}`;
  moveInstrumentation(cell, wrapper);
  while (cell.firstChild) wrapper.append(cell.firstChild);
  return wrapper;
}

/** Splits a node's own children at every direct `<br>`, or null when there is none. */
function linesOf(node: Node): DocumentFragment[] | null {
  if (![...node.childNodes].some((child) => child.nodeName === 'BR')) return null;

  const lines = [document.createDocumentFragment()];
  [...node.childNodes].forEach((child) => {
    if (child.nodeName === 'BR') lines.push(document.createDocumentFragment());
    else lines[lines.length - 1]!.append(child);
  });

  return lines.filter((line) => line.textContent?.trim());
}

function wrapLines(lines: DocumentFragment[]): HTMLElement[] {
  return lines.map((line) => {
    // a fresh element rather than a clone, so no data-aue-* attribute is duplicated
    const element = document.createElement('span');
    element.append(line);
    return element;
  });
}

const BLOCK_TAGS = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];

/**
 * Rewrites the title's authored lines as `<span>`s, since a `<p>` is not allowed
 * inside the `<h2>`. A title written with soft breaks lines up with one written as
 * separate paragraphs: the stylesheet indents the second line, which only works
 * when each line is its own element. The breaks sit either inside a paragraph or,
 * when the field holds a single line of rich text, directly in the authored cell.
 */
function splitIntoLines(heading: Element): void {
  const ownLines = linesOf(heading);
  if (ownLines) {
    heading.replaceChildren(...wrapLines(ownLines));
    return;
  }

  [...heading.children].forEach((element) => {
    if (!BLOCK_TAGS.includes(element.tagName)) return;
    const whole = document.createDocumentFragment();
    whole.append(...element.childNodes);
    const lines = linesOf(whole) ?? [whole];
    const spans = wrapLines(lines.filter((line) => line.textContent?.trim()));
    if (spans.length) element.replaceWith(...spans);
    else element.remove();
  });
}

/** The title reads as a heading, so the tabs and the page outline can reach each ritual. */
function buildTitle(cell: Element | null | undefined): HTMLElement | null {
  if (!hasContent(cell)) return null;
  const heading = document.createElement('h2');
  heading.className = 'hotel-architect-title';
  moveInstrumentation(cell, heading);
  while (cell.firstChild) heading.append(cell.firstChild);
  splitIntoLines(heading);
  return heading;
}

function buildHeader(
  eyebrowCell: Element | null | undefined,
  titleCell: Element | null | undefined,
): HTMLElement | null {
  const eyebrow = buildCopy(eyebrowCell, 'eyebrow');
  const title = buildTitle(titleCell);
  if (!eyebrow && !title) return null;

  const header = document.createElement('div');
  header.className = 'hotel-architect-header';
  if (eyebrow) header.append(eyebrow);
  if (title) header.append(title);
  return header;
}

/**
 * Builds the static supporting gallery. These images are content, not carousel
 * controls, so they keep their authored alt text and never change the slide. A
 * multifield has no item limit in the editor, so entries past the third are kept
 * but hidden: they stay in the content tree, where the author can remove them.
 */
function buildThumbs(cell: Element | null | undefined): HTMLUListElement | null {
  const entries = multifieldEntries(cell);
  if (!entries.length) return null;

  const list = buildList(cell, 'hotel-architect-thumbs');
  entries.forEach((entry, index) => {
    const { item } = buildEntry(entry, 'hotel-architect-thumb');
    item.hidden = index >= MAX_THUMBNAILS;
    list.append(item);
  });
  return list;
}

/**
 * Builds the CTA row, with the hairline divider only between two links.
 * Returns null when no CTA is complete, so no empty row takes up space.
 */
function buildCtas(
  primaryCell: Element | null | undefined,
  secondaryCell: Element | null | undefined,
): HTMLElement | null {
  const links = [
    buildLink(primaryCell, 'hotel-architect-primary-cta'),
    buildLink(secondaryCell, 'hotel-architect-secondary-cta'),
  ].filter((link): link is HTMLAnchorElement => link !== null);
  if (!links.length) return null;

  const cta = document.createElement('div');
  cta.className = 'hotel-architect-cta';
  links.forEach((link, index) => {
    if (index > 0) {
      const divider = document.createElement('span');
      divider.className = 'hotel-architect-cta-divider';
      divider.setAttribute('aria-hidden', 'true');
      cta.append(divider);
    }
    cta.append(link);
  });
  return cta;
}

function buildArrow(direction: 'prev' | 'next', label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `hotel-architect-nav hotel-architect-nav-${direction}`;
  button.dataset.testid = `hotel-architect-${direction === 'prev' ? 'previous' : 'next'}`;
  button.setAttribute('aria-label', label);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 28 28');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', ARROW_PATHS[direction]);
  svg.append(path);
  button.append(svg);

  return button;
}

interface Slide {
  element: HTMLLIElement;
  label: string;
}

function buildDots(slides: Slide[]): HTMLOListElement {
  const list = document.createElement('ol');
  list.className = 'hotel-architect-dots';

  slides.forEach((slide, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotel-architect-dot';
    button.dataset.index = String(index);
    button.dataset.testid = 'hotel-architect-dot';
    button.setAttribute('aria-label', slide.label);
    item.append(button);
    list.append(item);
  });

  return list;
}

/**
 * Builds one primary media carousel. The arrows (and, in the single-ritual layout,
 * the dots) only appear for two or more slides; selection wraps at either end.
 */
function buildGallery(cell: Element | null | undefined, { dots: withDots }: { dots: boolean }): HTMLElement {
  const track = buildList(cell, 'hotel-architect-track');
  const slides: Slide[] = multifieldEntries(cell).map((entry, index) => {
    const { item, picture } = buildEntry(entry, 'hotel-architect-slide');
    track.append(item);
    // the picture has already left its cell, so its alt is the reliable label
    return { element: item, label: picture?.querySelector('img')?.getAttribute('alt') || `Show image ${index + 1}` };
  });

  const interactive = slides.length > 1;
  const prev = interactive ? buildArrow('prev', 'Previous image') : null;
  const next = interactive ? buildArrow('next', 'Next image') : null;
  const dots = interactive && withDots ? buildDots(slides) : null;

  const frame = document.createElement('div');
  frame.className = 'hotel-architect-frame';
  frame.append(track);
  if (prev && next) frame.append(prev, next);
  if (dots) frame.append(dots);

  const media = document.createElement('div');
  media.className = 'hotel-architect-media';
  media.append(frame);

  if (!slides.length) return media;

  const dotButtons = [...(dots?.querySelectorAll<HTMLElement>('.hotel-architect-dot') ?? [])];
  let selected = -1;

  const select = (index: number): void => {
    // wraps, so the arrows keep working at either end of the gallery
    const target = (index + slides.length) % slides.length;
    if (target === selected) return;
    selected = target;

    slides.forEach((slide, i) => slide.element.classList.toggle('is-selected', i === selected));
    dotButtons.forEach((button) => {
      const active = Number(button.dataset.index) === selected;
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  };

  prev?.addEventListener('click', () => select(selected - 1));
  next?.addEventListener('click', () => select(selected + 1));

  dots?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('button[data-index]');
    if (button) select(Number(button.dataset.index));
  });

  select(0);
  return media;
}

function buildCard(row: HTMLElement): HTMLElement {
  const cells = cellsOf(row);
  // an empty text field drops its cell from the delivered row, so the portrait and
  // the CTA are found by what they hold and the name and role are what is left
  const photoCell = cells.find((cell) => cell.querySelector('picture'));
  const ctaCell = cells.find((cell) => cell.querySelector('a[href]'));
  const textCells = cells.filter((cell) => cell !== photoCell && cell !== ctaCell && hasContent(cell));

  const card = document.createElement('div');
  card.className = 'hotel-architect-card';
  card.dataset.testid = 'hotel-architect-card';
  moveInstrumentation(row, card);

  const picture = buildPicture(photoCell);
  if (picture) {
    const figure = document.createElement('div');
    figure.className = 'hotel-architect-card-photo';
    figure.append(picture);
    card.append(figure);
  }

  const content = document.createElement('div');
  content.className = 'hotel-architect-card-content';
  card.append(content);

  const identity = document.createElement('div');
  identity.className = 'hotel-architect-card-identity';
  content.append(identity);

  (['name', 'role'] as const).forEach((field, index) => {
    const cell = textCells[index];
    if (!cell) return;
    const element = document.createElement('p');
    element.className = `hotel-architect-card-${field}`;
    moveInstrumentation(cell, element);
    while (cell.firstChild) element.append(cell.firstChild);
    identity.append(element);
  });

  const link = buildLink(ctaCell, 'hotel-architect-card-cta');
  if (link) {
    const cta = document.createElement('div');
    cta.className = 'hotel-architect-card-cta';
    cta.append(link);
    content.append(cta);
  }

  return card;
}

/**
 * Maps a ritual row's cells to its fields. Every field normally keeps its cell, so
 * they are read by position; a row with missing cells falls back to telling them
 * apart by content: the CTA groups always end in their open-in-new-tab flag, the
 * primary images are the last multifield, and the required text fields fill the
 * gap left by the optional eyebrow.
 */
function ritualCellsOf(row: HTMLElement): Partial<Record<RitualField, HTMLElement>> {
  const cells = cellsOf(row);
  if (cells.length === RITUAL_FIELDS.length) {
    return Object.fromEntries(RITUAL_FIELDS.map((field, index) => [field, cells[index]]));
  }

  const ctaCells = cells.filter(
    (cell) => isFlag(cell) || (isFlag(cell.lastElementChild) && !cell.querySelector('picture')),
  );
  const lists = cells.filter((cell) => cell.querySelector('li picture'));
  const media = lists[lists.length - 1];
  const thumbnails = lists.length > 1 ? lists[0] : undefined;
  const texts = cells.filter((cell) => !ctaCells.includes(cell) && !lists.includes(cell) && hasContent(cell));
  const [tabLabel, ...rest] = texts;
  const [eyebrow, title, body] = rest.length >= 3 ? rest : [undefined, ...rest];

  return { tabLabel, eyebrow, title, body, thumbnails, primaryCta: ctaCells[0], secondaryCta: ctaCells[1], media };
}

interface Ritual {
  label: string;
  element: HTMLElement;
}

/**
 * Builds a ritual as one element holding both its copy and its media, so the
 * editor lists every field and image of the ritual under it in the content tree.
 */
function buildRitual(row: HTMLElement, index: number, dots: boolean): Ritual {
  const cells = ritualCellsOf(row);

  const element = document.createElement('div');
  element.className = 'hotel-architect-ritual';
  element.dataset.index = String(index);
  moveInstrumentation(row, element);

  const copy = document.createElement('div');
  copy.className = 'hotel-architect-copy';
  [
    buildHeader(cells.eyebrow, cells.title),
    buildCopy(cells.body, 'body'),
    buildThumbs(cells.thumbnails),
    buildCtas(cells.primaryCta, cells.secondaryCta),
  ].forEach((part) => part && copy.append(part));

  element.append(copy, buildGallery(cells.media, { dots }));

  return {
    // a ritual just added in the editor has no label yet, but still needs a tab
    label: textOf(cells.tabLabel) || `Ritual ${index + 1}`,
    element,
  };
}

function buildTab(label: string, index: number, blockId: string): HTMLButtonElement {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'hotel-architect-tab';
  tab.id = `${blockId}-tab-${index}`;
  tab.dataset.index = String(index);
  tab.dataset.testid = 'hotel-architect-tab';
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', `${blockId}-panel-${index}`);
  tab.textContent = label;
  return tab;
}

/** Fades the tab bar's trailing edge while more tabs are scrolled out of view. */
function trackOverflow(tablist: HTMLElement): void {
  const sync = (): void => {
    const overflow = tablist.scrollWidth - tablist.clientWidth;
    const remaining = overflow - Math.abs(tablist.scrollLeft);
    // +1 absorbs the sub-pixel difference these report at fractional widths
    tablist.classList.toggle('is-scrollable', overflow > 1);
    tablist.classList.toggle('has-more', remaining > 1);
  };
  tablist.addEventListener('scroll', sync, { passive: true });
  new ResizeObserver(sync).observe(tablist);
}

/**
 * Lets a mouse drag the overflowing tab bar sideways, as touch and trackpads already
 * can. A press only becomes a drag past a few pixels, so a plain click still selects
 * its tab, and the click that ends a drag is swallowed so it does not.
 */
function enableDragScroll(tablist: HTMLElement): void {
  const THRESHOLD = 5;
  let pointerId: number | null = null;
  let startX = 0;
  let startScroll = 0;
  let dragged = false;

  tablist.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !tablist.classList.contains('is-scrollable')) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = tablist.scrollLeft;
    dragged = false;
  });

  tablist.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const distance = event.clientX - startX;
    if (!dragged && Math.abs(distance) < THRESHOLD) return;
    if (!dragged) {
      dragged = true;
      tablist.setPointerCapture?.(event.pointerId);
      tablist.classList.add('is-dragging');
    }
    tablist.scrollLeft = startScroll - distance;
  });

  const end = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    tablist.classList.remove('is-dragging');
    if (tablist.hasPointerCapture?.(event.pointerId)) tablist.releasePointerCapture(event.pointerId);
  };
  tablist.addEventListener('pointerup', end);
  tablist.addEventListener('pointercancel', end);

  tablist.addEventListener(
    'click',
    (event) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}

/**
 * loads and decorates the block
 * @param block The block element
 */
export default function decorate(block: HTMLElement): void {
  blockCount += 1;
  const blockId = `hotel-architect-${blockCount}`;

  const rows = [...block.children] as HTMLElement[];
  const models = new Map(rows.map((row) => [row, itemModelOf(row)]));
  const ritualRows = rows.filter((row) => models.get(row) === RITUAL_MODEL);
  const cardRows = rows.filter((row) => models.get(row) === CARD_MODEL);
  applyBlockIdentity(
    block,
    rows.filter((row) => !models.get(row)),
    { contentRows: 0 },
  );

  const tabbed = ritualRows.length > 1;
  // the single-ritual layout is the classic architect design, dots included
  const rituals = ritualRows.map((row, index) => buildRitual(row, index, !tabbed));

  block.textContent = '';
  block.dataset.testid = 'hotel-architect';
  block.classList.toggle('hotel-architect-tabbed', tabbed);

  const tablist = document.createElement('div');
  tablist.className = 'hotel-architect-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Rituals');
  const tabs = rituals.map((ritual, index) => buildTab(ritual.label, index, blockId));
  if (tabbed) {
    tablist.append(...tabs);
    block.append(tablist);
  }

  rituals.forEach((ritual, index) => {
    ritual.element.id = `${blockId}-panel-${index}`;
    if (tabbed) {
      ritual.element.setAttribute('role', 'tabpanel');
      ritual.element.setAttribute('aria-labelledby', tabs[index]!.id);
    }
    block.append(ritual.element);
  });

  if (cardRows.length) {
    const cards = document.createElement('div');
    cards.className = 'hotel-architect-cards';
    // the design has one architect card: extra card items, and every card in the
    // tabbed variation, stay in the DOM hidden so the editor still lists them and
    // the author can remove them
    cardRows.forEach((row, index) => {
      const card = buildCard(row);
      card.hidden = index > 0;
      cards.append(card);
    });
    cards.hidden = tabbed;
    block.classList.toggle('hotel-architect-has-card', !tabbed);
    block.append(cards);
  }

  let selected = -1;
  const select = (index: number, reveal = false): void => {
    if (index === selected || !rituals[index]) return;
    selected = index;
    rituals.forEach((ritual, i) => {
      const active = i === selected;
      ritual.element.hidden = !active;
      tabs[i]!.setAttribute('aria-selected', String(active));
      tabs[i]!.tabIndex = active ? 0 : -1;
    });
    if (reveal) tabs[selected]!.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  select(0);
  if (!tabbed) return;

  tablist.addEventListener('click', (event) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"]');
    if (tab) select(Number(tab.dataset.index), true);
  });

  const STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
  tablist.addEventListener('keydown', (event: KeyboardEvent) => {
    let target: number;
    if (event.key in STEPS) target = (selected + STEPS[event.key]! + rituals.length) % rituals.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = rituals.length - 1;
    else return;

    event.preventDefault();
    select(target, true);
    tabs[target]!.focus();
  });

  trackOverflow(tablist);
  enableDragScroll(tablist);

  // selecting a ritual in the editor rail, or editing its copy inline, should
  // reveal the matching tab
  const revealFromEvent = (event: Event): void => {
    const ritual = (event.target as Element | null)?.closest?.<HTMLElement>('.hotel-architect-ritual');
    if (ritual?.dataset.index) select(Number(ritual.dataset.index));
  };
  block.addEventListener('aue:ui-select', revealFromEvent);
  block.addEventListener('focusin', revealFromEvent);
}
