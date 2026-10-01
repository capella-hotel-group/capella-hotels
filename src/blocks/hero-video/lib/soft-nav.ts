import { decorateMain } from '@/app/scripts';
import { loadSections } from '@/app/aem';
import type { HeroVideoElement } from './types';
import { TOGGLE_INDICATOR_SHIFT } from './types';

const FADE_ATTR = 'data-soft-nav';
const FADE_OUT_CLASS = 'mode-toggle-fade-out';
const FADE_IN_START_CLASS = 'mode-toggle-fade-in-start';
// Safety-net timeout only — real completion is signalled by `transitionend`, which respects
// each block's own `--soft-nav-duration` override. Kept generous so per-block customization
// (e.g. a 500ms transition) never gets cut short if transitionend somehow doesn't fire.
const FADE_DURATION_MS = 800;
// Upper bound on how long the hero-video reveal waits for its incoming video's first frame
// before showing anyway — prevents a blocked-autoplay video from stalling the whole transition.
const FIRST_FRAME_GATE_MS = 800;
// Only this node (the toggle sub-DOM hero-video renders) stays mounted across a swap so its
// indicator slides continuously instead of re-mounting. It lives inside hero-video, whose media
// still swaps to the incoming page's video.
const PRESERVE_SELECTOR = '.hero-video-toggle';

