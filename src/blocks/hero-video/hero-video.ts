// src/blocks/hero-video/hero-video.ts
import { resolveDAMUrl } from '@/utils/env';
import { emitHeroImpression, emitItemSelect, emitMediaError } from './lib/analytics';
import { runIntro, skipIntro } from './lib/intro';
import { MediaManager } from './lib/media-manager';
import { SelectorUI } from './lib/selector-ui';
import { initSoftNav } from './lib/soft-nav';
import type { HeroVideoConfig, HeroVideoElement, HeroVideoItem, HeroVideoState, IntroElements } from './lib/types';
import { TOGGLE_INDICATOR_SHIFT } from './lib/types';

// ── Cursor controller ─────────────────────────────────────────────────────────

const CURSOR_LERP = 0.12;

class CursorController {
  private container: HTMLElement;
  private cursorEl: HTMLElement;
  private rafId = 0;
  private targetX = 0;
  private targetY = 0;
  private currentX = 0;
  private currentY = 0;
  private isActive = false;
  private mounted = false;

  constructor(container: HTMLElement, cursorEl: HTMLElement) {
    this.container = container;
    this.cursorEl = cursorEl;
  }

  mount(): void {
    if (this.mounted) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.mounted = true;
    this.cursorEl.style.display = 'block';
    this.container.addEventListener('mouseenter', this.onEnter);
    this.container.addEventListener('mouseleave', this.onLeave);
    this.container.addEventListener('mousemove', this.onMove);
  }

  private onEnter = (): void => {
    this.isActive = true;
    this.cursorEl.style.opacity = '1';
    this.tick();
  };

  private onLeave = (): void => {
    this.isActive = false;
    this.cursorEl.style.opacity = '0';
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  };

  private onMove = (e: MouseEvent): void => {
    const rect = this.container.getBoundingClientRect();
    this.targetX = e.clientX - rect.left;
    this.targetY = e.clientY - rect.top;
  };

  private tick = (): void => {
    this.currentX += (this.targetX - this.currentX) * CURSOR_LERP;
    this.currentY += (this.targetY - this.currentY) * CURSOR_LERP;
    this.cursorEl.style.transform = `translate(${this.currentX}px, ${this.currentY}px)`;
    if (this.isActive) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  destroy(): void {
    this.isActive = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.mounted) {
      this.container.removeEventListener('mouseenter', this.onEnter);
      this.container.removeEventListener('mouseleave', this.onLeave);
      this.container.removeEventListener('mousemove', this.onMove);
      this.mounted = false;
    }
  }
}

// ── DOM parsing ───────────────────────────────────────────────────────────────

function parseConfig(configRows: HTMLElement[]): HeroVideoConfig {
  // Each block-level field renders as its own single-cell row, in model declaration order:
  //   0=prefix, 1=suffix, 2=transition, 3=destinationLabel, 4=destinationUrl,
  //   5=experienceLabel, 6=experienceUrl. The authored value lives in row.children[0].
  const cellText = (i: number): string => configRows[i]?.children[0]?.textContent?.trim() ?? '';
  const cellAnchor = (i: number): HTMLAnchorElement | null =>
    configRows[i]?.children[0]?.querySelector<HTMLAnchorElement>('a') ?? null;

  const rawTransition = cellText(2).toLowerCase();
  const transition: HeroVideoConfig['transition'] =
    rawTransition === 'slide' || rawTransition === 'cut' ? rawTransition : 'crossfade';

  return {
    prefix: cellText(0) || 'See',
    suffix: cellText(1) || 'with new eyes',
    transition,
    destinationLabel: cellText(3) || 'Destinations',
    destinationHref: cellAnchor(4)?.getAttribute('href') || '/en/',
    experienceLabel: cellText(5) || 'Experiences',
    experienceHref: cellAnchor(6)?.getAttribute('href') || '/en/experience/',
  };
}

