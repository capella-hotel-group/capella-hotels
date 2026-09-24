// src/blocks/hero-destination/lib/carousel-controller.ts
// Drives active slide/dot state and autoplay timing; visual positioning is delegated to the
// chosen transition effect, so this class stays agnostic of how slides/dots were built.
import type { EffectController } from './effects/types';

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
  private activeIndex = 0;
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

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private setActive(index: number): void {
    this.slides[this.activeIndex]?.setAttribute('aria-hidden', 'true');
    this.dots[this.activeIndex]?.classList.remove('is-active');
    this.dots[this.activeIndex]?.removeAttribute('aria-selected');

    this.activeIndex = index;

    this.slides[this.activeIndex]?.setAttribute('aria-hidden', 'false');
    this.dots[this.activeIndex]?.classList.add('is-active');
    this.dots[this.activeIndex]?.setAttribute('aria-selected', 'true');

    this.effect.render(this.track, this.mediaEls, this.activeIndex);
  }

  private start(): void {
    if (!this.canAutoplay) return;
    this.stop();
    this.timerId = setInterval(() => this.tick(), this.intervalMs);
  }

  /** Advances to the next slide; when loop is disabled, stops autoplay after the last slide. */
  private tick(): void {
    const isLastSlide = this.activeIndex === this.slides.length - 1;
    if (isLastSlide && !this.loop) {
      this.stop();
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
