import { moveInstrumentation } from '@/app/scripts';
import { resolveDAMUrl } from '@/utils/env';
import { applyBlockIdentity } from '@/utils/block-identity';

// Row indices mirror the field order of the `destination-introduction` model
// (eyebrow, title, body), after the leading identity rows. The three media groups
// follow these copy fields. Changing that field list is a contract change and must
// update these indices in the same commit.
const COPY_FIELDS = ['eyebrow', 'title', 'body'] as const;
const IDENTITY_ROW_COUNT = 2;
const MEDIA_GROUP_COUNT = 3;
const MEDIA_FORMATS = ['image', 'video'];
const LEGACY_ITEM_MODEL = 'destination-introduction-image';
// Cell indices mirror the retired `destination-introduction-image` item model,
// still read so pages authored before the media groups keep rendering.
const LEGACY_ITEM = { thumbnail: 0, media: 1, mediaAsset: 2, darkOverlay: 3 } as const;
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

function hasAsset(element: Element): boolean {
  return element.matches('picture, img, a') || !!element.querySelector('picture, img, a');
}

function isFormat(element: Element): boolean {
  return MEDIA_FORMATS.includes(textOf(element).toLowerCase()) && !hasAsset(element);
}

function isFlag(element: Element): boolean {
  return ['true', 'false'].includes(textOf(element).toLowerCase());
}

// Retired item rows carry their model in the editor. Published item rows have
// several cells, where every block-level field, media groups included, has one.
function isLegacyItemRow(row: HTMLElement): boolean {
  if (row.dataset.aueModel) return row.dataset.aueModel === LEGACY_ITEM_MODEL;
  return row.children.length > 1;
}

function isMediaGroupRow(row: HTMLElement): boolean {
  const cells = [...row.children];
  if (cells.length !== 1) return false;
  return !!cells[0]!.querySelector('picture') || [...cells[0]!.children].some(isFormat);
}

/**
 * The media groups are the last block fields. A group that was never edited may
 * emit an empty row or no row at all, so trailing rows are taken back to the copy
 * fields while an empty row inside the copy range is left as an unset copy field.
 */
