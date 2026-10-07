import { waitForTransforms } from './transition';

export type Direction = -1 | 1;
export type StepResult = 'changed' | 'edge' | 'busy';

interface SlideTransition {
  previous: HTMLElement;
  outgoingDone: boolean;
  incomingDone: boolean;
  cancelOutgoing?: () => void;
  cancelIncoming?: () => void;
}

/** Owns slide state and animation only; page/gesture ownership lives in the scroll controller. */
export class CarouselController {
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private activeIndex = 0;
  private transition: SlideTransition | null = null;
  private resizing = false;
  private destroyed = false;

  constructor(private readonly slides: HTMLElement[]) {}

  get index(): number {
    return this.activeIndex;
  }
  get count(): number {
    return this.slides.length;
  }
  get isBusy(): boolean {
    return this.destroyed || this.resizing || this.transition !== null;
  }
  private get editing(): boolean {
    return Boolean(this.slides[0]?.closest('.adobe-ue-edit'));
  }

  init(): void {
    this.updateActive(0);
    this.reducedMotion.addEventListener('change', this.handleMotionChange);
  }

  requestStep(direction: Direction): StepResult {
    if (this.isBusy) return 'busy';
    const index = this.index + direction;
    if (!this.slides[index]) return 'edge';
    const previous = this.slides[this.index];
    const incoming = this.slides[index];
    if (!previous || !incoming) return 'edge';
    this.updateActive(index);
    if (this.reducedMotion.matches || this.editing) return 'changed';

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
      } else transition.incomingDone = true;
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
    return 'changed';
  }

  /** Immediate selection for viewport entry and authoring, with no queued destination. */
  select(index: number): void {
    if (this.destroyed || !Number.isInteger(index) || !this.slides[index]) return;
    // Re-selecting the slide already showing would still flash `--settling`, which kills whatever
    // entrance transition is mid-flight — the reveal on first scroll depends on this staying a no-op.
    if (index === this.index && this.transition === null) return;
    this.finishTransition();
    this.slides.forEach((slide) => slide.classList.add('split-media-slide--settling'));
    this.updateActive(index);
    void this.slides[index].offsetHeight;
    this.slides.forEach((slide) => slide.classList.remove('split-media-slide--settling'));
  }

  beginResize(): void {
    this.resizing = true;
    this.finishTransition();
  }
  endResize(): void {
    this.resizing = false;
  }

  destroy(): void {
    this.destroyed = true;
    this.finishTransition();
    this.reducedMotion.removeEventListener('change', this.handleMotionChange);
  }

  private handleMotionChange = (): void => {
    if (this.reducedMotion.matches) this.finishTransition();
  };

  private updateActive(index: number): void {
    const focused = document.activeElement;
    if (!this.editing && index !== this.index && focused && this.slides[this.index]?.contains(focused)) {
      this.slides[this.index]?.closest<HTMLElement>('.split-media')?.focus({ preventScroll: true });
    }
    this.activeIndex = index;
    this.slides.forEach((slide, slideIndex) => {
      if (this.editing) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', String(slideIndex !== index));
      slide.toggleAttribute('inert', !this.editing && slideIndex !== index);
    });
  }

  private resetSlide(slide?: HTMLElement): void {
    if (!slide) return;
    slide.classList.add('split-media-slide--settling');
    slide.classList.remove('split-media-slide--leaving');
    void slide.offsetHeight;
    slide.classList.remove('split-media-slide--settling');
  }

  private finishTransition(): void {
    const transition = this.transition;
    if (!transition) return;
    this.transition = null;
    transition.cancelOutgoing?.();
    transition.cancelIncoming?.();
    this.resetSlide(transition.previous);
    this.resetSlide(this.slides[this.index]);
  }
}
