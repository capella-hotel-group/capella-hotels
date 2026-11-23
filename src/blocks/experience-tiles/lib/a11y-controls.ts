import type { Direction } from './carousel-controller';

export const LABELS = {
  carousel: 'Experience tiles',
  previous: 'Previous slide',
  next: 'Next slide',
  slide: (n: number, total: number): string => `${n} of ${total}`,
  status: (n: number, total: number): string => `Slide ${n} of ${total}`,
  newTab: '(opens in new tab)',
};

export interface CarouselControls {
  element: HTMLElement;
  status: HTMLElement;
  update: (index: number) => void;
  focusTarget: (direction: Direction) => HTMLElement;
}

export function buildControls(count: number, step: (direction: Direction) => void): CarouselControls {
  const element = document.createElement('div');
  element.className = 'experience-tiles-controls';
  const button = (direction: Direction, label: string, modifier: string): HTMLButtonElement => {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = `experience-tiles-control experience-tiles-control--${modifier}`;
    control.dataset.testid = `experience-tiles-${modifier}`;
    control.textContent = label;
    control.addEventListener('click', () => {
      if (control.getAttribute('aria-disabled') !== 'true') step(direction);
    });
    return control;
  };
  const previous = button(-1, LABELS.previous, 'previous');
  const next = button(1, LABELS.next, 'next');
  element.append(previous, next);

  const status = document.createElement('div');
  status.className = 'experience-tiles-status experience-tiles-sr-only';
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  let initialised = false;
  return {
    element,
    status,
    update(index) {
      previous.setAttribute('aria-disabled', String(index === 0));
      next.setAttribute('aria-disabled', String(index === count - 1));
      // The initial state is not news; announcing it would talk over the page load.
      if (initialised) status.textContent = LABELS.status(index + 1, count);
      initialised = true;
    },
    focusTarget: (direction) => (direction > 0 ? next : previous),
  };
}
