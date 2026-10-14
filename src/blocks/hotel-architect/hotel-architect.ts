import { moveInstrumentation } from '@/app/scripts';
import { applyBlockIdentity } from '@/utils/block-identity';

// Row indices mirror the field order of the `hotel-architect` model after the
// leading identity rows. Changing that field list is a contract change and must
// update these indices in the same commit.
const COPY_FIELDS = ['eyebrow', 'title', 'body', 'primaryCta', 'secondaryCta'] as const;
const IDENTITY_ROW_COUNT = 2;
const MAX_THUMBNAILS = 3;

const IMAGE_MODEL = 'hotel-architect-image';
const CARD_MODEL = 'hotel-architect-card';
const RITUAL_MODEL = 'hotel-architect-ritual';

// Cell order of the `hotel-architect-ritual` model, a contract like COPY_FIELDS above.
// Grouped fields (media, thumbnails, each CTA) each collapse into one cell.
const RITUAL_FIELDS = [
  'tabLabel',
  'eyebrow',
  'title',
  'body',
  'media',
  'thumbnails',
  'primaryCta',
  'secondaryCta',
] as const;
type RitualField = (typeof RITUAL_FIELDS)[number];

// the card is the widest of the other item rows (photo, name, role, CTA)
const CARD_CELL_COUNT = 4;

let blockCount = 0;

// Exported from the Figma "arrow-icon" component (28x28). fill is currentColor
// so the stylesheet owns the colour.
const ARROW_PATHS: Record<'prev' | 'next', string> = {
  prev: 'M19.71 4C15.98 7.16 12.47 10.56 9 14C10.79 15.78 12.59 17.56 14.44 19.27C15.96 20.68 18.13 22.69 19.71 24C16.71 20.46 11 14 11 14C11 14 18.2116 5.76279 19.71 4Z',
  next: 'M9 4C12.73 7.16 16.24 10.56 19.71 14C17.92 15.78 16.12 17.56 14.27 19.27C12.75 20.68 10.58 22.69 9 24C12 20.46 17.5 14 17.5 14C17.5 14 10.4984 5.76279 9 4Z',
};

function textOf(node?: Element | null): string {
  return node?.textContent?.trim() || '';
}

function cellsOf(row: Element): HTMLElement[] {
  return [...row.querySelectorAll<HTMLElement>(':scope > div')];
}

function hasContent(cell: Element | null | undefined): cell is Element {
  return !!cell && (textOf(cell) !== '' || !!cell.querySelector('picture, img, a'));
}

/** Only an explicit "false" turns the overlay off, so unset content keeps the default. */
function isOverlayEnabled(cell: Element | null | undefined): boolean {
  return !['false', 'no', 'disabled'].includes(textOf(cell).toLowerCase());
}

/**
 * In the editor every item row carries its model. Outside it the item models are
 * told apart by cell content: a ritual is the only item with more cells than the
 * card, and every gallery cell after the image holds either a picture or the
 * overlay flag, where the card also carries its name and role.
 */
