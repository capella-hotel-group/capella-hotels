import { moveInstrumentation } from '@/app/scripts.js';
import { wait } from './timing';

export interface RevealTriggers {
  expanded: Promise<void>;
  playing: Promise<void>;
  failed: Promise<void>;
  delayMs: number;
}

export function buildHeading(text: string, sourceCell: HTMLElement | null): HTMLHeadingElement {
  const heading = document.createElement('h2');
  heading.className = 'hero-destination-video-heading';
  const span = document.createElement('span');
  span.className = 'hero-destination-video-heading-text';
  span.textContent = text;
  heading.append(span);
  if (sourceCell) moveInstrumentation(sourceCell.querySelector('[data-aue-prop]') ?? sourceCell, heading);
  return heading;
}

/** Heading waits for the expansion AND (video playing + delay, or failure → expansion + delay). */
export function scheduleHeadingReveal(
  heading: HTMLElement,
  { expanded, playing, failed, delayMs }: RevealTriggers,
): Promise<void> {
  const afterPlayback = Promise.race([
    playing.then(() => wait(delayMs)),
    failed.then(() => expanded).then(() => wait(delayMs)),
  ]);
  return Promise.all([expanded, afterPlayback]).then(() => {
    heading.classList.add('is-revealed');
  });
}
