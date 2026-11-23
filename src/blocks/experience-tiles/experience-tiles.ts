import { buildControls, LABELS, type CarouselControls } from './lib/a11y-controls';
import { CarouselController } from './lib/carousel-controller';
import { buildSlide } from './lib/dom-builder';
import { isItemRow, parseBlockConfig, parseSlides } from './lib/parse';
import { registerScrollController } from './lib/scroll-controller';
import { suppressTransitionsDuringResize } from './lib/resize-guard';
import { isUniversalEditor } from '@/utils/env';

// jsdom's nwsapi may not implement :focus-visible.
function isFocusVisible(element: Element | null): boolean {
  try {
    return element?.matches(':focus-visible') ?? false;
  } catch {
    return false;
  }
}

// A single observer covers all instances, including UE replacing children in place.
const instances = new Map<HTMLElement, { track: HTMLElement; cleanup: () => void }>();
let removalObserver: MutationObserver | undefined;

// The entrance is driven by the active slide's own CSS, so it would otherwise play at decoration
// time, far above the fold where nobody sees it. Hold the active state back until the block is
// actually on screen and the normal transitions do the rest.
function holdEntrance(block: HTMLElement, editing: boolean): () => void {
  if (
    editing ||
    typeof IntersectionObserver === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return () => {};
  }
  block.classList.add('experience-tiles-pending');
  let delivered = false;
  const observer = new IntersectionObserver(
    (records) => {
      const record = records[records.length - 1];
      if (!record) return;
      // Measuring the block's own position here is useless: sections above it are still being built
      // at decoration time and it reports top 0. The first observation is the only reliable answer,
      // and anything already on screen then must be released at once rather than held for LCP.
      const visible = record.isIntersecting || (!delivered && record.intersectionRatio > 0);
      delivered = true;
      if (!visible) return;
      observer.disconnect();
      block.classList.remove('experience-tiles-pending');
    },
    { threshold: 0.5 },
  );
  observer.observe(block);
  return () => {
    observer.disconnect();
    block.classList.remove('experience-tiles-pending');
  };
}

// Layout boxes, not scrollHeight: Windows font metrics overflow a tight line-height and inflate it.
function contentHeight(overlay: HTMLElement): number {
  return Math.max(
    0,
    ...[...overlay.children].map((child) => (child as HTMLElement).offsetTop + (child as HTMLElement).offsetHeight),
  );
}

// Copy that outgrows its panel scrolls, so it also has to be reachable by keyboard. A copy that fits
// must stay out of the way: a scroll container would swallow page scrolling via overscroll containment.
function syncOverlay(overlay: HTMLElement): void {
  const scrollable = contentHeight(overlay) > overlay.clientHeight + 1;
  overlay.classList.toggle('experience-tiles-overlay--scrollable', scrollable);
  if (scrollable) {
    overlay.tabIndex = 0;
    overlay.setAttribute('role', 'group');
    const heading = overlay.querySelector<HTMLElement>('.experience-tiles-headline');
    if (heading?.id) overlay.setAttribute('aria-labelledby', heading.id);
  } else {
    overlay.removeAttribute('tabindex');
    overlay.removeAttribute('role');
    overlay.removeAttribute('aria-labelledby');
  }
}

// Late web fonts, URL-bar height changes and UE edits all resize the copy without a window resize.
function watchCopyOverflow(track: HTMLElement): () => void {
  const overlays = [...track.querySelectorAll<HTMLElement>('.experience-tiles-overlay')];
  overlays.forEach(syncOverlay);
  if (typeof ResizeObserver === 'undefined') return () => {};
  const dirty = new Set<HTMLElement>();
  let frame: number | undefined;
  const observer = new ResizeObserver((records) => {
    records.forEach(({ target }) => {
      const overlay = target.closest<HTMLElement>('.experience-tiles-overlay');
      if (overlay) dirty.add(overlay);
    });
    frame ??= requestAnimationFrame(() => {
      frame = undefined;
      dirty.forEach(syncOverlay);
      dirty.clear();
    });
  });
  overlays.forEach((overlay) => {
    observer.observe(overlay);
    const body = overlay.querySelector(':scope > .experience-tiles-body');
    if (body) observer.observe(body);
  });
  return () => {
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
}

function observeRemoval(block: HTMLElement, track: HTMLElement, cleanup: () => void): void {
  instances.set(block, { track, cleanup });
  // Published pages never replace blocks; only UE swaps them in place.
  if (!isUniversalEditor() || removalObserver) return;
  removalObserver = new MutationObserver(() => {
    instances.forEach((instance, element) => {
      if (element.isConnected && element.contains(instance.track)) return;
      instance.cleanup();
      instances.delete(element);
    });
    if (!instances.size) {
      removalObserver?.disconnect();
      removalObserver = undefined;
    }
  });
  removalObserver.observe(document.body, { childList: true, subtree: true });
}

// Hidden slides sit outside the clipped track, so native lazy loading never fetches them.
function preloadNeighbours(slides: HTMLElement[], index: number): void {
  [slides[index - 1], slides[index + 1]].forEach((slide) =>
    slide?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
      img.setAttribute('loading', 'eager');
    }),
  );
}

