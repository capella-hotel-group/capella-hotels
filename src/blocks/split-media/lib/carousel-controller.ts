import { waitForTransforms } from './transition';

export interface CarouselControllerOptions {
  slides: HTMLElement[];
  dots: HTMLButtonElement[];
  intervalSeconds: number;
  autoplay: boolean;
}

interface SlideTransition {
  previous: HTMLElement;
  outgoingDone: boolean;
  incomingDone: boolean;
  cancelOutgoing?: () => void;
  cancelIncoming?: () => void;
}

export class CarouselController {
  private readonly slides: HTMLElement[];
  private readonly dots: HTMLButtonElement[];
  private readonly intervalMs: number;
  private readonly autoplay: boolean;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private activeIndex = 0;
  private pendingIndex: number | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private transition: SlideTransition | null = null;
  private resizing = false;
  private destroyed = false;

  constructor({ slides, dots, intervalSeconds, autoplay }: CarouselControllerOptions) {
    this.slides = slides;
    this.dots = dots;
    this.intervalMs = intervalSeconds * 1000;
    this.autoplay = autoplay;
  }

  init(): void {
    this.updateActive(0);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.reducedMotion.addEventListener('change', this.handleMotionChange);
    this.start();
  }

  /** Keep just the latest manual destination while the current image/text rhythm finishes. */
  goTo(index: number): void {
    if (this.destroyed || !Number.isInteger(index) || !this.slides[index]) return;
    this.pendingIndex = index;
    this.flushPending();
    this.start();
  }

  next(): void {
    if (this.slides.length < 2) return;
    this.goTo(((this.pendingIndex ?? this.activeIndex) + 1) % this.slides.length);
  }

  previous(): void {
    if (this.slides.length < 2) return;
    this.goTo(((this.pendingIndex ?? this.activeIndex) - 1 + this.slides.length) % this.slides.length);
  }

  beginResize(): void {
    this.resizing = true;
    this.finishTransition();
  }

  endResize(): void {
    this.resizing = false;
    this.flushPending();
  }

  destroy(): void {
    this.destroyed = true;
    this.pendingIndex = null;
    this.stop();
    this.finishTransition();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.reducedMotion.removeEventListener('change', this.handleMotionChange);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private handleMotionChange = (): void => {
    if (this.reducedMotion.matches) this.finishTransition();
    this.start();
  };

  private updateActive(index: number): void {
    this.activeIndex = index;
    this.slides.forEach((slide, slideIndex) => slide.setAttribute('aria-hidden', String(slideIndex !== index)));
    this.dots.forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === index);
      dot.setAttribute('aria-selected', String(dotIndex === index));
    });
  }

  private flushPending(): void {
    if (this.destroyed || this.resizing || this.transition || this.pendingIndex === null) return;
    const index = this.pendingIndex;
    this.pendingIndex = null;
    if (index === this.activeIndex) return;

    const previous = this.slides[this.activeIndex];
    const incoming = this.slides[index];
    if (!previous || !incoming) return;
    this.updateActive(index);
    if (this.reducedMotion.matches) return;

    previous.classList.add('split-media-slide--leaving');
    const transition: SlideTransition = { previous, outgoingDone: false, incomingDone: false };
    this.transition = transition;
    const complete = (outgoing: boolean, cancelled: boolean): void => {
      if (this.transition !== transition) return;
      if (cancelled) {
        this.finishTransition();
        return;
      }
      if (outgoing) {
        transition.outgoingDone = true;
        this.resetSlide(previous);
      } else {
        transition.incomingDone = true;
      }
      if (transition.outgoingDone && transition.incomingDone) this.finishTransition();
    };
    transition.cancelOutgoing = waitForTransforms(
      [...previous.querySelectorAll<HTMLElement>('.split-media-item')],
      (cancelled) => complete(true, cancelled),
    );
    transition.cancelIncoming = waitForTransforms(
      [...incoming.querySelectorAll<HTMLElement>('.split-media-item, .split-media-overlay')],
      (cancelled) => complete(false, cancelled),
    );
  }

  /** Commit the final transform with transitions suppressed before reusing a slide. */
  private resetSlide(slide?: HTMLElement): void {
    if (!slide) return;
    slide.classList.add('split-media-slide--settling');
    slide.classList.remove('split-media-slide--leaving');
    void slide.offsetHeight;
    slide.classList.remove('split-media-slide--settling');
  }

  private finishTransition(): void {
    const transition = this.transition;
    if (transition) {
      transition.cancelOutgoing?.();
      transition.cancelIncoming?.();
      this.resetSlide(transition.previous);
      this.resetSlide(this.slides[this.activeIndex]);
      this.transition = null;
    }
    this.flushPending();
  }

  private start(): void {
    this.stop();
    if (this.destroyed || !this.autoplay || this.slides.length < 2 || this.reducedMotion.matches || document.hidden)
      return;
    this.timerId = setInterval(() => {
      if (!this.transition && !this.resizing && this.pendingIndex === null) this.next();
    }, this.intervalMs);
  }

  private stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }
}
