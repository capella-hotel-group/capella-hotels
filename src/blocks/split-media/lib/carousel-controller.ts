// src/blocks/split-media/lib/carousel-controller.ts
// Drives which slide is active; the CSS keyed off [aria-hidden] on the slide and its two panels
// handles the slide-in/fade-in animations, so this class only tracks and toggles state.
export interface CarouselControllerOptions {
  slides: HTMLElement[];
  dots: HTMLButtonElement[];
  intervalSeconds: number;
  autoplay: boolean;
}

export class CarouselController {
  private readonly slides: HTMLElement[];
  private readonly dots: HTMLButtonElement[];
  private readonly intervalMs: number;
  private readonly canAutoplay: boolean;
  private activeIndex = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

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
    this.slides[this.activeIndex]?.setAttribute('aria-hidden', 'true');
    this.dots[this.activeIndex]?.classList.remove('is-active');
    this.dots[this.activeIndex]?.removeAttribute('aria-selected');

    this.activeIndex = index;

    this.slides[this.activeIndex]?.setAttribute('aria-hidden', 'false');
    this.dots[this.activeIndex]?.classList.add('is-active');
    this.dots[this.activeIndex]?.setAttribute('aria-selected', 'true');
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
