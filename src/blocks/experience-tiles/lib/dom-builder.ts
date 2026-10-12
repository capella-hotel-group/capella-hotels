// src/blocks/experience-tiles/lib/dom-builder.ts
import { moveInstrumentation } from '@/app/scripts';
import type { SplitMediaPanel, SplitMediaSlide } from './types';

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
  cell.classList.add('experience-tiles-links');

  const authored = [...cell.children] as HTMLElement[];

  [...cell.querySelectorAll<HTMLAnchorElement>('a')].forEach((anchor, index) => {
    anchor.classList.add('experience-tiles-link');
    anchor.dataset.testid = index === 0 ? 'experience-tiles-primary-cta' : 'experience-tiles-secondary-cta';
    const wrapper = authored.findIndex((element) => element === anchor || element.contains(anchor));
    const flag = wrapper < 0 ? undefined : authored.slice(wrapper + 1).find(isBooleanFlag);
    applyTarget(anchor, isEnabled(flag?.textContent?.trim() || ''));
    if (index) {
      const divider = document.createElement('span');
      divider.className = 'experience-tiles-link-divider';
      divider.setAttribute('aria-hidden', 'true');
      cell.append(divider);
    }
    cell.append(anchor);
  });

  // the booleans and the paragraphs the links were lifted out of are authoring artefacts
  authored
    .filter((element) => !element.matches('a'))
    .forEach((element) => element.classList.add('experience-tiles-link-flag'));
}

// "Element Grouping" (fields sharing a prefix before the second underscore segment) puts each
// media field's own <picture> wrapper alone in its cell, so it can be appended as-is
function buildMedia(mediaCell?: HTMLElement): HTMLDivElement {
  const media = document.createElement('div');
  media.className = 'experience-tiles-media';
  if (mediaCell) media.append(mediaCell);
  return media;
}

function buildHeading(
  eyebrow: HTMLElement | undefined,
  headline: HTMLElement | undefined,
  isDetail: boolean,
): HTMLDivElement {
  const heading = document.createElement('div');
  heading.className = 'experience-tiles-heading';

  if (eyebrow) {
    eyebrow.classList.add('experience-tiles-eyebrow');
    heading.append(eyebrow);
  }

  if (headline) {
    headline.classList.add('experience-tiles-headline');
    headline.setAttribute('role', 'heading');
    headline.setAttribute('aria-level', isDetail ? '3' : '2');
    heading.append(headline);
  }

  return heading;
}

// left/hero panel: media + optional eyebrow + headline only, no description or CTAs
function buildLeftPanel(panel: SplitMediaPanel): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'experience-tiles-item experience-tiles-item--left';

  const media = buildMedia(panel.mediaCell);
  const overlay = document.createElement('div');
  overlay.className = 'experience-tiles-overlay';

  const { contentCell } = panel;
  if (contentCell) {
    // eyebrow/headline are plain "text" fields (bare <p>). An omitted optional eyebrow drops
    // its element entirely, which would shift a fixed index — distinguishing by count instead
    // of position survives that.
    const paragraphs = [...contentCell.querySelectorAll<HTMLElement>(':scope > p')];
    const headline = getField(contentCell, 'leftContent_headline') || paragraphs[paragraphs.length > 1 ? 1 : 0];
    const eyebrow = getField(contentCell, 'leftContent_eyebrow') || (paragraphs.length > 1 ? paragraphs[0] : undefined);

    const body = document.createElement('div');
    body.className = 'experience-tiles-body';
    body.append(buildHeading(eyebrow, headline, false));
    overlay.append(body);
  }

  media.append(overlay);
  item.append(media);
  return item;
}

// right/detail panel: media + headline + description + up to two CTAs
function buildRightPanel(panel: SplitMediaPanel): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'experience-tiles-item experience-tiles-item--right';

  const media = buildMedia(panel.mediaCell);
  const overlay = document.createElement('div');
  overlay.className = 'experience-tiles-overlay';

  const { contentCell } = panel;
  if (contentCell) {
    const paragraphs = [...contentCell.querySelectorAll<HTMLElement>(':scope > p')];
    const headline = getField(contentCell, 'rightContent_headline') || paragraphs[0];
    const authoredDescription = getField(contentCell, 'rightContent_description');

    const body = document.createElement('div');
    body.className = 'experience-tiles-body';
    body.append(buildHeading(undefined, headline, true));

    // Published richtext can be several sibling paragraphs/lists, not one wrapper.
    // Move the original nodes after extracting the headline to retain all formatting.
    const description = authoredDescription || document.createElement('div');
    if (!authoredDescription) description.append(...contentCell.childNodes);

    // description+links sit in their own group so tablet/desktop can lay it out as the
    // heading's second grid column, matching Figma
    const copy = document.createElement('div');
    copy.className = 'experience-tiles-copy';

    if (authoredDescription || description.textContent?.trim() || description.querySelector('img, br')) {
      description.classList.add('experience-tiles-description');
      copy.append(description);
    }

    // an empty cta cell (neither link authored) stays out of the flow entirely — parked as a
    // hidden sibling instead of an empty grid/flex cell, which would otherwise still claim a gap
    if (panel.ctaCell) {
      if (panel.ctaCell.querySelector('a')) {
        decorateLinks(panel.ctaCell);
        copy.append(panel.ctaCell);
      } else {
        panel.ctaCell.classList.add('experience-tiles-hidden');
        overlay.append(panel.ctaCell);
      }
    }

    if (copy.hasChildNodes()) body.append(copy);
    overlay.append(body);
  }

  media.append(overlay);
  item.append(media);
  return item;
}

// a slide is one authored row now — move its instrumentation onto the <li>, not the panels
export function buildSlide(slide: SplitMediaSlide, index: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'experience-tiles-slide';
  li.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
  if (slide.sourceRow) moveInstrumentation(slide.sourceRow, li);

  // Each slot clips its own incoming/outgoing pair. Mobile panels travel their own height,
  // so staggering them cannot expose the track or let an inactive panel cover its neighbour.
  [buildLeftPanel(slide.left), buildRightPanel(slide.right)].forEach((panel) => {
    const slot = document.createElement('div');
    slot.className = 'experience-tiles-slot';
    slot.append(panel);
    li.append(slot);
  });
  if (!li.querySelector('img') && !li.textContent?.trim()) {
    const placeholder = document.createElement('p');
    placeholder.className = 'experience-tiles-placeholder';
    placeholder.textContent = 'Add images and text to this slide';
    li.append(placeholder);
  }
  return li;
}
