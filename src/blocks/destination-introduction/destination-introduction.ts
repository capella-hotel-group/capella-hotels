import { moveInstrumentation } from '@/app/scripts.js';

// Row indices mirror the field order of the `destination-introduction` model
// (eyebrow, title, body, footerCta). Changing that field list is a contract
// change and must update these indices in the same commit.
const COPY_FIELDS = ['eyebrow', 'title', 'body', 'cta'] as const;
const GALLERY_START = COPY_FIELDS.length;

// Exported from the Figma "arrow-icon" component (28x28). fill is currentColor
// so the stylesheet owns the colour.
const ARROW_PATHS: Record<'prev' | 'next', string> = {
  prev: 'M19.71 4C15.98 7.16 12.47 10.56 9 14C10.79 15.78 12.59 17.56 14.44 19.27C15.96 20.68 18.13 22.69 19.71 24C16.71 20.46 11 14 11 14C11 14 18.2116 5.76279 19.71 4Z',
  next: 'M9 4C12.73 7.16 16.24 10.56 19.71 14C17.92 15.78 16.12 17.56 14.27 19.27C12.75 20.68 10.58 22.69 9 24C12 20.46 17.5 14 17.5 14C17.5 14 10.4984 5.76279 9 4Z',
};

function hasContent(cell: Element | null): cell is Element {
  return !!cell && (cell.textContent?.trim() !== '' || !!cell.querySelector('picture, img, a'));
}

function buildArrow(direction: 'prev' | 'next', label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `destination-introduction-nav destination-introduction-nav-${direction}`;
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

function buildCopy(row: Element | undefined, field: string): HTMLElement | null {
  const cell = row?.firstElementChild ?? null;
  if (!hasContent(cell)) return null;
  const wrapper = document.createElement('div');
  wrapper.className = `destination-introduction-${field}`;
  moveInstrumentation(cell, wrapper);
  while (cell.firstChild) wrapper.append(cell.firstChild);
  return wrapper;
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

function buildTrack(rows: Element[]): HTMLUListElement {
  const track = document.createElement('ul');
  track.className = 'destination-introduction-track';

  rows.forEach((row) => {
    const slide = document.createElement('li');
    slide.className = 'destination-introduction-slide';
    moveInstrumentation(row, slide);
    const cell = row.firstElementChild;
    if (cell) while (cell.firstChild) slide.append(cell.firstChild);
    track.append(slide);
  });

  return track;
}

function buildThumbs(track: HTMLUListElement): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'destination-introduction-thumbs';

  [...track.children].forEach((slide, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'destination-introduction-thumb';
    button.dataset.index = String(index);

    const picture = slide.querySelector('picture');
    if (picture) {
      const thumbPicture = picture.cloneNode(true) as Element;
      // the clone would otherwise carry a copy of the item's data-aue-* attributes,
      // which makes the editor list every gallery image twice in the content tree
      [thumbPicture, ...thumbPicture.querySelectorAll('*')].forEach((element) => moveInstrumentation(element, null));
      button.append(thumbPicture);
    }
    const alt = slide.querySelector('img')?.alt;
    button.setAttribute('aria-label', alt || `Show image ${index + 1}`);

    item.append(button);
    list.append(item);
  });

  return list;
}

/**
 * @param block The block element
 */
export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const galleryRows = rows.slice(GALLERY_START);

  const header = document.createElement('div');
  header.className = 'destination-introduction-header';
  const eyebrow = buildCopy(rows[0], COPY_FIELDS[0]);
  const title = buildCopy(rows[1], COPY_FIELDS[1]);
  if (title) splitOnLineBreaks(title);
  if (eyebrow) header.append(eyebrow);
  if (title) header.append(title);

  const body = buildCopy(rows[2], COPY_FIELDS[2]);
  const cta = buildCopy(rows[3], COPY_FIELDS[3]);

  const track = buildTrack(galleryRows);
  const slides = [...track.children] as HTMLElement[];
  const interactive = slides.length > 1;

  const media = document.createElement('div');
  media.className = 'destination-introduction-media';
  media.append(track);

  const prev = interactive ? buildArrow('prev', 'Previous image') : null;
  const next = interactive ? buildArrow('next', 'Next image') : null;
  if (prev && next) media.append(prev, next);

  const thumbs = interactive ? buildThumbs(track) : null;

  // the copy children share a wrapper so desktop can lay them out as one flex
  // column beside the media; below desktop the wrapper is `display: contents`
  const copy = document.createElement('div');
  copy.className = 'destination-introduction-copy';
  if (header.childElementCount > 0) copy.append(header);
  if (body) copy.append(body);
  if (thumbs) copy.append(thumbs);
  if (cta) copy.append(cta);

  block.textContent = '';
  block.append(copy);
  // appended even when empty so the editor still offers the gallery container
  block.append(media);

  if (!interactive) return;

  const thumbButtons = [...(thumbs?.querySelectorAll('.destination-introduction-thumb') ?? [])];
  let selected = 0;

  const select = (index: number): void => {
    selected = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, i) => slide.classList.toggle('is-selected', i === selected));
    thumbButtons.forEach((thumb, i) => {
      if (i === selected) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
  };

  // Below desktop the track scrolls, so the live index comes from scroll
  // position; at desktop it never scrolls and `selected` stays authoritative.
  const currentIndex = (): number => {
    const first = slides[0];
    const second = slides[1];
    if (!first || !second) return selected;
    const step = second.offsetLeft - first.offsetLeft;
    return step > 0 ? Math.round(track.scrollLeft / step) : selected;
  };

  const scrollToIndex = (index: number): void => {
    const target = slides[Math.max(0, Math.min(index, slides.length - 1))];
    if (target) track.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  };

  prev?.addEventListener('click', () => scrollToIndex(currentIndex() - 1));
  next?.addEventListener('click', () => scrollToIndex(currentIndex() + 1));

  thumbs?.addEventListener('click', (event) => {
    const thumb = (event.target as HTMLElement).closest('.destination-introduction-thumb');
    if (thumb instanceof HTMLElement && thumb.dataset.index) select(Number(thumb.dataset.index));
  });

  select(0);
}
