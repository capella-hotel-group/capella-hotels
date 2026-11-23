import { waitForTransforms } from './transition';

export type Direction = -1 | 1;
export type StepResult = 'changed' | 'edge' | 'busy' | 'queued';

export interface CarouselHooks {
  onChange?: (index: number) => void;
  focusTarget?: (direction: Direction) => HTMLElement | null;
}

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
  // One step asked for while panels are still moving; it plays as soon as they land.
  private queued: Direction | null = null;
  private resizing = false;
  private destroyed = false;

  constructor(
    private readonly slides: HTMLElement[],
    private readonly hooks: CarouselHooks = {},
  ) {}

  get index(): number {
    return this.activeIndex;
  }
  get count(): number {
    return this.slides.length;
  }
  get isAnimating(): boolean {
    return this.transition !== null;
  }
  get isBusy(): boolean {
    return this.destroyed || this.resizing || this.transition !== null;
  }
  private get editing(): boolean {
    return Boolean(this.slides[0]?.closest('.adobe-ue-edit'));
  }

  init(): void {
    const host = this.slides[0]?.parentElement;
    if (host && !host.dataset.direction) host.dataset.direction = 'forward';
    this.updateActive(0);
    this.reducedMotion.addEventListener('change', this.handleMotionChange);
  }

  requestStep(direction: Direction): StepResult {
    if (this.transition && !this.destroyed && !this.resizing) {
      this.queued = direction;
      return 'queued';
    }
    if (this.isBusy) return 'busy';
    const index = this.index + direction;
    if (!this.slides[index]) return 'edge';
    const previous = this.slides[this.index];
    const incoming = this.slides[index];
    if (!previous || !incoming) return 'edge';
    if (!this.reducedMotion.matches && !this.editing) this.orient(direction, previous);
    this.updateActive(index);
    if (this.reducedMotion.matches || this.editing) return 'changed';

    previous.classList.add('experience-tiles-slide--leaving');
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
      if (transition.outgoingDone && transition.incomingDone) this.completeTransition();
    };
    transition.cancelOutgoing = waitForTransforms(
      [...previous.querySelectorAll<HTMLElement>('.experience-tiles-item')],
      (cancelled) => complete(true, cancelled),
    );
    // Only the panels gate input; the copy fades in on its own and must not hold the reader back.
    transition.cancelIncoming = waitForTransforms(
      [...incoming.querySelectorAll<HTMLElement>('.experience-tiles-item')],
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
    this.slides.forEach((slide) => slide.classList.add('experience-tiles-slide--settling'));
    this.updateActive(index);
    void this.slides[index].offsetHeight;
    this.slides.forEach((slide) => slide.classList.remove('experience-tiles-slide--settling'));
  }

  beginResize(): void {
    this.queued = null;
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
    const previous = this.activeIndex;
    const focused = document.activeElement;
    if (!this.editing && index !== previous && focused && this.slides[previous]?.contains(focused)) {
      const target =
        this.hooks.focusTarget?.(index > previous ? 1 : -1) ??
        this.slides[previous]?.closest<HTMLElement>('.experience-tiles');
      target?.focus({ preventScroll: true });
    }
    this.activeIndex = index;
    this.slides.forEach((slide, slideIndex) => {
      if (this.editing) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', String(slideIndex !== index));
      slide.toggleAttribute('inert', !this.editing && slideIndex !== index);
    });
    this.hooks.onChange?.(index);
  }

  /** Resting slides wait on the side the next one enters from; move them there without animating. */
  private orient(direction: Direction, current: HTMLElement): void {
    const host = current.parentElement;
    const name = direction > 0 ? 'forward' : 'backward';
    if (!host || host.dataset.direction === name) return;
    const resting = this.slides.filter((slide) => slide !== current);
    resting.forEach((slide) => slide.classList.add('experience-tiles-slide--settling'));
    host.dataset.direction = name;
    void host.offsetHeight;
    resting.forEach((slide) => slide.classList.remove('experience-tiles-slide--settling'));
  }

  // Natural end: the incoming slide is left alone so its copy keeps fading in.
  private completeTransition(): void {
    this.transition = null;
    const next = this.queued;
    this.queued = null;
    if (next !== null) this.requestStep(next);
  }

  private resetSlide(slide?: HTMLElement): void {
    if (!slide) return;
    slide.classList.add('experience-tiles-slide--settling');
    slide.classList.remove('experience-tiles-slide--leaving');
    void slide.offsetHeight;
    slide.classList.remove('experience-tiles-slide--settling');
  }

  private finishTransition(): void {
    this.queued = null;
    const transition = this.transition;
    if (!transition) return;
    this.transition = null;
    transition.cancelOutgoing?.();
    transition.cancelIncoming?.();
    this.resetSlide(transition.previous);
    this.resetSlide(this.slides[this.index]);
  }
}