function takeMediaRows(rows: HTMLElement[]): HTMLElement[] {
  const taken: HTMLElement[] = [];
  while (taken.length < MEDIA_GROUP_COUNT && rows.length > COPY_FIELDS.length) {
    const last = rows[rows.length - 1]!;
    const media = isMediaGroupRow(last);
    if (!media && (hasContent(last) || rows.length <= IDENTITY_ROW_COUNT + COPY_FIELDS.length)) break;
    taken.unshift(rows.pop()!);
  }
  return taken.filter(isMediaGroupRow);
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
 * Pages published before the footer CTA was retired still deliver its grouped
 * label, link and new-tab flag after the copy fields until they are republished.
 */
function isRetiredCtaRow(row: HTMLElement | undefined): boolean {
  const cell = row?.children.length === 1 ? row.firstElementChild : null;
  return !!cell?.querySelector('a[href]') && [...cell.children].some(isFlag);
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

interface MediaSource {
  thumbnailCell: Element | null;
  assetCell: Element | null;
  isVideo: boolean;
  darkOverlay: boolean;
  instrumentation: HTMLElement | null;
}

interface Slide {
  element: HTMLLIElement;
  video: HTMLVideoElement | null;
  thumbnail: Element | null;
  authoredThumbnail: boolean;
  label: string;
}

function wrapFields(...elements: (Element | null | undefined)[]): Element | null {
  const fields = elements.filter((element): element is Element => !!element);
  if (!fields.length) return null;
  const wrapper = document.createElement('div');
  wrapper.append(...fields);
  return wrapper;
}

function altSiblingOf(element: Element | undefined): Element | null {
  const sibling = element?.nextElementSibling;
  return sibling && !hasAsset(sibling) && !isFormat(sibling) && !isFlag(sibling) ? sibling : null;
}

/**
 * Reads one element group. The format separates the thumbnail from the media,
 * which are both pictures, regardless of whether the optional thumbnail exists.
 */
function readMediaGroup(row: HTMLElement): MediaSource {
  const children = [...(row.firstElementChild?.children ?? [])];
  const formatIndex = children.findIndex(isFormat);
  const before = formatIndex >= 0 ? children.slice(0, formatIndex) : [];
  const after = formatIndex >= 0 ? children.slice(formatIndex + 1) : children;
  const leadingAssets = before.filter(hasAsset);
  const trailingAssets = after.filter(hasAsset);
  if (formatIndex < 0 && trailingAssets.length > 1) leadingAssets.push(trailingAssets.shift()!);

  const thumbnail = leadingAssets[0];
  const asset = trailingAssets[0];
  const thumbnailAlt = altSiblingOf(thumbnail);
  const assetAlt = altSiblingOf(asset);

  return {
    thumbnailCell: wrapFields(thumbnail, thumbnailAlt),
    assetCell: wrapFields(asset, assetAlt),
    isVideo: formatIndex >= 0 && textOf(children[formatIndex]).toLowerCase() === 'video',
    darkOverlay: after.some((element) => textOf(element).toLowerCase() === 'true'),
    instrumentation: null,
  };
}

function readLegacyItem(row: HTMLElement): MediaSource {
  const cells = [...row.children];
  return {
    thumbnailCell: cells[LEGACY_ITEM.thumbnail] ?? null,
    assetCell: cells[LEGACY_ITEM.mediaAsset] ?? null,
    isVideo: textOf(cells[LEGACY_ITEM.media]).toLowerCase() === 'video',
    darkOverlay: textOf(cells[LEGACY_ITEM.darkOverlay]).toLowerCase() === 'true',
    instrumentation: row,
  };
}

function buildSlide(source: MediaSource, index: number): Slide {
  const element = document.createElement('li');
  element.className = 'destination-introduction-slide';
  if (source.instrumentation) moveInstrumentation(source.instrumentation, element);

  const thumbnail = source.thumbnailCell?.querySelector('picture') ?? null;
  const poster = thumbnail?.querySelector('img')?.getAttribute('src') || '';
  const video = source.isVideo ? buildVideo(source.assetCell, poster) : null;
  const picture = source.isVideo ? null : buildPicture(source.assetCell);
  const media = video ?? picture;
  if (media) element.append(media);
  // the tint belongs to the hero media, so the thumbnail clone never inherits it
  if (source.darkOverlay) element.classList.add('has-dark-overlay');

  return {
    element,
    video,
    // without an authored thumbnail an image slide can still supply one; a video
    // slide cannot, so it falls back to a numbered button
    thumbnail: thumbnail ?? picture,
    authoredThumbnail: !!thumbnail,
    // the media has already left its source, so read the label from the built element
    label:
      altOf(source.thumbnailCell) ||
      picture?.querySelector('img')?.getAttribute('alt') ||
      video?.getAttribute('aria-label') ||
      `Show media ${index + 1}`,
  };
}

function cloneSlide(slide: HTMLElement): HTMLElement {
  const clone = slide.cloneNode(true) as HTMLElement;
  clone.classList.add('destination-introduction-slide-clone');
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  [clone, ...clone.querySelectorAll('*')].forEach((element) => moveInstrumentation(element, null));
  clone.querySelectorAll('img').forEach((img) => {
    img.loading = 'lazy';
  });
  clone.querySelectorAll('video').forEach((video) => {
    video.preload = 'none';
  });
  return clone;
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
  const legacyRows = rows.filter(isLegacyItemRow);
  const blockRows = rows.filter((row) => !legacyRows.includes(row));
  const mediaRows = takeMediaRows(blockRows);
  if (isRetiredCtaRow(blockRows[blockRows.length - 1])) blockRows.pop();
  const copyRows = applyBlockIdentity(block, blockRows, { contentRows: COPY_FIELDS.length });
  const groupSources = mediaRows.map(readMediaGroup).filter((source) => source.assetCell || source.thumbnailCell);
  const sources = (groupSources.length ? groupSources : legacyRows.map(readLegacyItem)).slice(0, MEDIA_GROUP_COUNT);

  const header = document.createElement('div');
  header.className = 'destination-introduction-header';
  const eyebrow = buildCopy(copyRows[0], COPY_FIELDS[0]);
  const title = buildCopy(copyRows[1], COPY_FIELDS[1]);
  if (title) splitOnLineBreaks(title);
  if (eyebrow) header.append(eyebrow);
  if (title) header.append(title);

  const body = buildCopy(copyRows[2], COPY_FIELDS[2]);

  const slides = sources.map(buildSlide);
  const track = buildTrack(slides);
  const interactive = slides.length > 1;

  const media = document.createElement('div');
  media.className = 'destination-introduction-media';
  media.append(track);

  const prev = interactive ? buildArrow('prev', 'Previous image') : null;
  const next = interactive ? buildArrow('next', 'Next image') : null;
  if (prev && next) media.append(prev, next);

  // a lone slide has nothing to swap to, but an authored thumbnail is still
  // content the author asked to see beneath the copy
  const thumbs = interactive || slides.some((slide) => slide.authoredThumbnail) ? buildThumbs(slides) : null;

  // the copy children share a wrapper so desktop can lay them out as one flex
  // column beside the media; below desktop the wrapper is `display: contents`
  const copy = document.createElement('div');
  copy.className = 'destination-introduction-copy';
  if (header.childElementCount > 0) copy.append(header);
  if (body) copy.append(body);
  if (thumbs) copy.append(thumbs);

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

  // Clones on either side let native swipes and arrows keep moving in one
  // direction. The editor keeps only authored slides in its canvas.
  const loop = interactive && !block.closest('.adobe-ue-edit');
  if (loop) {
    track.prepend(...slides.map(({ element }) => cloneSlide(element)));
    track.append(...slides.map(({ element }) => cloneSlide(element)));
  }
  const items = [...track.children] as HTMLElement[];
  const firstRealItem = loop ? slides.length : 0;
  const realIndex = (item: number): number =>
    (((item - firstRealItem) % slides.length) + slides.length) % slides.length;

  const positionOf = (item: number): number => {
    const target = items[Math.max(0, Math.min(item, items.length - 1))];
    return (target?.offsetLeft ?? 0) - (items[0]?.offsetLeft ?? 0);
  };

  // Below desktop the track scrolls, so the live item comes from scroll
  // position; at desktop it never scrolls and `selected` stays authoritative.
  const currentItem = (): number => {
    const step = items.length > 1 ? positionOf(1) : 0;
    if (step <= 0) return firstRealItem + Math.max(selected, 0);
    if (!loop) {
      // narrow slides can leave the last one short of the track's start edge
      const scrollable = track.scrollWidth > track.clientWidth + 1;
      if (scrollable && track.scrollLeft + track.clientWidth >= track.scrollWidth - 1) return items.length - 1;
    }
    return Math.round(track.scrollLeft / step);
  };

  const scrollToItem = (item: number, behavior: ScrollBehavior = 'smooth'): void => {
    track.scrollTo({ left: positionOf(item), behavior });
  };

  const settleScroll = (): void => {
    let item = currentItem();
    if (loop && (item < firstRealItem || item >= firstRealItem + slides.length)) {
      item = firstRealItem + realIndex(item);
      scrollToItem(item, 'instant');
    }
    select(realIndex(item));
  };

  const lastItem = items.length - 1;
  prev?.addEventListener('click', () => {
    const item = currentItem();
    scrollToItem(loop || item > 0 ? item - 1 : lastItem);
  });
  next?.addEventListener('click', () => {
    const item = currentItem();
    scrollToItem(loop || item < lastItem ? item + 1 : 0);
  });

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
      settle = window.setTimeout(settleScroll, SCROLL_SETTLE_MS);
    },
    { passive: true },
  );

  select(0);

  // Layout changes move every item, so keep the selected real slide in view.
  const resizeObserver =
    loop && 'ResizeObserver' in window
      ? new ResizeObserver(() => scrollToItem(firstRealItem + Math.max(selected, 0), 'instant'))
      : null;
  resizeObserver?.observe(track);

  // `preload="none"` keeps the videos off the critical path; they start buffering
  // once the block is near the viewport, so switching slide is not a cold start
  const preloader = videos.length
    ? new IntersectionObserver(
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
      )
    : null;
  preloader?.observe(block);

  // the editor replaces the block element on every item change, so observers
  // must not outlive the DOM they were measuring
  const parent = block.parentElement;
  if (!parent || (!resizeObserver && !preloader)) return;
  const watcher = new MutationObserver(() => {
    if (block.isConnected) return;
    resizeObserver?.disconnect();
    preloader?.disconnect();
    watcher.disconnect();
    window.clearTimeout(settle);
  });
  watcher.observe(parent, { childList: true });
}