function whenNear(block: HTMLElement, callback: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    callback();
    return () => {};
  }
  const observer = new IntersectionObserver(
    (records) => {
      if (!records.some((record) => record.isIntersecting)) return;
      observer.disconnect();
      callback();
    },
    { rootMargin: '100% 0px' },
  );
  observer.observe(block);
  return () => observer.disconnect();
}

export default function decorate(block: HTMLElement): void {
  if (instances.get(block)?.track.parentElement === block) return;
  instances.get(block)?.cleanup();
  block.setAttribute('data-testid', 'experience-tiles');
  const rows = [...block.children] as HTMLElement[];
  const itemRows = rows.filter(isItemRow);
  const configRows = rows.filter((row) => !itemRows.includes(row));
  const { id, dataTestId } = parseBlockConfig(configRows);
  if (id) block.id = id.replace(/^#/, '');
  if (dataTestId) block.dataset.automationKey = dataTestId;
  configRows.forEach((row) => row.classList.add('experience-tiles-hidden'));
  const slides = parseSlides(itemRows);
  if (!slides.length) return;

  block.dataset.headerTheme = 'overlay';
  const track = document.createElement('div');
  track.className = 'experience-tiles-track';
  slides.forEach((slide, index) => track.append(buildSlide(slide, index, slides.length)));
  // The instrumentation now belongs to the rendered slide; retain any unconsumed fields.
  itemRows.forEach((row) => {
    row.classList.add('experience-tiles-hidden');
    block.append(row);
  });
  block.append(track);

  const multiple = slides.length > 1;
  const editing = Boolean(block.closest('.adobe-ue-edit'));
  const listeners = new AbortController();
  const { signal } = listeners;
  const slideEls = [...track.children] as HTMLElement[];
  const releaseEntrance = holdEntrance(block, editing);
  let near = false;
  let controls: CarouselControls | undefined;
  const carousel = new CarouselController(slideEls, {
    onChange: (index) => {
      controls?.update(index);
      if (near && !editing) preloadNeighbours(slideEls, index);
    },
    focusTarget: (direction) =>
      isFocusVisible(document.activeElement) ? (controls?.focusTarget(direction) ?? null) : null,
  });
  carousel.init();
  const stopNear = editing
    ? () => {}
    : whenNear(block, () => {
        near = true;
        preloadNeighbours(slideEls, carousel.index);
      });
  const scroll = registerScrollController(block, carousel);
  if (multiple) {
    block.setAttribute('role', 'region');
    block.setAttribute('aria-roledescription', 'carousel');
    block.setAttribute('aria-label', LABELS.carousel);
  }
  if (multiple && !editing) {
    track.classList.add('experience-tiles-track--scroll');
    // Focusable without a Tab stop, so stepping via pointer/touch can still hand focus to the block.
    block.tabIndex = -1;
    controls = buildControls(slides.length, (direction) => {
      if (!scroll.isAligned()) scroll.snap();
      carousel.requestStep(direction);
    });
    block.prepend(controls.element);
    block.append(controls.status);
    controls.update(carousel.index);
    block.addEventListener(
      'keydown',
      (event) => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        if (!(event.target instanceof Element) || !event.target.closest('.experience-tiles-controls')) return;
        if (!scroll.isAligned()) return;
        if (carousel.requestStep(event.key === 'ArrowDown' ? 1 : -1) !== 'edge') event.preventDefault();
      },
      { signal },
    );
  }
  const clearResize = suppressTransitionsDuringResize(block, {
    onStart: () => {
      carousel.beginResize();
      scroll.cancel();
    },
    onEnd: () => {
      carousel.endResize();
      scroll.resize();
    },
  });
  const stopOverflowWatch = watchCopyOverflow(track);
  block.addEventListener(
    'aue:ui-select',
    (event) => {
      const index = slideEls.findIndex((slide) => event.target instanceof Node && slide.contains(event.target));
      if (index >= 0) carousel.select(index);
    },
    { signal },
  );
  observeRemoval(block, track, () => {
    scroll.cleanup();
    carousel.destroy();
    listeners.abort();
    clearResize();
    releaseEntrance();
    stopOverflowWatch();
    stopNear();
    controls?.element.remove();
    controls?.status.remove();
    block.removeAttribute('tabindex');
  });
}