function parseItems(itemRows: HTMLElement[]): HeroVideoItem[] {
  return itemRows
    .map((row): HeroVideoItem | null => {
      const cells = [...row.children] as HTMLElement[];
      // Model fields → cell indices:
      //   cells[0] = label, cells[1] = video, cells[2] = poster,
      //   cells[3] = link, cells[4] = focalDesktop, cells[5] = focalMobile
      if (cells.length < 2) return null;

      const label = cells[0]?.textContent?.trim() ?? '';

      const videoAnchor = cells[1]?.querySelector<HTMLAnchorElement>('a');
      const rawVideo = (videoAnchor?.href ?? cells[1]?.textContent?.trim() ?? '').trim();
      const looksLikeVideoUrl = /^https?:\/\//i.test(rawVideo) || rawVideo.startsWith('/');
      const videoUrl = looksLikeVideoUrl ? resolveDAMUrl(rawVideo) : '';

      const poster = cells[2]?.querySelector('picture') ?? null;
      const posterUrl = poster?.querySelector<HTMLImageElement>('img')?.src ?? '';
      const linkAnchor = cells[3]?.querySelector<HTMLAnchorElement>('a');
      const link = linkAnchor?.href ?? null;
      const focalDesktop = cells[4]?.textContent?.trim() || 'center';
      const focalMobile = cells[5]?.textContent?.trim() || 'center';

      if (!label || !videoUrl) return null;

      return { label, videoUrl, posterUrl, link, focalDesktop, focalMobile, sourceRow: row };
    })
    .filter((item): item is HeroVideoItem => item !== null);
}

// ── DOM builder ───────────────────────────────────────────────────────────────

function buildToggle(config: HeroVideoConfig): {
  toggleWrapper: HTMLElement;
  destLink: HTMLAnchorElement;
  expLink: HTMLAnchorElement;
} {
  const normalizePath = (p: string): string => p.replace(/\/?$/, '/');
  const isExperience = normalizePath(window.location.pathname) === normalizePath(config.experienceHref);

  const toggleWrapper = document.createElement('div');
  toggleWrapper.className = 'hero-video-toggle';

  const inner = document.createElement('div');
  inner.className = 'mode-toggle-inner';
  inner.setAttribute('role', 'group');
  inner.setAttribute('aria-label', 'Site mode');
  // Persisted so soft-nav can recompute active state without re-reading the (detached) source row.
  inner.dataset.destinationHref = config.destinationHref;
  inner.dataset.experienceHref = config.experienceHref;

  const destLink = document.createElement('a');
  destLink.href = config.destinationHref;
  destLink.className = `mode-toggle-btn mode-toggle-btn--dest${!isExperience ? ' mode-toggle-btn--active' : ''}`;
  destLink.textContent = config.destinationLabel;
  if (!isExperience) destLink.setAttribute('aria-current', 'page');

  const track = document.createElement('div');
  track.className = 'mode-toggle-track';
  track.setAttribute('role', 'button');
  track.setAttribute('tabindex', '0');
  track.setAttribute('aria-label', 'Toggle site mode');
  const indicator = document.createElement('div');
  indicator.className = 'mode-toggle-indicator';
  indicator.style.transform = isExperience ? TOGGLE_INDICATOR_SHIFT : 'translateX(0%)';
  track.append(indicator);

  const expLink = document.createElement('a');
  expLink.href = config.experienceHref;
  expLink.className = `mode-toggle-btn mode-toggle-btn--exp${isExperience ? ' mode-toggle-btn--active' : ''}`;
  expLink.textContent = config.experienceLabel;
  if (isExperience) expLink.setAttribute('aria-current', 'page');

  // Clicking/pressing the track switches to whichever side isn't active, reusing the same link
  // (and its soft-nav click handler) so behavior stays in sync with the labels.
  const toggleViaTrack = (): void => {
    const target = expLink.classList.contains('mode-toggle-btn--active') ? destLink : expLink;
    target.click();
  };
  track.addEventListener('click', toggleViaTrack);
  track.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleViaTrack();
    }
  });

  inner.append(destLink, track, expLink);
  toggleWrapper.append(inner);

  return { toggleWrapper, destLink, expLink };
}

