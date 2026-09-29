import { moveInstrumentation } from '@/app/scripts.js';
import { resolveDAMUrl } from '@/utils/env.js';
import { applyBlockIdentity } from '@/utils/block-identity.js';

// Row indices mirror the field order of the `destination-introduction` model
// (eyebrow, title, body, footerCta), after the leading identity rows. Changing
// that field list is a contract change and must update these indices in the
// same commit.
const COPY_FIELDS = ['eyebrow', 'title', 'body', 'cta'] as const;
const IMAGE_MODEL = 'destination-introduction-image';
// Cell indices mirror the field order of the `destination-introduction-image`
// model; the `*Alt` fields collapse into the cell of the field they suffix and
// so claim no index of their own.
const ITEM = { thumbnail: 0, media: 1, mediaAsset: 2 } as const;
const SCROLL_SETTLE_MS = 120;

// Exported from the Figma "arrow-icon" component (28x28). fill is currentColor
// so the stylesheet owns the colour.
const ARROW_PATHS: Record<'prev' | 'next', string> = {
  prev: 'M19.71 4C15.98 7.16 12.47 10.56 9 14C10.79 15.78 12.59 17.56 14.44 19.27C15.96 20.68 18.13 22.69 19.71 24C16.71 20.46 11 14 11 14C11 14 18.2116 5.76279 19.71 4Z',
  next: 'M9 4C12.73 7.16 16.24 10.56 19.71 14C17.92 15.78 16.12 17.56 14.27 19.27C12.75 20.68 10.58 22.69 9 24C12 20.46 17.5 14 17.5 14C17.5 14 10.4984 5.76279 9 4Z',
};

function textOf(cell?: Element | null): string {
  return cell?.textContent?.trim() || '';
}

function hasContent(cell: Element | null): cell is Element {
  return !!cell && (cell.textContent?.trim() !== '' || !!cell.querySelector('picture, img, a'));
}

