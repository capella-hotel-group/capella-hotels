// src/blocks/hero-destination/lib/dom-builder.ts
import { moveInstrumentation } from '@/app/scripts.js';
import { buildMedia } from './media';
import type { HeroDestinationItem } from './types';

export function buildSlide(item: HeroDestinationItem, index: number, idPrefix: string): HTMLLIElement {
  const slide = document.createElement('li');
  slide.className = 'hero-destination-slide';
  slide.id = `${idPrefix}-panel-${index}`;
  slide.setAttribute('role', 'tabpanel');
  slide.setAttribute('aria-labelledby', `${idPrefix}-tab-${index}`);
  slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
  // Panels hold no focusable content, so the active one takes focus itself (APG tabs).
  if (index === 0) slide.tabIndex = 0;
  moveInstrumentation(item.sourceRow, slide);

  const media = buildMedia(item);
  if (!item.showOverlay) media.classList.add('hero-destination-media--no-overlay');

  const heading = document.createElement('h2');
  heading.className = 'hero-destination-heading';
  heading.textContent = item.heading;

  slide.append(media, heading);
  return slide;
}

/** Builds one tab per `headings` entry. Callers wire click handlers and decide whether to append the nav. */
export function buildDotNav(headings: string[], idPrefix: string): { nav: HTMLDivElement; dots: HTMLButtonElement[] } {
  const nav = document.createElement('div');
  nav.className = 'hero-destination-dots';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Slides');

  const dots = headings.map((heading, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'hero-destination-dot';
    dot.id = `${idPrefix}-tab-${index}`;
    dot.setAttribute('role', 'tab');
    // Named after the slide's heading: `aria-controls` alone never makes a screen reader read the
    // panel, so the tab's own name has to carry the content.
    dot.setAttribute('aria-label', heading || `Slide ${index + 1}`);
    dot.setAttribute('aria-controls', `${idPrefix}-panel-${index}`);
    dot.setAttribute('aria-selected', 'false');
    dot.tabIndex = -1;
    nav.append(dot);
    return dot;
  });

  return { nav, dots };
}

/**
 * Pause/play control required by WCAG 2.2 SC 2.2.2. Must be a sibling of the dot nav, never a
 * child: that nav is a `role="tablist"`, which may only contain tabs.
 */
export function buildPlayToggle(): HTMLButtonElement {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hero-destination-toggle';
  toggle.dataset.state = 'playing';
  toggle.setAttribute('aria-label', 'Pause slideshow');

  const icon = document.createElement('span');
  icon.className = 'hero-destination-toggle-icon';
  icon.setAttribute('aria-hidden', 'true');
  toggle.append(icon);

  return toggle;
}