function itemModelOf(row: HTMLElement): string | null {
  const model = row.dataset.aueModel;
  if (model) return [IMAGE_MODEL, CARD_MODEL, RITUAL_MODEL].includes(model) ? model : null;

  const cells = cellsOf(row);
  // a single cell is a block field, including the thumbnail group; gallery items
  // also carry their overlay flag cell
  if (cells.length < 2) return null;
  if (cells.length > CARD_CELL_COUNT) return RITUAL_MODEL;

  const isGalleryCell = (cell: Element): boolean =>
    !!cell.querySelector('picture, img') || ['', 'true', 'false'].includes(textOf(cell).toLowerCase());

  return cells.slice(1).every(isGalleryCell) ? IMAGE_MODEL : CARD_MODEL;
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

function siblingAltOf(picture: Element, cell: Element): string {
  let node = picture;
  while (node.parentElement && node.parentElement !== cell) node = node.parentElement;
  const next = node.nextElementSibling;
  return next && !next.matches('a, picture, img') && !next.querySelector('a, picture, img') ? textOf(next) : '';
}

function buildPicture(cell: Element | null | undefined): HTMLElement | null {
  const picture = cell?.querySelector('picture');
  if (!picture) return null;
  const img = picture.querySelector('img');
  if (img && !img.getAttribute('alt')) img.setAttribute('alt', altOf(cell));
  return picture;
}

/**
 * Reads an element-grouped CTA cell, which holds the label, the link and the
 * open-in-new-tab flag as separate children rather than as separate cells.
 */
function readCta(cell: Element | null | undefined): { label: string; href: string; openInNewTab: boolean } {
  const children = [...(cell?.children || [])];
  const link = cell?.querySelector('a');
  const isFlag = (element: Element): boolean => ['true', 'false'].includes(textOf(element).toLowerCase());
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

function buildCopy(row: Element | undefined, field: string): HTMLElement | null {
  return buildCopyFromCell(row?.firstElementChild, field);
}

function buildCopyFromCell(cell: Element | null | undefined, field: string): HTMLElement | null {
  if (!hasContent(cell)) return null;
  const wrapper = document.createElement('div');
  wrapper.className = `hotel-architect-${field}`;
  moveInstrumentation(cell, wrapper);
  while (cell.firstChild) wrapper.append(cell.firstChild);
  return wrapper;
}

/** Splits a node's own children at every direct `<br>`, or null when there is none. */
function linesOf(node: Element): DocumentFragment[] | null {
  if (![...node.childNodes].some((child) => child.nodeName === 'BR')) return null;

  const lines = [document.createDocumentFragment()];
  [...node.childNodes].forEach((child) => {
    if (child.nodeName === 'BR') lines.push(document.createDocumentFragment());
    else lines[lines.length - 1]!.append(child);
  });

  return lines.filter((line) => line.textContent?.trim());
}

function wrapLines(lines: DocumentFragment[], tagName: string): HTMLElement[] {
  return lines.map((line) => {
    // a fresh element rather than a clone, so no data-aue-* attribute is duplicated
    const element = document.createElement(tagName);
    element.append(line);
    return element;
  });
}

/**
 * Rewrites soft breaks as one paragraph per line so a heading written with `<br>`
 * lines up with one written as separate paragraphs. The stylesheet indents the
 * second child, which only works when each line is its own element. The breaks sit
 * either inside a paragraph or, when the field holds a single line of rich text,
 * directly in the authored cell.
 */
function splitOnLineBreaks(container: Element): void {
  const ownLines = linesOf(container);
  if (ownLines) {
    container.replaceChildren(...wrapLines(ownLines, 'p'));
    return;
  }

  [...container.children].forEach((element) => {
    const lines = linesOf(element);
    if (lines?.length) element.replaceWith(...wrapLines(lines, element.tagName));
  });
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

function buildSlide(row: HTMLElement, index: number): Slide {
  const cells = cellsOf(row);
  // older items may still carry a retired thumbnail picture after the image
  const imageCell = cells.find((cell) => cell.querySelector('picture')) ?? cells[0] ?? row;
  const flagCell = cells.find((cell) => ['true', 'false'].includes(textOf(cell).toLowerCase()));

  const element = document.createElement('li');
  element.className = 'hotel-architect-slide';
  moveInstrumentation(row, element);

  const picture = buildPicture(imageCell);
  if (picture) element.append(picture);
  if (!isOverlayEnabled(flagCell)) element.classList.add('hotel-architect-slide-no-overlay');

  return {
    element,
    // the picture has already left its cell, so its alt is the reliable label
    label: picture?.querySelector('img')?.getAttribute('alt') || `Show image ${index + 1}`,
  };
}

/**
 * Builds a ritual's slides from its primary-images multifield, which renders one
 * `<li><picture>` per entry. A cell that arrives without the list (for example
 * while the multi-field flag is off) still yields one slide per picture.
 */
function buildMediaSlides(cell: Element | null | undefined): Slide[] {
  if (!cell) return [];
  const listItems = [...cell.querySelectorAll<HTMLElement>('li')];
  const items = listItems.length ? listItems : [...cell.querySelectorAll<HTMLElement>('picture')];

  return items.map((item, index) => {
    const element = document.createElement('li');
    element.className = 'hotel-architect-slide';
    if (item.matches('li')) moveInstrumentation(item, element);

    const picture = item.matches('picture') ? item : buildPicture(item);
    if (picture) element.append(picture);

    return {
      element,
      label: picture?.querySelector('img')?.getAttribute('alt') || `Show image ${index + 1}`,
    };
  });
}

/**
 * Builds the static supporting gallery from the grouped thumbnail fields. These
 * images are content, not carousel controls, so they keep their authored alt text.
 */
function buildThumbs(cell: Element | null | undefined): HTMLUListElement | null {
  const pictures = [...(cell?.querySelectorAll<HTMLElement>('picture') ?? [])].slice(0, MAX_THUMBNAILS);
  if (!cell || !pictures.length) return null;

  const list = document.createElement('ul');
  list.className = 'hotel-architect-thumbs';
  moveInstrumentation(cell, list);

  pictures.forEach((picture) => {
    const img = picture.querySelector('img');
    if (img && !img.getAttribute('alt')) img.setAttribute('alt', siblingAltOf(picture, cell));

    const item = document.createElement('li');
    item.className = 'hotel-architect-thumb';
    item.append(picture);
    list.append(item);
  });

  return list;
}

/**
 * The thumbnail group is the last block field. Content created before it existed
 * emits no row, so only take the tail row when it has an image or the row count
 * proves that the field is present.
 */
function takeThumbnailsRow(rows: HTMLElement[]): HTMLElement | null {
  const last = rows[rows.length - 1];
  if (!last) return null;
  if (!last.querySelector('picture') && rows.length <= IDENTITY_ROW_COUNT + COPY_FIELDS.length) return null;
  return rows.pop() ?? null;
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

function buildHeader(
  eyebrowCell: Element | null | undefined,
  titleCell: Element | null | undefined,
): HTMLElement | null {
  const eyebrow = buildCopyFromCell(eyebrowCell, 'eyebrow');
  const title = buildCopyFromCell(titleCell, 'title');
  if (title) splitOnLineBreaks(title);
  if (!eyebrow && !title) return null;

  const header = document.createElement('div');
  header.className = 'hotel-architect-header';
  if (eyebrow) header.append(eyebrow);
  if (title) header.append(title);
  return header;
}

/**
 * Builds one primary media carousel. The arrows (and, where the design shows them,
 * the dots) only appear for two or more slides; selection wraps at either end.
 */
function buildGallery(slides: Slide[], { dots: withDots }: { dots: boolean }): HTMLElement {
  const track = document.createElement('ul');
  track.className = 'hotel-architect-track';
  slides.forEach((slide) => track.append(slide.element));

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

/* ---------- rituals ---------- */

const FLAGS = ['true', 'false'];

/**
 * Maps a ritual row's cells to its fields. Every field normally keeps its cell, so
 * they are read by position; a row with missing cells falls back to telling them
 * apart by content, where the CTA groups always end in their open-in-new-tab flag
 * and the required text fields fill the gaps left by the optional eyebrow.
 */
function ritualCellsOf(row: HTMLElement): Partial<Record<RitualField, HTMLElement>> {
  const cells = cellsOf(row);
  if (cells.length === RITUAL_FIELDS.length) {
    return Object.fromEntries(RITUAL_FIELDS.map((field, index) => [field, cells[index]]));
  }

  const isFlag = (element: Element | null): boolean => !!element && FLAGS.includes(textOf(element).toLowerCase());
  const ctaCells = cells.filter(
    (cell) => isFlag(cell) || (isFlag(cell.lastElementChild) && !cell.querySelector('picture')),
  );
  const media = cells.find((cell) => cell.querySelector('li picture'));
  const thumbnails = cells.find((cell) => cell !== media && cell.querySelector('picture'));
  const texts = cells.filter(
    (cell) => !ctaCells.includes(cell) && cell !== media && cell !== thumbnails && hasContent(cell),
  );
  const [tabLabel, ...rest] = texts;
  const [eyebrow, title, body] = rest.length >= 3 ? rest : [undefined, ...rest];

  return { tabLabel, eyebrow, title, body, media, thumbnails, primaryCta: ctaCells[0], secondaryCta: ctaCells[1] };
}

interface Ritual {
  label: string;
  panel: HTMLElement;
  media: HTMLElement;
}

function buildRitual(row: HTMLElement, index: number): Ritual {
  const cells = ritualCellsOf(row);

  // the panel holds the editable copy, so it carries the item's instrumentation
  const panel = document.createElement('div');
  panel.className = 'hotel-architect-panel';
  panel.dataset.index = String(index);
  moveInstrumentation(row, panel);

  const header = buildHeader(cells.eyebrow, cells.title);
  const body = buildCopyFromCell(cells.body, 'body');
  const thumbs = buildThumbs(cells.thumbnails);
  const cta = buildCtas(cells.primaryCta, cells.secondaryCta);
  [header, body, thumbs, cta].forEach((part) => part && panel.append(part));

  // the design shows only the arrows on a ritual's media, never the dots
  const media = buildGallery(buildMediaSlides(cells.media), { dots: false });
  media.dataset.index = String(index);

  return {
    // a ritual just added in the editor has no label yet, but still needs a tab
    label: textOf(cells.tabLabel) || `Ritual ${index + 1}`,
    panel,
    media,
  };
}

function buildTab(ritual: Ritual, index: number, blockId: string): HTMLButtonElement {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'hotel-architect-tab';
  tab.id = `${blockId}-tab-${index}`;
  tab.dataset.index = String(index);
  tab.dataset.testid = 'hotel-architect-tab';
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', ritual.panel.id);
  tab.textContent = ritual.label;
  return tab;
}

/** Fades the tab bar's trailing edge while more tabs are scrolled out of view. */
function trackOverflow(tablist: HTMLElement): void {
  const sync = (): void => {
    const remaining = tablist.scrollWidth - tablist.clientWidth - Math.abs(tablist.scrollLeft);
    // +1 absorbs the sub-pixel difference these report at fractional widths
    tablist.classList.toggle('has-more', remaining > 1);
  };
  tablist.addEventListener('scroll', sync, { passive: true });
  new ResizeObserver(sync).observe(tablist);
}

/**
 * Renders the tabbed ritual variation: each ritual brings its own copy, thumbnails,
 * CTAs and primary media carousel, and a tab bar switches between them. A single
 * ritual renders without the tab bar. The architect card is not part of this
 * variation, so card items are not rendered.
 */
function decorateRituals(block: HTMLElement, rows: HTMLElement[]): void {
  blockCount += 1;
  const blockId = `hotel-architect-${blockCount}`;
  const rituals = rows.map(buildRitual);
  const tabbed = rituals.length > 1;

  block.classList.add('hotel-architect-rituals');

  const copy = document.createElement('div');
  copy.className = 'hotel-architect-copy';

  const tablist = document.createElement('div');
  tablist.className = 'hotel-architect-tabs';
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Rituals');

  const tabs = rituals.map((ritual, index) => {
    ritual.panel.id = `${blockId}-panel-${index}`;
    if (tabbed) {
      ritual.panel.setAttribute('role', 'tabpanel');
      ritual.panel.setAttribute('aria-labelledby', `${blockId}-tab-${index}`);
    }
    return buildTab(ritual, index, blockId);
  });

  if (tabbed) {
    tablist.append(...tabs);
    copy.append(tablist);
  }
  rituals.forEach((ritual) => copy.append(ritual.panel));

  block.append(copy, ...rituals.map((ritual) => ritual.media));

  let selected = -1;
  const select = (index: number, reveal = false): void => {
    if (index === selected || !rituals[index]) return;
    selected = index;
    rituals.forEach((ritual, i) => {
      const active = i === selected;
      ritual.panel.hidden = !active;
      ritual.media.hidden = !active;
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

  // selecting a ritual in the editor rail, or editing its copy inline, should
  // reveal the matching tab
  const revealFromEvent = (event: Event): void => {
    const owner = (event.target as Element | null)?.closest?.<HTMLElement>(
      '.hotel-architect-panel, .hotel-architect-media',
    );
    if (owner?.dataset.index) select(Number(owner.dataset.index));
  };
  block.addEventListener('aue:ui-select', revealFromEvent);
  block.addEventListener('focusin', revealFromEvent);
}

/**
 * @param block The block element
 */
export default function decorate(block: HTMLElement): void {
  const rows = [...block.children] as HTMLElement[];
  const models = new Map(rows.map((row) => [row, itemModelOf(row)]));
  const imageRows = rows.filter((row) => models.get(row) === IMAGE_MODEL);
  const cardRows = rows.filter((row) => models.get(row) === CARD_MODEL);
  const ritualRows = rows.filter((row) => models.get(row) === RITUAL_MODEL);
  const blockRows = rows.filter((row) => !models.get(row));
  const thumbnailsRow = takeThumbnailsRow(blockRows);
  const copyRows = applyBlockIdentity(block, blockRows, { contentRows: COPY_FIELDS.length });

  block.textContent = '';
  block.dataset.testid = 'hotel-architect';

  // rituals replace the block-level copy, gallery and card with their own
  if (ritualRows.length) {
    decorateRituals(block, ritualRows);
    return;
  }

  const header = buildHeader(copyRows[0]?.firstElementChild, copyRows[1]?.firstElementChild);
  const body = buildCopy(copyRows[2], COPY_FIELDS[2]);
  const cta = buildCtas(copyRows[3]?.firstElementChild, copyRows[4]?.firstElementChild);
  const thumbs = buildThumbs(thumbnailsRow?.firstElementChild);
  const media = buildGallery(imageRows.map(buildSlide), { dots: true });

  if (cardRows.length) {
    const cards = document.createElement('div');
    cards.className = 'hotel-architect-cards';
    cardRows.forEach((row) => cards.append(buildCard(row)));
    media.append(cards);
  }

  // the copy children share a wrapper so desktop can lay them out as one flex
  // column beside the media; below desktop the wrapper is `display: contents`
  const copy = document.createElement('div');
  copy.className = 'hotel-architect-copy';
  [header, body, thumbs, cta].forEach((part) => part && copy.append(part));

  block.append(copy);
  // appended even when empty so the editor still offers the gallery container
  block.append(media);
}