function buildDOM(config: HeroVideoConfig): {
  root: DocumentFragment;
  mediaEl: HTMLElement;
  posterEl: HTMLElement;
  videoA: HTMLVideoElement;
  videoB: HTMLVideoElement;
  overlayEl: HTMLElement;
  introPhraseEl: HTMLElement;
  phrasePrefixEl: HTMLElement;
  phraseSuffixEl: HTMLElement;
  prefixEl: HTMLElement;
  suffixEl: HTMLElement;
  itemListEl: HTMLUListElement;
  controlsEl: HTMLElement;
  soundBtn: HTMLButtonElement;
  cursorEl: HTMLElement;
  destLink: HTMLAnchorElement;
  expLink: HTMLAnchorElement;
} {
  const fragment = document.createDocumentFragment();

  // ── Media layer ──────────────────────────────────────────────────────────
  const mediaEl = document.createElement('div');
  mediaEl.className = 'hero-video-media';

  const posterEl = document.createElement('div');
  posterEl.className = 'hero-video-poster';

  const videoA = document.createElement('video');
  videoA.className = 'hero-video-video hero-video-video--a';
  videoA.muted = true;
  // The `muted` and `autoplay` HTML attributes (not just the JS properties) are what Chrome's
  // autoplay policy inspects to classify a video as autoplay-safe. Without them, muted playback
  // started from an async context (e.g. after a soft-nav fetch) can be blocked until a gesture.
  videoA.setAttribute('muted', '');
  videoA.setAttribute('autoplay', '');
  videoA.playsInline = true;
  videoA.loop = true;
  videoA.setAttribute('aria-hidden', 'true');

  const videoB = document.createElement('video');
  videoB.className = 'hero-video-video hero-video-video--b';
  videoB.muted = true;
  videoB.setAttribute('muted', '');
  videoB.setAttribute('autoplay', '');
  videoB.playsInline = true;
  videoB.loop = true;
  videoB.setAttribute('aria-hidden', 'true');

  mediaEl.append(posterEl, videoA, videoB);

  // ── Contrast overlay ──────────────────────────────────────────────────────
  const overlayEl = document.createElement('div');
  overlayEl.className = 'hero-video-overlay';
  overlayEl.setAttribute('aria-hidden', 'true');

  // ── Intro phrase (single centered sentence, visible during intro only) ────
  // Prefix/suffix are wrapped in spans so the split can hand each word off to the real prefix/
  // suffix by position (FLIP) instead of cross-fading — so "with new eyes" never fades in twice.
  const introPhraseEl = document.createElement('div');
  introPhraseEl.className = 'hero-video-intro-phrase';
  introPhraseEl.setAttribute('aria-hidden', 'true');
  const phrasePrefixEl = document.createElement('span');
  phrasePrefixEl.textContent = config.prefix;
  const phraseSuffixEl = document.createElement('span');
  phraseSuffixEl.textContent = config.suffix;
  introPhraseEl.append(phrasePrefixEl, document.createTextNode(' '), phraseSuffixEl);

  // ── Selector UI ───────────────────────────────────────────────────────────
  const selectorEl = document.createElement('div');
  selectorEl.className = 'hero-video-selector';
  selectorEl.setAttribute('aria-label', 'Destination selector');

  const prefixEl = document.createElement('div');
  prefixEl.className = 'hero-video-prefix';
  prefixEl.textContent = config.prefix;
  prefixEl.setAttribute('aria-hidden', 'true');

  const itemListEl = document.createElement('ul');
  itemListEl.className = 'hero-video-items';
  itemListEl.setAttribute('role', 'listbox');
  itemListEl.setAttribute('aria-label', 'Select a destination');
  // Items are rendered by SelectorUI.renderItems() (single source of truth,
  // carries UE instrumentation and wires pointer/keyboard listeners).

  const suffixEl = document.createElement('div');
  suffixEl.className = 'hero-video-suffix';
  suffixEl.textContent = config.suffix;
  suffixEl.setAttribute('aria-hidden', 'true');

  // "See" and the item list share one box so the prefix sits centered above the list; the prefix
  // is absolutely positioned inside it, so it never shifts the (screen-centered) list.
  const leadEl = document.createElement('div');
  leadEl.className = 'hero-video-lead';
  leadEl.append(prefixEl, itemListEl);

  selectorEl.append(leadEl, suffixEl);

  // ── Bottom controls (sound toggle only — mode toggling lives in a sibling block) ──
  const controlsEl = document.createElement('div');
  controlsEl.className = 'hero-video-controls';

  const soundBtn = document.createElement('button');
  soundBtn.className = 'hero-video-sound';
  soundBtn.type = 'button';
  soundBtn.setAttribute('aria-label', 'Unmute video');
  soundBtn.setAttribute('aria-pressed', 'false');

  controlsEl.append(soundBtn);

  const cursorEl = document.createElement('div');
  cursorEl.className = 'hero-video-cursor';
  cursorEl.setAttribute('aria-hidden', 'true');

  // Mode toggle lives inside hero-video so soft-nav can preserve it across swaps while the media
  // reloads. It is appended last but positioned as an overlay by CSS.
  const { toggleWrapper, destLink, expLink } = buildToggle(config);

  fragment.append(mediaEl, overlayEl, introPhraseEl, selectorEl, controlsEl, cursorEl, toggleWrapper);

  return {
    root: fragment,
    mediaEl,
    posterEl,
    videoA,
    videoB,
    overlayEl,
    introPhraseEl,
    phrasePrefixEl,
    phraseSuffixEl,
    prefixEl,
    suffixEl,
    itemListEl,
    controlsEl,
    soundBtn,
    cursorEl,
    destLink,
    expLink,
  };
}

