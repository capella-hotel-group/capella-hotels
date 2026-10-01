import { CarouselController } from './lib/carousel-controller';
import { buildSlide } from './lib/dom-builder';
import { INTERACTIVE_TARGET } from './lib/gesture';
import { isItemRow, parseBlockConfig, parseSlides } from './lib/parse';
import { registerScrollController } from './lib/scroll-controller';
import { suppressTransitionsDuringResize } from './lib/resize-guard';

// A single observer covers all instances, including UE replacing children in place.
const instances = new Map<HTMLElement, { track: HTMLElement; cleanup: () => void }>();
let removalObserver: MutationObserver | undefined;

// Copy that outgrows its panel scrolls, so it also has to be reachable by keyboard.
function syncCopyFocus(slides: HTMLElement[]): void {
  slides.forEach((slide) => {
    slide.querySelectorAll<HTMLElement>('.split-media-overlay').forEach((overlay) => {
      if (overlay.scrollHeight > overlay.clientHeight + 1) {
        overlay.tabIndex = 0;
        overlay.setAttribute('role', 'group');
      } else {
        overlay.removeAttribute('tabindex');
        overlay.removeAttribute('role');
      }
    });
  });
}

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
  const { id, dataTestId } = parseBlockConfig(configRows);
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
  const editing = Boolean(block.closest('.adobe-ue-edit'));
  const listeners = new AbortController();
  const { signal } = listeners;
  const slideEls = [...track.children] as HTMLElement[];
  const carousel = new CarouselController(slideEls);
  carousel.init();
  const scroll = registerScrollController(block, carousel);
  if (multiple && !editing) track.classList.add('split-media-track--scroll');
  syncCopyFocus(slideEls);
  if (multiple) {
    block.tabIndex = 0;
    block.setAttribute('role', 'region');
    block.setAttribute('aria-roledescription', 'carousel');
    block.setAttribute('aria-label', 'Split media slideshow');
    block.addEventListener(
      'keydown',
      (event) => {
        if (editing || event.target !== block || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        if (!(event.target instanceof Element) || event.target.closest(INTERACTIVE_TARGET)) return;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
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
      syncCopyFocus(slideEls);
    },
  });
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
  });
}
