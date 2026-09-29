// src/blocks/split-media/lib/carousel-controller.ts
// Drives which slide is active; the CSS keyed off [aria-hidden] on the slide and its two panels
// handles the slide-in/fade-in animations, so this class only tracks and toggles state.
export interface CarouselControllerOptions {
  slides: HTMLElement[];
  dots: HTMLButtonElement[];
  intervalSeconds: number;
  autoplay: boolean;
}

// covers the longest exit (mobile/tablet right panel: 150ms stagger + 550ms travel) with room
// to spare; used only to know when it's safe to snap the slide back to its entrance side
const LEAVING_SETTLE_MS = 700;

export class CarouselController {
  private readonly slides: HTMLElement[];
  private readonly dots: HTMLButtonElement[];
  private readonly intervalMs: number;
  private readonly canAutoplay: boolean;
  private activeIndex = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private readonly leavingTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  constructor({ slides, dots, intervalSeconds, autoplay }: CarouselControllerOptions) {
    this.slides = slides;
    this.dots = dots;
    this.intervalMs = intervalSeconds * 1000;
    this.canAutoplay = autoplay && slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Activates the first slide and starts autoplay (if eligible); wires tab-visibility handling. */
  init(): void {
    this.setActive(0);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.start();
  }

  /** Manual navigation (e.g. dot click): jump to a slide and restart the autoplay countdown. */
  goTo(index: number): void {
    this.setActive(index);
    this.start();
  }

  /** Always wraps around — a "real carousel", not a fixed pair of panels. */
  next(): void {
    if (this.slides.length < 2) return;
    this.goTo((this.activeIndex + 1) % this.slides.length);
  }

  previous(): void {
    if (this.slides.length < 2) return;
    this.goTo((this.activeIndex - 1 + this.slides.length) % this.slides.length);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  // toggling aria-hidden (not display:none) is what replays the CSS entrance transitions on
  // every activation, and keeps every slide reachable/selectable in the Universal Editor
  private setActive(index: number): void {
    const previous = this.slides[this.activeIndex];
    previous?.setAttribute('aria-hidden', 'true');
    this.dots[this.activeIndex]?.classList.remove('is-active');
    this.dots[this.activeIndex]?.removeAttribute('aria-selected');

    this.activeIndex = index;

    if (previous) this.markLeaving(previous);
    this.slides[this.activeIndex]?.setAttribute('aria-hidden', 'false');
    this.dots[this.activeIndex]?.classList.add('is-active');
    this.dots[this.activeIndex]?.setAttribute('aria-selected', 'true');
  }

  // keeps the outgoing slide moving past center instead of reversing back to its entrance side
  // (see split-media.css), then snaps it back once fully offscreen so it's ready to enter again
  private markLeaving(slide: HTMLElement): void {
    const pending = this.leavingTimers.get(slide);
    if (pending !== undefined) clearTimeout(pending);

    slide.classList.remove('split-media-slide--settling');
    slide.classList.add('split-media-slide--leaving');

    const timer = setTimeout(() => {
      slide.classList.add('split-media-slide--settling');
      slide.classList.remove('split-media-slide--leaving');
      // force a reflow so the instant reset is committed with transitions off — without this,
      // the browser can batch the disable/re-enable into one frame and animate the reset anyway
      void slide.offsetHeight;
      requestAnimationFrame(() => slide.classList.remove('split-media-slide--settling'));
      this.leavingTimers.delete(slide);
    }, LEAVING_SETTLE_MS);
    this.leavingTimers.set(slide, timer);
  }

  private start(): void {
    if (!this.canAutoplay) return;
    this.stop();
    this.timerId = setInterval(() => this.next(), this.intervalMs);
  }

  private stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