function shouldSkipIntro(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  if (document.documentElement.classList.contains('adobe-ue-edit')) return true;
  if (window.self !== window.top) return true; // inside iframe (UE)
  return false;
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const rows = [...block.children] as HTMLElement[];
  if (rows.length < 2) return;

  // Config fields render as single-cell rows; items render as multi-cell rows (one cell per item
  // field). Splitting by cell count keeps config parsing correct even when legacy content omits
  // the later-added destination/experience rows and shifts positions.
  const configRows = rows.filter((row) => row.children.length <= 1);
  const itemRows = rows.filter((row) => row.children.length > 1);

  const config = parseConfig(configRows);
  const items = parseItems(itemRows);
  if (items.length === 0) return;

  const state: HeroVideoState = {
    activeIndex: 0,
    introComplete: false,
    muted: true,
  };

  const dom = buildDOM(config);
  block.replaceChildren(dom.root);
  // Videos are always muted — the sound/unmute control is intentionally removed.
  dom.soundBtn.hidden = true;

  // Soft-nav toggle: wire mode switching on the toggle links now that they're in the DOM.
  initSoftNav([dom.destLink, dom.expLink]);

  const cursor = new CursorController(block, dom.cursorEl);
  cursor.mount();

  const media = new MediaManager(dom.videoA, dom.videoB, dom.posterEl);
  media.setTransition(config.transition);
  media.setErrorHandler((item, errorType) => emitMediaError(item.label, item.videoUrl, errorType));

  // Readiness gate: soft-nav awaits this before revealing hero-video on a mode swap so the fade-in
  // coincides with the video crossfade. Resolves on the first decoded frame, or a fallback timeout
  // so blocked autoplay never stalls the transition.
  let resolveFirstFrame: () => void = () => {};
  (block as HeroVideoElement).__heroFirstFrameReady = new Promise<void>((resolve) => {
    resolveFirstFrame = resolve;
  });
  media.setFirstFrameHandler(() => resolveFirstFrame());
  window.setTimeout(() => resolveFirstFrame(), 1500);

  // Load first item — deferred until the block is attached to a *live, rendered* document.
  // `Node.isConnected` only means "rooted in some Document", which is true even for a block
  // still living inside mode-toggle soft-nav's `DOMParser().parseFromString()` scratch document
  // (that document is never inserted into the browsing context). Starting video playback there
  // makes Chrome's media pipeline reject the load outright with a permanent
  // "MEDIA_ELEMENT_ERROR: Media load rejected by URL safety check" — the video never recovers
  // once it's later grafted into the real page. A Document only gets a `defaultView` once it's
  // associated with a browsing context, so checking that (in addition to isConnected) reliably
  // tells apart the scratch document from the real one.
  const isLiveConnected = (node: Element): boolean => node.isConnected && node.ownerDocument.defaultView !== null;
  const firstItem = items[state.activeIndex];
  if (firstItem) {
    const startFirstLoad = (): void => {
      media.switchTo(firstItem).catch(() => {});
      // Self-healing "auto-click": on soft-nav mounts play() sometimes succeeds silently (no
      // rejection logged) but the crossfade leaves the video paused/invisible. Re-check shortly
      // after mount settles and force it visible+playing, same effect as a manual click.
      setTimeout(() => media.ensureActivePlaying(), 500);
    };
    const scheduleStart = (): void => {
      // Two-stage defer: microtask (queueMicrotask) + macrotask (setTimeout 0). Microtask lets
      // any outgoing MutationObserver callback fire first, macrotask lets any load-abort settle.
      queueMicrotask(() => setTimeout(startFirstLoad, 0));
    };
    if (isLiveConnected(block)) {
      scheduleStart();
    } else {
      const waitForAttach = (): void => {
        if (isLiveConnected(block)) scheduleStart();
        else requestAnimationFrame(waitForAttach);
      };
      requestAnimationFrame(waitForAttach);
    }
  }

  const selectorUI = new SelectorUI(dom.itemListEl);
  selectorUI.renderItems(items, state.activeIndex);

  // Recalculate row offsets after fonts load and on resize
  if (document.fonts) {
    document.fonts.ready.then(() => selectorUI.measureRows());
  } else {
    selectorUI.measureRows();
  }

  const ro = new ResizeObserver(() => {
    selectorUI.measureRows();
    // Re-snap the list transform to the current active item once real dimensions become
    // available. Critical for the soft-nav skipIntro path, where decorate() runs on a detached
    // block and the first measureRows() returns zero — leaving item 0 highlighted but the list
    // untranslated (so it looks like a middle item is centered instead of the first).
    if (state.introComplete) selectorUI.positionForItem(state.activeIndex);
  });
  ro.observe(block);

  // Wire item selection to media switch
  selectorUI.onSelect((index) => {
    const prevItem = items[state.activeIndex];
    state.activeIndex = index;
    const item = items[index];
    if (item) {
      media.switchTo(item).catch(() => {});
      emitItemSelect(prevItem?.label ?? '', item.label, 'pointer');
    }
  });

  const introElements: IntroElements = {
    introPhrase: dom.introPhraseEl,
    phrasePrefix: dom.phrasePrefixEl,
    phraseSuffix: dom.phraseSuffixEl,
    prefix: dom.prefixEl,
    suffix: dom.suffixEl,
    itemList: dom.itemListEl,
    controls: dom.controlsEl,
  };

  const finishWithoutIntro = (): void => {
    skipIntro(introElements);
    selectorUI.measureRows();
    selectorUI.activateItem(state.activeIndex, false);
    selectorUI.setIntroComplete(true);
    state.introComplete = true;
  };

  const startIntro = (): void => {
    // No WAAPI / reduced-motion / UE editor — jump straight to the final state.
    if (typeof Element.prototype.animate !== 'function' || shouldSkipIntro()) {
      finishWithoutIntro();
      return;
    }
    runIntro(
      introElements,
      () => {
        // Position list so active item is centered before split starts
        selectorUI.measureRows();
        selectorUI.positionForItem(state.activeIndex);
      },
      () => {
        // Fade in active item while See/with... are splitting apart
        selectorUI.activateItem(state.activeIndex, true);
      },
    ).then(() => {
      selectorUI.setIntroComplete(true);
      state.introComplete = true;

      // Preload metadata for next item to reduce switching latency
      const nextIdx = (state.activeIndex + 1) % items.length;
      const nextItem = items[nextIdx];
      if (nextItem) {
        const preloadVid = document.createElement('video');
        preloadVid.preload = 'metadata';
        preloadVid.src = nextItem.videoUrl;
      }
    });
  };

  // Defer the intro until the block is live-connected. On a mode-toggle soft-nav this block is
  // decorated while still detached in a DOMParser scratch document, so waiting until it's grafted
  // into the real page replays the full landing intro at reveal time — in sync with the video
  // crossfade, matching the initial page load. On initial load the block is already connected, so
  // this runs synchronously with no flash.
  if (isLiveConnected(block)) {
    startIntro();
  } else {
    const waitForAttachIntro = (): void => {
      if (isLiveConnected(block)) startIntro();
      else requestAnimationFrame(waitForAttachIntro);
    };
    requestAnimationFrame(waitForAttachIntro);
  }

  // Sound toggle removed — videos stay permanently muted.

  // Impression: emit after block is visible for > 2s
  const impressionTimer = setTimeout(() => {
    const item = items[state.activeIndex];
    emitHeroImpression(block.id || 'hero-video', item?.label ?? '');
  }, 2000);

  // Pause/resume on visibility. Threshold 0 (only pause when the block is entirely out of the
  // viewport) instead of a partial threshold — during soft-nav mount the block briefly reports a
  // reduced intersection ratio while its scale/opacity transition runs, which would spuriously
  // pause the fresh video before it gets a chance to be seen. Additionally, gate the very first
  // pause with `hasBeenVisible` so the initial IntersectionObserver callback (fired right after
  // observe() while the block is still being laid out post-adoption) can't stop the video.
  let hasBeenVisible = false;
  const observer = new IntersectionObserver(
    (entries) => {
      const [entry] = entries;
      if (!entry) return;
      if (entry.isIntersecting) {
        hasBeenVisible = true;
        media.resume();
      } else if (hasBeenVisible) {
        media.pause();
      }
    },
    { threshold: 0 },
  );
  observer.observe(block);

  const visibilityChangeHandler = (): void => {
    if (document.hidden) {
      media.pause();
    } else {
      media.resume();
    }
  };
  document.addEventListener('visibilitychange', visibilityChangeHandler);

  // Cleanup on disconnect
  const disconnectObserver = new MutationObserver(() => {
    if (!block.isConnected) {
      clearTimeout(impressionTimer);
      cursor.destroy();
      selectorUI.destroy();
      media.destroy();
      observer.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      disconnectObserver.disconnect();
    }
  });
  // Must observe with `subtree: true` on a node that's never itself replaced (document.body).
  // Mode-toggle's soft-nav swaps whole `.section` subtrees via `main.replaceChildren(...)`, which
  // only emits a childList mutation on `main` — observing `block.parentElement` directly (one or
  // two levels below the swapped section) would never see that mutation and cleanup would leak
  // (old video never paused/released, IntersectionObserver/visibilitychange listeners pile up).
  disconnectObserver.observe(document.body, { childList: true, subtree: true });
}
