// src/blocks/hero-destination/lib/carousel-controller.ts
// Drives active slide/dot state and autoplay timing; visual positioning is delegated to the
// chosen transition effect, so this class stays agnostic of how slides/dots were built.
import type { EffectController } from './effects/types';

/** Autoplay stays stopped while any reason is held, so one source resuming can't override another. */
export type CarouselPauseReason = 'hover' | 'focus' | 'visibility' | 'user';

export interface CarouselControllerOptions {
  track: HTMLElement;
  slides: HTMLElement[];
  /** The effect-transformed layer inside each slide (its media box), paired 1:1 with `slides`. */
  mediaEls: HTMLElement[];
  dots: HTMLButtonElement[];
  intervalSeconds: number;
  autoplay: boolean;
  loop: boolean;
  effect: EffectController;
}

export class CarouselController {
  private readonly track: HTMLElement;
  private readonly slides: HTMLElement[];
  private readonly mediaEls: HTMLElement[];
  private readonly dots: HTMLButtonElement[];
  private readonly intervalMs: number;
  private readonly loop: boolean;
  private readonly canAutoplay: boolean;
  private readonly effect: EffectController;
  private readonly pauseReasons = new Set<CarouselPauseReason>();
  private activeIndex = 0;
  private finished = false;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor({ track, slides, mediaEls, dots, intervalSeconds, autoplay, loop, effect }: CarouselControllerOptions) {
    this.track = track;
    this.slides = slides;
    this.mediaEls = mediaEls;
    this.dots = dots;
    this.intervalMs = intervalSeconds * 1000;
    this.loop = loop;
    this.effect = effect;
    this.canAutoplay = autoplay && slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Whether there is auto-moving content at all (and therefore anything worth offering to pause). */
  get autoplayEnabled(): boolean {
    return this.canAutoplay;
  }

  get userPaused(): boolean {
    return this.pauseReasons.has('user');
  }

  /** Activates the first slide and starts autoplay (if eligible); wires tab-visibility handling. */
  init(): void {
    this.effect.init(this.track, this.mediaEls);
    this.setActive(0);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.start();
  }

  /** Manual navigation (e.g. dot click): jump to a slide and restart the autoplay countdown. */
  goTo(index: number): void {
    this.setActive(index);
    this.start();
  }

  /** Manual navigation (e.g. swipe): advance to the next slide, respecting `loop`. */
  next(): void {
    const total = this.slides.length;
    if (total < 2) return;
    if (this.activeIndex === total - 1 && !this.loop) return;
    this.goTo((this.activeIndex + 1) % total);
  }

  /** Manual navigation (e.g. swipe): go back to the previous slide, respecting `loop`. */
  previous(): void {
    const total = this.slides.length;
    if (total < 2) return;
    if (this.activeIndex === 0 && !this.loop) return;
    this.goTo((this.activeIndex - 1 + total) % total);
  }

  pause(reason: CarouselPauseReason): void {
    this.pauseReasons.add(reason);
    this.stop();
    this.syncLiveRegion();
  }

  resume(reason: CarouselPauseReason): void {
    this.pauseReasons.delete(reason);
    this.start();
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.pause('visibility');
    else this.resume('visibility');
  };

  private setActive(index: number): void {
    const previousSlide = this.slides[this.activeIndex];
    const previousDot = this.dots[this.activeIndex];
    previousSlide?.setAttribute('aria-hidden', 'true');
    previousSlide?.removeAttribute('tabindex');
    previousDot?.classList.remove('is-active');
    previousDot?.setAttribute('aria-selected', 'false');
    if (previousDot) previousDot.tabIndex = -1;

    this.activeIndex = index;

    const activeSlide = this.slides[this.activeIndex];
    const activeDot = this.dots[this.activeIndex];
    activeSlide?.setAttribute('aria-hidden', 'false');
    activeSlide?.setAttribute('tabindex', '0');
    activeDot?.classList.add('is-active');
    activeDot?.setAttribute('aria-selected', 'true');
    if (activeDot) activeDot.tabIndex = 0;

    this.effect.render(this.track, this.mediaEls, this.activeIndex);
  }

  private start(): void {
    if (this.canAutoplay && !this.finished && this.pauseReasons.size === 0) {
      this.stop();
      this.timerId = setInterval(() => this.tick(), this.intervalMs);
    }
    this.syncLiveRegion();
  }

  /** Auto-rotation must stay silent; once stopped, slide changes are user-driven so announce them. */
  private syncLiveRegion(): void {
    this.track.setAttribute('aria-live', this.timerId === null ? 'polite' : 'off');
  }

  /** Advances to the next slide; when loop is disabled, stops autoplay after the last slide. */
  private tick(): void {
    const isLastSlide = this.activeIndex === this.slides.length - 1;
    if (isLastSlide && !this.loop) {
      this.finished = true;
      this.stop();
      this.syncLiveRegion();
      return;
    }
    this.setActive((this.activeIndex + 1) % this.slides.length);
  }

  private stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
