// Horizontal-scroll carousel behavior: prev/next controls, boundary-disabled buttons,
// RTL-aware scroll direction, a11y wiring, and prefers-reduced-motion support. Whether to
// show a carousel at all is the caller's decision (e.g. item count); this module only
// builds/wires the controls once the caller has decided to.

export interface CarouselClassNames {
  /** Wrapper element for the prev/next buttons. */
  controls: string;
  /** Applied to both buttons. */
  control: string;
  controlPrev: string;
  controlNext: string;
}

export interface CarouselLabels {
  /** aria-label for the scrollable track, e.g. the section title. */
  track: string;
  previous: string;
  next: string;
}

export interface CarouselOptions {
  /** The scrollable element (must contain the items directly as children). */
  track: HTMLElement;
  /** Selector for a single item, used to measure how far to scroll per click. */
  itemSelector: string;
  classNames: CarouselClassNames;
  labels: CarouselLabels;
}

let trackIdCounter = 0;

/** Builds prev/next controls wired to `track` and returns the controls element to append. */
export function createCarouselControls(options: CarouselOptions): HTMLDivElement {
  const { track, itemSelector, classNames, labels } = options;

  const trackId = `carousel-track-${(trackIdCounter += 1)}`;
  track.id = trackId;
  track.tabIndex = 0;
  track.setAttribute('aria-label', labels.track);

  const controls = document.createElement('div');
  controls.className = classNames.controls;

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = `${classNames.control} ${classNames.controlPrev}`;
  previous.setAttribute('aria-label', labels.previous);
  previous.setAttribute('aria-controls', trackId);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = `${classNames.control} ${classNames.controlNext}`;
  next.setAttribute('aria-label', labels.next);
  next.setAttribute('aria-controls', trackId);

  const isRtl = (): boolean => getComputedStyle(track).direction === 'rtl';
  const scrollByItem = (direction: number): void => {
    const item = track.querySelector(itemSelector);
    const itemWidth = item?.getBoundingClientRect().width || track.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    track.scrollBy({ left: (isRtl() ? -1 : 1) * direction * (itemWidth + gap), behavior });
  };

  const updateDisabledState = (): void => {
    const maxScroll = track.scrollWidth - track.clientWidth;
    const pos = Math.abs(track.scrollLeft);
    previous.disabled = pos <= 1;
    next.disabled = pos >= maxScroll - 1;
  };

  previous.addEventListener('click', () => scrollByItem(-1));
  next.addEventListener('click', () => scrollByItem(1));
  track.addEventListener('scroll', updateDisabledState, { passive: true });
  // ResizeObserver covers container-driven resizes; the listeners below are a fallback for
  // cases where fonts/images/CSS finish applying, or the tab was backgrounded, after the
  // track's own box was first measured.
  new ResizeObserver(updateDisabledState).observe(track);
  window.addEventListener('resize', updateDisabledState);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateDisabledState();
  });
  if (document.readyState === 'complete') {
    updateDisabledState();
  } else {
    window.addEventListener('load', updateDisabledState, { once: true });
  }
  document.fonts?.ready?.then(updateDisabledState).catch(() => {});
  updateDisabledState();

  controls.append(previous, next);
  return controls;
}
