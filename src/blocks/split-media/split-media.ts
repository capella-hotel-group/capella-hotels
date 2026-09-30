import { CarouselController } from './lib/carousel-controller';
import { buildArrowNav, buildDotNav, buildSlide } from './lib/dom-builder';
import { bindGestures, INTERACTIVE_TARGET } from './lib/gesture';
import { isItemRow, parseBlockConfig, parseSlides } from './lib/parse';
import { suppressTransitionsDuringResize } from './lib/resize-guard';

// A single observer covers all instances, including UE replacing children in place.
const instances = new Map<HTMLElement, { track: HTMLElement; cleanup: () => void }>();
let removalObserver: MutationObserver | undefined;
function observeRemoval(block: HTMLElement, track: HTMLElement, cleanup: () => void): void {
  instances.set(block, { track, cleanup });
  removalObserver ??= new MutationObserver(() => {
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

export default function decorate(block: HTMLElement): void {
  if (instances.get(block)?.track.parentElement === block) return;
  instances.get(block)?.cleanup();
  block.setAttribute('data-testid', 'split-media');
  const rows = [...block.children] as HTMLElement[];
  const itemRows = rows.filter(isItemRow);
  const configRows = rows.filter((row) => !itemRows.includes(row));
  const { autoplay, intervalSeconds, showDots, showControls, id, dataTestId } = parseBlockConfig(configRows);
  if (id) block.id = id.replace(/^#/, '');
  if (dataTestId) block.dataset.testId = dataTestId;
  configRows.forEach((row) => row.classList.add('split-media-hidden'));
  const slides = parseSlides(itemRows);
  if (!slides.length) return;

  const track = document.createElement('ul');
  track.className = 'split-media-track';
  slides.forEach((slide, index) => track.append(buildSlide(slide, index)));
  // The instrumentation now belongs to the rendered slide; retain any unconsumed fields.
  itemRows.forEach((row) => {
    row.classList.add('split-media-hidden');
    block.append(row);
  });
  block.append(track);

  const multiple = slides.length > 1;
  const { nav: dotNav, dots } = buildDotNav(multiple && showDots ? slides.length : 0);
  const listeners = new AbortController();
  const { signal } = listeners;
  const updatePause = (paused: boolean): void => {
    block.setAttribute(
      'aria-label',
      paused ? 'Split media slideshow, paused. Press Space to play' : 'Split media slideshow. Press Space to pause',
    );
  };
  const slideEls = [...track.children] as HTMLElement[];
  const carousel = new CarouselController({
    slides: slideEls,
    dots,
    intervalSeconds,
    autoplay,
    onPauseChange: multiple && autoplay ? updatePause : undefined,
  });
  dots.forEach((dot, index) => dot.addEventListener('click', () => carousel.goTo(index), { signal }));
  if (multiple && showControls) {
    const { nav, prev, next } = buildArrowNav();
    prev.addEventListener('click', () => carousel.previous(), { signal });
    next.addEventListener('click', () => carousel.next(), { signal });
    block.append(nav);
  }
  block.classList.toggle('split-media--pagination', Boolean(dots.length));
  if (dots.length) block.append(dotNav);
  if (multiple) {
    block.tabIndex = 0;
    block.setAttribute('role', 'region');
    block.setAttribute('aria-roledescription', 'carousel');
    if (autoplay) {
      block.setAttribute('aria-keyshortcuts', 'Space');
      updatePause(false);
    } else {
      block.setAttribute('aria-label', 'Split media slideshow');
    }
    block.addEventListener(
      'keydown',
      (event) => {
        if (!(event.target instanceof Element) || event.target.closest(INTERACTIVE_TARGET)) return;
        if (event.key === ' ' && autoplay) {
          event.preventDefault();
          carousel.togglePause();
          return;
        }
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        if (event.key === 'ArrowRight') carousel.next();
        else carousel.previous();
      },
      { signal },
    );
  }
  const gesture = multiple
    ? bindGestures(track, {
        next: () => carousel.next(),
        previous: () => carousel.previous(),
        begin: () => carousel.beginGesture(),
        end: () => carousel.endGesture(),
      })
    : undefined;
  if (gesture) track.classList.add('split-media-track--swipe');
  const clearResize = suppressTransitionsDuringResize(block, {
    onStart: () => {
      carousel.beginResize();
      gesture?.cancel();
    },
    onEnd: () => carousel.endResize(),
  });
  block.addEventListener(
    'aue:ui-select',
    (event) => {
      const index = slideEls.findIndex((slide) => event.target instanceof Node && slide.contains(event.target));
      if (index >= 0) carousel.goTo(index);
    },
    { signal },
  );
  carousel.init();
  observeRemoval(block, track, () => {
    carousel.destroy();
    listeners.abort();
    clearResize();
    gesture?.cleanup();
  });
}