let activeController: AbortController | null = null;
let popstateBound = false;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isModifiedClick(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isSameOriginLink(anchor: HTMLAnchorElement): boolean {
  try {
    return new URL(anchor.href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function shouldIntercept(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  if (isModifiedClick(event)) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (!isSameOriginLink(anchor)) return false;
  return true;
}

function normalize(path: string): string {
  return path.replace(/\/?$/, '/');
}

/** Recomputes active/aria-current state for every mode-toggle instance on the page. */
function syncActiveState(pathname: string): void {
  document.querySelectorAll<HTMLElement>('.mode-toggle-inner[data-experience-href]').forEach((inner) => {
    const expHref = inner.dataset.experienceHref ?? '/en/experience/';
    const isExperience = normalize(pathname) === normalize(expHref);

    const destLink = inner.querySelector<HTMLAnchorElement>('.mode-toggle-btn--dest');
    const expLink = inner.querySelector<HTMLAnchorElement>('.mode-toggle-btn--exp');
    const indicator = inner.querySelector<HTMLElement>('.mode-toggle-indicator');

    destLink?.classList.toggle('mode-toggle-btn--active', !isExperience);
    expLink?.classList.toggle('mode-toggle-btn--active', isExperience);
    if (isExperience) {
      destLink?.removeAttribute('aria-current');
      expLink?.setAttribute('aria-current', 'page');
    } else {
      expLink?.removeAttribute('aria-current');
      destLink?.setAttribute('aria-current', 'page');
    }
    if (indicator) indicator.style.transform = isExperience ? TOGGLE_INDICATOR_SHIFT : 'translateX(0%)';
  });
}

function waitForFadeOut(sections: HTMLElement[]): Promise<void> {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  sections.forEach((section) => {
    section.setAttribute(FADE_ATTR, '');
    section.classList.add(FADE_OUT_CLASS);
  });
  if (reduceMotion || sections.length === 0) return Promise.resolve();
  const [firstSection] = sections;
  if (!firstSection) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, FADE_DURATION_MS);
    firstSection.addEventListener(
      'transitionend',
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Splits an element's content into fade targets: every descendant subtree that does NOT contain
 * the preserved node fades as one unit; whichever branch does contain it is recursed into, so the
 * preserved node is excluded at whatever depth it actually lives (e.g. nested inside hero-video).
 */
function collectFadeTargets(root: HTMLElement, preservedNode: HTMLElement | null): HTMLElement[] {
  if (!preservedNode) return [...root.children] as HTMLElement[];
  const targets: HTMLElement[] = [];
  [...root.children].forEach((child) => {
    if (child === preservedNode) return;
    if (child.contains(preservedNode)) {
      targets.push(...collectFadeTargets(child as HTMLElement, preservedNode));
    } else {
      targets.push(child as HTMLElement);
    }
  });
  return targets;
}

async function navigate(url: string, { push }: { push: boolean }): Promise<void> {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  const currentMain = document.querySelector<HTMLElement>('main');
  if (!currentMain) {
    window.location.assign(url);
    return;
  }

  const preservedNode = currentMain.querySelector<HTMLElement>(PRESERVE_SELECTOR);
  const fadeTargets = collectFadeTargets(currentMain, preservedNode);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newMain = doc.querySelector<HTMLElement>('main');
    if (!newMain) throw new Error('No <main> found in fetched document');

    decorateMain(newMain);

    await loadSections(newMain);

    await waitForFadeOut(fadeTargets);

    // The incoming hero-video builds its own toggle during loadSections(). Remove that fresh
    // instance and graft the preserved node into its exact slot so the indicator animates
    // continuously (one toggle, no overlap) instead of a second toggle mounting on top of it.
    const heroVideoInNew = newMain.querySelector<HTMLElement>('.hero-video');
    const incomingToggle = heroVideoInNew?.querySelector<HTMLElement>(PRESERVE_SELECTOR) ?? null;
    const graftParent = incomingToggle?.parentElement ?? heroVideoInNew ?? null;
    const graftBefore = incomingToggle?.nextElementSibling ?? null;
    incomingToggle?.remove();
    if (preservedNode && graftParent) {
      graftParent.insertBefore(preservedNode, graftBefore);
    }

    // Pre-fade the incoming content so it's invisible (and slightly scaled up) right up until
    // insertion, then reveal it with a zoom-in + fade — the preserved node never gets this class.
    const newContentTargets = collectFadeTargets(newMain, preservedNode);
    const heroTargets = newContentTargets.filter((el) => el.closest('.hero-video') !== null);
    const otherTargets = newContentTargets.filter((el) => el.closest('.hero-video') === null);
    newContentTargets.forEach((el) => {
      el.setAttribute(FADE_ATTR, '');
      el.classList.add(FADE_IN_START_CLASS);
    });

    currentMain.replaceChildren(...newMain.children);

    newContentTargets.forEach((el) => el.getBoundingClientRect()); // force reflow
    otherTargets.forEach((el) => el.classList.remove(FADE_IN_START_CLASS));

    document.title = doc.title;
    if (push) window.history.pushState({}, '', url);
    syncActiveState(new URL(url, window.location.href).pathname);

    // Hold the hero-video reveal until its incoming video has a decoded frame, so the fade-in
    // coincides with the video crossfade (matching the initial page load) rather than flashing
    // in a poster first. Capped by FIRST_FRAME_GATE_MS so blocked autoplay can't stall forever.
    if (heroTargets.length > 0) {
      const hero = currentMain.querySelector<HeroVideoElement>('.hero-video');
      await Promise.race([hero?.__heroFirstFrameReady ?? Promise.resolve(), delay(FIRST_FRAME_GATE_MS)]);
      heroTargets.forEach((el) => el.classList.remove(FADE_IN_START_CLASS));
    }
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') return;
    console.error('mode-toggle soft-nav failed, falling back to full navigation', error);
    window.location.assign(url);
  } finally {
    fadeTargets.forEach((el) => el.removeAttribute(FADE_ATTR));
    if (activeController === controller) activeController = null;
  }
}

export function initSoftNav(anchors: HTMLAnchorElement[]): void {
  anchors.forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      if (!shouldIntercept(event, anchor)) return;
      event.preventDefault();
      navigate(anchor.href, { push: true });
    });
  });

  if (!popstateBound) {
    popstateBound = true;
    window.addEventListener('popstate', () => {
      navigate(window.location.href, { push: false });
    });
  }
}
