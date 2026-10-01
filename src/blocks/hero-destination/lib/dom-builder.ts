// src/blocks/hero-destination/lib/dom-builder.ts
import { moveInstrumentation } from '@/app/scripts.js';
import { buildMedia } from './media';
import type { HeroDestinationItem } from './types';

export function buildSlide(item: HeroDestinationItem, index: number): HTMLLIElement {
  const slide = document.createElement('li');
  slide.className = 'hero-destination-slide';
  slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
  moveInstrumentation(item.sourceRow, slide);

  const media = buildMedia(item);

  const heading = document.createElement('h2');
  heading.className = 'hero-destination-heading';
  heading.textContent = item.heading;

  slide.append(media, heading);
  return slide;
}

/** Builds `count` dot buttons inside a tablist nav. Callers wire click handlers and decide whether to append the nav. */
export function buildDotNav(count: number): { nav: HTMLDivElement; dots: HTMLButtonElement[] } {
  const nav = document.createElement('div');
  nav.className = 'hero-destination-dots';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Slides');

  const dots: HTMLButtonElement[] = [];
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'hero-destination-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    dots.push(dot);
    nav.append(dot);
  }

  return { nav, dots };
}
