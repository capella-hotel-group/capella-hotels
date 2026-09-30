import { moveInstrumentation } from '@/app/scripts';
import { applyBlockIdentity } from '@/utils/block-identity';

// Row indices mirror the field order of the `hotel-architect` model after the
// leading identity rows. Changing that field list is a contract change and must
// update these indices in the same commit.
const COPY_FIELDS = ['eyebrow', 'title', 'body', 'primaryCta', 'secondaryCta'] as const;

const IMAGE_MODEL = 'hotel-architect-image';
const CARD_MODEL = 'hotel-architect-card';

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
 * In the editor every item row carries its model. Outside it the two item models
 * are told apart by cell content: every gallery cell after the image holds either
 * a picture or the overlay flag, where the card also carries its name and role.
 */
function itemModelOf(row: HTMLElement): string | null {
  const model = row.dataset.aueModel;
  if (model) return model === IMAGE_MODEL || model === CARD_MODEL ? model : null;

  const cells = cellsOf(row);
  if (!cells.length) return null;

  // none of this block's own fields is an asset, so a lone picture is a gallery item
  if (cells.length === 1) return cells[0]!.querySelector('picture, img') ? IMAGE_MODEL : null;

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
  const cell = row?.firstElementChild ?? null;
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
  picture: HTMLElement | null;
  thumbnail: HTMLElement | null;
  label: string;
}

function buildSlide(row: HTMLElement, index: number): Slide {
  const cells = cellsOf(row);
  // both assets arrive as pictures, so they are told apart by order rather than
  // by index, which would shift whenever a cell is dropped
  const assetCells = cells.filter((cell) => cell.querySelector('picture'));
  const [imageCell, thumbnailCell] = assetCells.length ? assetCells : [cells[0] ?? row];
  const flagCell = cells.find((cell) => ['true', 'false'].includes(textOf(cell).toLowerCase()));

  const element = document.createElement('li');
  element.className = 'hotel-architect-slide';
  moveInstrumentation(row, element);

  const picture = buildPicture(imageCell);
  if (picture) element.append(picture);
  if (!isOverlayEnabled(flagCell)) element.classList.add('hotel-architect-slide-no-overlay');

  return {
    element,
    picture,
    thumbnail: buildPicture(thumbnailCell),
    label: altOf(imageCell) || altOf(thumbnailCell) || `Show image ${index + 1}`,
  };
}

function buildThumbs(slides: Slide[]): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'hotel-architect-thumbs';

  slides.forEach((slide, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotel-architect-thumb';
    button.dataset.index = String(index);
    button.dataset.testid = 'hotel-architect-thumb';
    button.setAttribute('aria-label', slide.label);

    // an authored thumbnail is used as-is; without one the slide's own image
    // stands in, and its copy must shed the item's data-aue-* attributes or the
    // editor lists every gallery item twice in the content tree
    let thumbnail = slide.thumbnail;
    if (!thumbnail && slide.picture) {
      thumbnail = slide.picture.cloneNode(true) as HTMLElement;
      [thumbnail, ...thumbnail.querySelectorAll('*')].forEach((element) => moveInstrumentation(element, null));
    }

    if (thumbnail) {
      // the button is already labelled, so the thumbnail is decorative here
      thumbnail.querySelector('img')?.setAttribute('alt', '');
      button.append(thumbnail);
    }

    item.append(button);
    list.append(item);
  });

  return list;
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
 * @param block The block element
 */
export default function decorate(block: HTMLElement): void {
  const rows = [...block.children] as HTMLElement[];
  const models = new Map(rows.map((row) => [row, itemModelOf(row)]));
  const imageRows = rows.filter((row) => models.get(row) === IMAGE_MODEL);
  const cardRows = rows.filter((row) => models.get(row) === CARD_MODEL);
  const copyRows = applyBlockIdentity(
    block,
    rows.filter((row) => !models.get(row)),
    { contentRows: COPY_FIELDS.length },
  );

  const header = document.createElement('div');
  header.className = 'hotel-architect-header';
  const eyebrow = buildCopy(copyRows[0], COPY_FIELDS[0]);
  const title = buildCopy(copyRows[1], COPY_FIELDS[1]);
  if (title) splitOnLineBreaks(title);
  if (eyebrow) header.append(eyebrow);
  if (title) header.append(title);

  const body = buildCopy(copyRows[2], COPY_FIELDS[2]);

  const links = [
    buildLink(copyRows[3]?.firstElementChild, 'hotel-architect-primary-cta'),
    buildLink(copyRows[4]?.firstElementChild, 'hotel-architect-secondary-cta'),
  ].filter((link): link is HTMLAnchorElement => link !== null);

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

  const slides = imageRows.map(buildSlide);
  const track = document.createElement('ul');
  track.className = 'hotel-architect-track';
  slides.forEach((slide) => track.append(slide.element));

  const interactive = slides.length > 1;
  const prev = interactive ? buildArrow('prev', 'Previous image') : null;
  const next = interactive ? buildArrow('next', 'Next image') : null;
  const dots = interactive ? buildDots(slides) : null;
  const thumbs = interactive ? buildThumbs(slides) : null;

  const frame = document.createElement('div');
  frame.className = 'hotel-architect-frame';
  frame.append(track);
  if (prev && next) frame.append(prev, next);
  if (dots) frame.append(dots);

  const media = document.createElement('div');
  media.className = 'hotel-architect-media';
  media.append(frame);

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
  if (header.childElementCount > 0) copy.append(header);
  if (body) copy.append(body);
  if (thumbs) copy.append(thumbs);
  if (cta.childElementCount > 0) copy.append(cta);

  block.textContent = '';
  block.dataset.testid = 'hotel-architect';
  block.append(copy);
  // appended even when empty so the editor still offers the gallery container
  block.append(media);

  if (!slides.length) return;

  const thumbButtons = [...(thumbs?.querySelectorAll<HTMLElement>('.hotel-architect-thumb') ?? [])];
  const dotButtons = [...(dots?.querySelectorAll<HTMLElement>('.hotel-architect-dot') ?? [])];
  let selected = -1;

  const select = (index: number): void => {
    // wraps, so the arrows keep working at either end of the gallery
    const target = (index + slides.length) % slides.length;
    if (target === selected) return;
    selected = target;

    slides.forEach((slide, i) => slide.element.classList.toggle('is-selected', i === selected));
    [...thumbButtons, ...dotButtons].forEach((button) => {
      const active = Number(button.dataset.index) === selected;
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  };

  prev?.addEventListener('click', () => select(selected - 1));
  next?.addEventListener('click', () => select(selected + 1));

  [thumbs, dots].forEach((list) =>
    list?.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('button[data-index]');
      if (button) select(Number(button.dataset.index));
    }),
  );

  select(0);
}
