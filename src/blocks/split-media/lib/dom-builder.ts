// src/blocks/split-media/lib/dom-builder.ts
import { moveInstrumentation } from '@/app/scripts.js';
import type { SplitMediaPanel, SplitMediaSlide } from './types';

// Exported from the Figma "arrow-icon" component (28x28). fill is currentColor
// so the stylesheet owns the colour. Shared with destination-introduction's nav.
const ARROW_PATHS: Record<'prev' | 'next', string> = {
  prev: 'M19.71 4C15.98 7.16 12.47 10.56 9 14C10.79 15.78 12.59 17.56 14.44 19.27C15.96 20.68 18.13 22.69 19.71 24C16.71 20.46 11 14 11 14C11 14 18.2116 5.76279 19.71 4Z',
  next: 'M9 4C12.73 7.16 16.24 10.56 19.71 14C17.92 15.78 16.12 17.56 14.27 19.27C12.75 20.68 10.58 22.69 9 24C12 20.46 17.5 14 17.5 14C17.5 14 10.4984 5.76279 9 4Z',
};

function isEnabled(value: string): boolean {
  return ['true', 'yes', 'enabled'].includes(value.trim().toLowerCase());
}

function isBooleanFlag(element: Element): boolean {
  return /^(true|false)$/i.test(element.textContent?.trim() || '');
}

function getField(root: Element, property: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-aue-prop="${property}"]`);
}

function applyTarget(anchor: HTMLAnchorElement, openInNewTab: boolean): void {
  if (!openInNewTab) return;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
}

// pairs each link with its trailing open-in-new-tab flag, lifts it out of its authoring
// paragraph, and inserts a divider between the primary and secondary link
function decorateLinks(cell: HTMLElement): void {
  cell.classList.add('split-media-links');

  const authored = [...cell.children] as HTMLElement[];

  [...cell.querySelectorAll<HTMLAnchorElement>('a')].forEach((anchor, index) => {
    anchor.classList.add('split-media-link');
    anchor.dataset.testid = index === 0 ? 'split-media-primary-cta' : 'split-media-secondary-cta';
    const wrapper = authored.findIndex((element) => element === anchor || element.contains(anchor));
    const flag = wrapper < 0 ? undefined : authored.slice(wrapper + 1).find(isBooleanFlag);
    applyTarget(anchor, isEnabled(flag?.textContent?.trim() || ''));
    if (index) {
      const divider = document.createElement('span');
      divider.className = 'split-media-link-divider';
      divider.setAttribute('aria-hidden', 'true');
      cell.append(divider);
    }
    cell.append(anchor);
  });

  // the booleans and the paragraphs the links were lifted out of are authoring artefacts
  authored
    .filter((element) => !element.matches('a'))
    .forEach((element) => element.classList.add('split-media-link-flag'));
}

// role is fixed by position — left is always the large "hero" style, right the compact
// "detail" style with body copy/links, matching the two panels Figma shows
function buildPanel(panel: SplitMediaPanel, role: 'left' | 'right'): HTMLDivElement {
  const isDetail = role === 'right';

  const item = document.createElement('div');
  item.className = isDetail ? 'split-media-item split-media-item--detail' : 'split-media-item';
  if (panel.sourceRow) moveInstrumentation(panel.sourceRow, item);

  const media = document.createElement('div');
  media.className = 'split-media-media';
  if (panel.mediaCell) media.append(panel.mediaCell);

  const overlay = document.createElement('div');
  overlay.className = 'split-media-overlay';

  const { contentCell } = panel;
  if (contentCell) {
    // eyebrow/headline are plain "text" fields (bare <p>); description is "richtext" (its own
    // <div>). An omitted optional eyebrow drops its cell entirely outside the editor, which
    // would shift a fixed index — distinguishing by tag instead survives that.
    const paragraphs = [...contentCell.querySelectorAll<HTMLElement>(':scope > p')];
    const headline = getField(contentCell, 'content_headline') || paragraphs[paragraphs.length > 1 ? 1 : 0];
    const eyebrow = getField(contentCell, 'content_eyebrow') || (paragraphs.length > 1 ? paragraphs[0] : undefined);
    const description =
      getField(contentCell, 'content_description') || contentCell.querySelector<HTMLElement>(':scope > div');

    const heading = document.createElement('div');
    heading.className = 'split-media-heading';

    if (eyebrow) {
      eyebrow.classList.add('split-media-eyebrow');
      heading.append(eyebrow);
    }

    if (headline) {
      headline.classList.add('split-media-headline');
      headline.setAttribute('role', 'heading');
      headline.setAttribute('aria-level', isDetail ? '3' : '2');
      heading.append(headline);
    }

    const body = document.createElement('div');
    body.className = 'split-media-body';
    body.append(heading);

    // description+links sit in their own group so tablet/desktop can lay it out as the
    // heading's second grid column, matching Figma
    const copy = document.createElement('div');
    copy.className = 'split-media-copy';

    if (description) {
      description.classList.add('split-media-description');
      copy.append(description);
    }

    // an empty cta cell (neither link authored) stays out of the flow entirely — parked as a
    // hidden sibling instead of an empty grid/flex cell, which would otherwise still claim a gap
    if (panel.ctaCell) {
      if (panel.ctaCell.querySelector('a')) {
        decorateLinks(panel.ctaCell);
        copy.append(panel.ctaCell);
      } else {
        panel.ctaCell.classList.add('split-media-hidden');
        overlay.append(panel.ctaCell);
      }
    }

    if (copy.hasChildNodes()) body.append(copy);
    overlay.append(body);
  }

  // the overlay lives inside media (not as its sibling) so media's flex column pins it to
  // the bottom edge — matches `.split-media-media { justify-content: flex-end }`
  media.append(overlay);
  item.append(media);
  return item;
}

// a slide is a purely visual grouping of two independently-authored panel rows — nothing to
// move instrumentation from at this level, each panel already carries its own via buildPanel
export function buildSlide(slide: SplitMediaSlide, index: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'split-media-slide';
  li.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');

  li.append(buildPanel(slide.left, 'left'), buildPanel(slide.right, 'right'));
  return li;
}

/** Builds `count` dot buttons inside a tablist nav. Callers wire click handlers and decide whether to append the nav. */
export function buildDotNav(count: number): { nav: HTMLDivElement; dots: HTMLButtonElement[] } {
  const nav = document.createElement('div');
  nav.className = 'split-media-dots';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', 'Slides');

  const dots: HTMLButtonElement[] = [];
  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'split-media-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
    dots.push(dot);
    nav.append(dot);
  }

  return { nav, dots };
}

function buildArrow(direction: 'prev' | 'next', label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `split-media-nav split-media-nav-${direction}`;
  button.dataset.testid = direction === 'prev' ? 'split-media-previous' : 'split-media-next';
  button.setAttribute('aria-label', label);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 28 28');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '28');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', ARROW_PATHS[direction]);
  svg.append(path);
  button.append(svg);

  return button;
}

/** Builds the prev/next arrow pair. Callers wire click handlers and decide whether to append the nav. */
export function buildArrowNav(): { nav: HTMLDivElement; prev: HTMLButtonElement; next: HTMLButtonElement } {
  const nav = document.createElement('div');
  nav.className = 'split-media-controls';

  const prev = buildArrow('prev', 'Previous slide');
  const next = buildArrow('next', 'Next slide');
  nav.append(prev, next);

  return { nav, prev, next };
}