// In the editor every gallery row carries the item model. Outside it a gallery row
// is either multi-cell — every block-level field emits a single cell — or the single
// image cell that items authored before the media fields existed still emit.
function isGalleryRow(row: HTMLElement): boolean {
  if (row.dataset.aueModel) return row.dataset.aueModel === IMAGE_MODEL;
  return row.children.length > 1 || !!row.querySelector('picture, img');
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

/** Alt text collapses into the cell of the field it suffixes, arriving as a sibling of the asset. */
function altOf(cell?: Element | null): string {
  const authored = cell?.querySelector('img')?.getAttribute('alt');
  if (authored) return authored;
  // a video cell holds only its link, whose text is the asset URL and not a description
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

function buildVideo(cell: Element | null | undefined, poster: string): HTMLVideoElement | null {
  const href = cell?.querySelector('a')?.getAttribute('href');
  if (!href) return null;

  const video = document.createElement('video');
  video.muted = true;
  // of the four, `muted` is the only property that does not reflect to an attribute,
  // and both the autoplay policy and the editor's re-parse of the markup read attributes
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  if (poster) video.poster = poster;
  const description = altOf(cell);
  if (description) video.setAttribute('aria-label', description);

  const source = document.createElement('source');
  source.src = resolveDAMUrl(href);
  video.append(source);

  return video;
}

interface Slide {
  element: HTMLLIElement;
  video: HTMLVideoElement | null;
  thumbnail: Element | null;
  label: string;
}

function buildSlide(row: HTMLElement, index: number): Slide {
  const cells = [...row.children];
  const element = document.createElement('li');
  element.className = 'destination-introduction-slide';
  moveInstrumentation(row, element);

  const thumbnailCell = cells[ITEM.thumbnail];
  const thumbnail = thumbnailCell?.querySelector('picture') ?? null;
  // items authored before the media fields existed carry one image cell, which
  // stands in for both the thumbnail and the media
  const mediaCell = cells.length > 1 ? cells[ITEM.mediaAsset] : thumbnailCell;
  const isVideo = textOf(cells[ITEM.media]).toLowerCase() === 'video';
  const poster = thumbnail?.querySelector('img')?.getAttribute('src') || '';
  const video = isVideo ? buildVideo(mediaCell, poster) : null;
  const picture = isVideo ? null : buildPicture(mediaCell);
  const media = video ?? picture;
  if (media) element.append(media);

  return {
    element,
    video,
    // without an authored thumbnail an image slide can still supply one; a video
    // slide cannot, so it falls back to a numbered button
    thumbnail: thumbnail ?? picture,
    label: altOf(thumbnailCell) || altOf(mediaCell) || `Show media ${index + 1}`,
  };
}

function buildTrack(slides: Slide[]): HTMLUListElement {
  const track = document.createElement('ul');
  track.className = 'destination-introduction-track';
  slides.forEach((slide) => track.append(slide.element));
  return track;
}

function buildThumbs(slides: Slide[]): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'destination-introduction-thumbs';

  slides.forEach((slide, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'destination-introduction-thumb';
    button.dataset.index = String(index);
    button.setAttribute('aria-label', slide.label);

    if (slide.thumbnail) {
      const clone = slide.thumbnail.cloneNode(true) as Element;
      // the clone would otherwise carry a copy of the item's data-aue-* attributes,
      // which makes the editor list every gallery item twice in the content tree
      [clone, ...clone.querySelectorAll('*')].forEach((element) => moveInstrumentation(element, null));
      // the button is already labelled, so the thumbnail is decorative here
      clone.querySelector('img')?.setAttribute('alt', '');
      button.append(clone);
    }

    item.append(button);
    list.append(item);
  });

  return list;
}

/**
 * @param block The block element
 */
export default function decorate(block: HTMLElement): void {
  const rows = [...block.children] as HTMLElement[];
  const galleryRows = rows.filter(isGalleryRow);
  const copyRows = applyBlockIdentity(
    block,
    rows.filter((row) => !galleryRows.includes(row)),
    { contentRows: COPY_FIELDS.length },
  );

  const header = document.createElement('div');
  header.className = 'destination-introduction-header';
  const eyebrow = buildCopy(copyRows[0], COPY_FIELDS[0]);
  const title = buildCopy(copyRows[1], COPY_FIELDS[1]);
  if (title) splitOnLineBreaks(title);
  if (eyebrow) header.append(eyebrow);
  if (title) header.append(title);

  const body = buildCopy(copyRows[2], COPY_FIELDS[2]);
  const cta = buildCopy(copyRows[3], COPY_FIELDS[3]);

  const slides = galleryRows.map(buildSlide);
  const track = buildTrack(slides);
  const interactive = slides.length > 1;

  const media = document.createElement('div');
  media.className = 'destination-introduction-media';
  media.append(track);

  const prev = interactive ? buildArrow('prev', 'Previous image') : null;
  const next = interactive ? buildArrow('next', 'Next image') : null;
  if (prev && next) media.append(prev, next);

  const thumbs = interactive ? buildThumbs(slides) : null;

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

  if (!slides.length) return;

  const videos = slides.map((slide) => slide.video).filter((video): video is HTMLVideoElement => video !== null);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const thumbButtons = [...(thumbs?.querySelectorAll('.destination-introduction-thumb') ?? [])];
  let selected = -1;

  const select = (index: number): void => {
    const target = Math.max(0, Math.min(index, slides.length - 1));
    if (target === selected) return;
    selected = target;

    slides.forEach((slide, i) => {
      const active = i === selected;
      slide.element.classList.toggle('is-selected', active);

      if (!slide.video) return;
      if (active && !reduceMotion.matches) {
        void slide.video.play().catch(() => {
          /* autoplay can still be refused; the poster stays visible */
        });
      } else {
        slide.video.pause();
        slide.video.currentTime = 0;
      }
    });

    thumbButtons.forEach((thumb, i) => {
      if (i === selected) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });
  };

  // Below desktop the track scrolls, so the live index comes from scroll
  // position; at desktop it never scrolls and `selected` stays authoritative.
  const currentIndex = (): number => {
    const first = slides[0]?.element;
    const second = slides[1]?.element;
    if (!first || !second) return selected;
    const step = second.offsetLeft - first.offsetLeft;
    return step > 0 ? Math.round(track.scrollLeft / step) : selected;
  };

  const scrollToIndex = (index: number): void => {
    const target = slides[Math.max(0, Math.min(index, slides.length - 1))]?.element;
    if (target) track.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  };

  prev?.addEventListener('click', () => scrollToIndex(currentIndex() - 1));
  next?.addEventListener('click', () => scrollToIndex(currentIndex() + 1));

  thumbs?.addEventListener('click', (event) => {
    const thumb = (event.target as HTMLElement).closest('.destination-introduction-thumb');
    if (thumb instanceof HTMLElement && thumb.dataset.index) select(Number(thumb.dataset.index));
  });

  // below desktop the slide in view is the one the reader chose, so playback
  // follows the scroll position rather than the thumbnails
  let settle = 0;
  track.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => select(currentIndex()), SCROLL_SETTLE_MS);
    },
    { passive: true },
  );

  select(0);

  if (!videos.length) return;

  // `preload="none"` keeps the videos off the critical path; they start buffering
  // once the block is near the viewport, so switching slide is not a cold start
  const preloader = new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      videos.forEach((video) => {
        video.preload = 'auto';
        // a video already playing is loading anyway, and load() would restart it
        if (video.paused) video.load();
      });
    },
    { rootMargin: '200px' },
  );
  preloader.observe(block);

  // the editor replaces the block element on every item change, so the observer
  // must not outlive the DOM it was measuring
  const parent = block.parentElement;
  if (!parent) return;
  const watcher = new MutationObserver(() => {
    if (block.isConnected) return;
    preloader.disconnect();
    watcher.disconnect();
    window.clearTimeout(settle);
  });
  watcher.observe(parent, { childList: true });
}
