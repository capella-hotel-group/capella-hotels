import type { CarouselController, Direction } from './carousel-controller';
import { bindGestures } from './gesture';

/*
 * Tuning knobs. Each line: what it decides — lower it — raise it. Every value is either a ratio or a
 * duration, so one set covers mobile, tablet and desktop; nothing here is a per-breakpoint pixel size.
 *
 * ALIGN_TOLERANCE   px of slop that still counts as aligned. Subpixel rounding, browser zoom and a
 *                   fractional 100dvh (iOS reports e.g. 745.5) mean `top` is never exactly 0.
 *                   lower: ownership drops right after snapping — raise: visibly off the edge.
 * WHEEL_THRESHOLD   px of wheel accumulated before one slide step. A mouse notch is 120px, a trackpad
 *                   a few px per event, so they accumulate. Desktop only; touch uses the drag path.
 *                   lower: trigger-happy, easy to overshoot — raise: needs a deliberate flick.
 * WHEEL_IDLE_MS     silence that ends a burst. Within a burst, input after a step is swallowed, the
 *                   scroll listener keeps ownership, and a boundary will not release the page. Must
 *                   outlast the gaps in macOS trackpad inertia or one swipe would skip slides.
 *                   lower: inertia leaks through and skips slides — raise: slower to let go.
 * SETTLE_MIN/MAX_MS bounds of the ease-out that lands the block on the viewport top; between them the
 * SETTLE_MS_PER_PX  duration is travel x SETTLE_MS_PER_PX, so the settle never starts faster than a
 *                   trackpad scroll. The x3 fallback timer covers background tabs freezing frames.
 *                   lower: abrupt snap — raise: sluggish, user can out-scroll it.
 * FLING_DECAY       per-16ms survival of the touch momentum the block runs itself, because the track
 *                   suppresses native panning and there is no browser fling to inherit.
 *                   lower: stops dead on release — raise: glides far past the intended slide.
 * FLING_MIN_SPEED   px/ms at which that momentum is considered spent.
 * SNAP_DISTANCE     how far from the alignment point the block may be and still be claimed, as a
 *                   share of the viewport, while still travelling towards it. Never compare against
 *                   wheel delta: trackpad deltas are a few px and the block slips past.
 *                   lower: user can park the block near the top and nothing ever snaps — raise:
 *                   grabs the page early, long involuntary jump.
 *                   0.35 claims a 100dvh block from 35% off the top, i.e. once ~65% of it is visible.
 *                   A block carried across the alignment point between two events is caught too.
 */
const ALIGN_TOLERANCE = 3;
const WHEEL_THRESHOLD = 40;
const WHEEL_IDLE_MS = 200;
const SETTLE_MIN_MS = 360;
const SETTLE_MAX_MS = 720;
const SETTLE_MS_PER_PX = 2;
const FLING_DECAY = 0.95;
const FLING_MIN_SPEED = 0.02;
export const SNAP_DISTANCE = 0.35;
interface Entry {
  block: HTMLElement;
  carousel: CarouselController;
  cancelGesture: () => void;
  visited: boolean;
  lastTop?: number;
}
interface WheelBurst {
  time: number;
  total: number;
  consumed: boolean;
  copy?: HTMLElement;
  released?: Entry;
}
const entries = new Set<Entry>();
let owner: Entry | undefined;
let burst: WheelBurst | undefined;
let listeners: AbortController | undefined;
let modalObserver: MutationObserver | undefined;
let settleFrame: number | undefined;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let flingFrame: number | undefined;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function suspended(): boolean {
  return (
    document.hidden ||
    Boolean(
      document.querySelector(
        '.adobe-ue-edit, dialog[open], .header-menu-panel.is-open, [aria-modal="true"]:not([hidden]):not([aria-hidden="true"])',
      ),
    ) ||
    document.body.style.overflow === 'hidden'
  );
}
function aligned(entry: Entry): boolean {
  return Math.abs(entry.block.getBoundingClientRect().top) <= ALIGN_TOLERANCE;
}
function edge(entry: Entry, direction: Direction): boolean {
  return (
    !entry.carousel.isBusy &&
    (direction < 0 ? entry.carousel.index === 0 : entry.carousel.index === entry.carousel.count - 1)
  );
}
function copyAt(target: EventTarget | null, entry: Entry): HTMLElement | undefined {
  const copy = target instanceof Element ? target.closest<HTMLElement>('.experience-tiles-overlay--scrollable') : null;
  return copy && entry.block.contains(copy) ? copy : undefined;
}
function canScroll(copy: HTMLElement, delta: number): boolean {
  return delta > 0 ? copy.scrollTop < copy.scrollHeight - copy.clientHeight - 1 : copy.scrollTop > 1;
}
function scrollCopy(copy: HTMLElement, delta: number): void {
  copy.scrollTop = Math.max(0, Math.min(copy.scrollHeight - copy.clientHeight, copy.scrollTop + delta));
}
function scrollPage(delta: number): void {
  window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
}
function stopScrollAnimation(): void {
  if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
  if (flingFrame !== undefined) cancelAnimationFrame(flingFrame);
  if (settleTimer !== undefined) clearTimeout(settleTimer);
  settleFrame = undefined;
  flingFrame = undefined;
  settleTimer = undefined;
  syncWatch();
}
function settling(): boolean {
  return settleFrame !== undefined;
}
function flinging(): boolean {
  return flingFrame !== undefined;
}
function syncWatch(): void {
  const needed = Boolean(owner) || settling() || flinging();
  if (needed && !modalObserver) {
    // Menus can open without a subsequent wheel event; release on their DOM update.
    modalObserver = new MutationObserver(() => {
      if (suspended()) reset();
    });
    modalObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'open', 'style', 'aria-modal', 'aria-hidden', 'hidden'],
    });
  } else if (!needed && modalObserver) {
    modalObserver.disconnect();
    modalObserver = undefined;
  }
}
function setOwner(entry: Entry | undefined): void {
  owner = entry;
  syncWatch();
}
function align(entry: Entry, animate = false): void {
  stopScrollAnimation();
  const start = window.scrollY;
  const distance = entry.block.getBoundingClientRect().top;
  const jump = (top: number): void => window.scrollTo({ top, behavior: 'instant' });
  if (!animate || Math.abs(distance) <= ALIGN_TOLERANCE || reducedMotion()) {
    jump(start + distance);
    return;
  }
  // Scale with the travel so the settle starts no faster than the reader was scrolling.
  const duration = Math.min(SETTLE_MAX_MS, Math.max(SETTLE_MIN_MS, Math.abs(distance) * SETTLE_MS_PER_PX));
  const begin = performance.now();
  const step = (now: number): void => {
    const progress = Math.min((now - begin) / duration, 1);
    jump(start + distance * (1 - (1 - progress) ** 3));
    if (progress < 1) {
      settleFrame = requestAnimationFrame(step);
      syncWatch();
      return;
    }
    stopScrollAnimation();
  };
  settleFrame = requestAnimationFrame(step);
  // Background tabs freeze animation frames; without this the block would stay stuck mid-settle.
  settleTimer = setTimeout(() => {
    stopScrollAnimation();
    jump(window.scrollY + entry.block.getBoundingClientRect().top);
  }, duration * 3);
}
function claim(entry: Entry): void {
  setOwner(entry);
  entry.visited = true;
}
function enter(entry: Entry, direction: Direction): void {
  // Only a first encounter picks the edge slide; coming back to a block you started keeps your place.
  if (!entry.visited) entry.carousel.select(direction > 0 ? 0 : entry.carousel.count - 1);
  claim(entry);
  align(entry, true);
}
function reset(): void {
  stopScrollAnimation();
  setOwner(undefined);
  burst = undefined;
  entries.forEach((entry) => entry.cancelGesture());
}
function wheeling(): boolean {
  return Boolean(burst && performance.now() - burst.time < WHEEL_IDLE_MS);
}
function candidate(delta: number, excluded?: Entry): Entry | undefined {
  let best: Entry | undefined;
  let bestDistance = Infinity;
  const viewport = window.innerHeight;
  entries.forEach((entry) => {
    if (entry === excluded || !entry.block.isConnected) return;
    const rect = entry.block.getBoundingClientRect();
    if (rect.height <= 0 || viewport <= 0) return;
    // Claim the block once it is close enough to the alignment point, never by wheel delta: trackpads
    // emit a few pixels at a time and the block would slip past. Direction keeps a block we left from
    // grabbing back.
    const approaching = delta > 0 ? rect.top > 0 : rect.top < 0;
    const reachable =
      Math.abs(rect.top) <= ALIGN_TOLERANCE || (approaching && Math.abs(rect.top) <= SNAP_DISTANCE * viewport);
    if (!reachable || Math.abs(rect.top) >= bestDistance) return;
    best = entry;
    bestDistance = Math.abs(rect.top);
  });
  return best;
}
// A fast wheel notch or native momentum can carry a block across the alignment point between two events.
function crossed(): Entry | undefined {
  let hit: Entry | undefined;
  const reach = SNAP_DISTANCE * window.innerHeight;
  entries.forEach((entry) => {
    const { top } = entry.block.getBoundingClientRect();
    const previous = entry.lastTop;
    entry.lastTop = top;
    if (hit || previous === undefined || Math.abs(top) > reach) return;
    const down = previous > ALIGN_TOLERANCE && top < -ALIGN_TOLERANCE;
    const up = previous < -ALIGN_TOLERANCE && top > ALIGN_TOLERANCE;
    if (down || up) hit = entry;
  });
  return hit;
}
/**
 * Touch release. The track suppresses native panning, so there is no browser fling to inherit: the
 * block runs the momentum and checks for a snap target on every frame of it.
 */
function fling(velocity: number, excluded?: Entry): void {
  stopScrollAnimation();
  const snap = (direction: Direction): boolean => {
    const entry = candidate(direction, excluded);
    if (!entry || aligned(entry)) return false;
    enter(entry, direction);
    return true;
  };
  let speed = velocity;
  if (reducedMotion() || Math.abs(speed) < FLING_MIN_SPEED) {
    snap(speed < 0 ? -1 : 1);
    return;
  }
  let last = performance.now();
  const step = (now: number): void => {
    const elapsed = Math.max(1, now - last);
    last = now;
    speed *= FLING_DECAY ** (elapsed / 16);
    scrollPage(speed * elapsed);
    // enter() restarts the animation as a settle, so this frame must not queue another fling frame.
    if (snap(speed < 0 ? -1 : 1)) return;
    if (Math.abs(speed) < FLING_MIN_SPEED) {
      stopScrollAnimation();
      return;
    }
    flingFrame = requestAnimationFrame(step);
  };
  flingFrame = requestAnimationFrame(step);
  syncWatch();
}
function onWheel(event: WheelEvent): void {
  if (flinging()) stopScrollAnimation();
  if (event.defaultPrevented || !event.cancelable || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
    return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
  if (owner && !owner.block.isConnected) setOwner(undefined);
  // Most wheel input happens far from any block: settle that before touching the DOM.
  if (!owner && !candidate(delta, wheeling() ? burst?.released : undefined)) return;
  if (suspended()) {
    reset();
    return;
  }
  const direction: Direction = delta > 0 ? 1 : -1;
  const time = performance.now();
  const fresh = !burst || time - burst.time >= WHEEL_IDLE_MS;
  if (fresh) burst = { time, total: 0, consumed: false };
  const current = burst!;
  current.time = time;
  // Chrome keeps animating its fling after preventDefault; re-settle rather than hand the page back mid-gesture.
  if (owner && !aligned(owner) && !settling()) {
    if (current.consumed) align(owner, true);
    else setOwner(undefined);
  }
  let entry = owner;
  if (!entry) {
    const found = candidate(delta, current.released);
    if (!found) return;
    if (!aligned(found)) {
      event.preventDefault();
      // One alignment per gesture: a scroll that cannot settle must not keep re-selecting the edge slide.
      if (!current.consumed) {
        enter(found, direction);
        current.consumed = true;
      }
      return;
    }
    claim(found);
    entry = found;
  }
  if (current.released === entry) return;
  if (settling() || current.consumed || entry.carousel.isBusy) {
    event.preventDefault();
    current.consumed = true;
    return;
  }
  if (fresh || current.total === 0) {
    const copy = copyAt(event.target, entry);
    if (copy && canScroll(copy, delta)) current.copy = copy;
  }
  if (current.copy) {
    event.preventDefault();
    scrollCopy(current.copy, delta);
    return;
  }
  if (edge(entry, direction)) {
    current.released = entry;
    setOwner(undefined);
    return;
  }
  event.preventDefault();
  if (Math.sign(current.total) !== Math.sign(delta)) current.total = 0;
  current.total += delta;
  if (Math.abs(current.total) < WHEEL_THRESHOLD) return;
  entry.carousel.requestStep(direction);
  current.consumed = true;
}
function attach(): void {
  if (listeners) return;
  listeners = new AbortController();
  const { signal } = listeners;
  window.addEventListener('wheel', onWheel, { passive: false, signal });
  window.addEventListener(
    'scroll',
    () => {
      if (owner && !aligned(owner) && !wheeling() && !settling() && !flinging()) {
        owner.cancelGesture();
        setOwner(undefined);
      }
      const slipped = crossed();
      if (!slipped || owner || settling() || (wheeling() && burst?.released === slipped) || suspended()) return;
      enter(slipped, (slipped.lastTop ?? 0) < 0 ? 1 : -1);
      // The rest of this burst is momentum that carried the page past; it must not also step slides.
      if (burst) burst.consumed = true;
    },
    { passive: true, signal },
  );
  window.addEventListener('blur', reset, { signal });
  document.addEventListener('visibilitychange', reset, { signal });
}

/** Shared wheel ownership; per-block gestures feed the same finite carousel controller. */
export function registerScrollController(
  block: HTMLElement,
  carousel: CarouselController,
): {
  cleanup: () => void;
  cancel: () => void;
  resize: () => void;
  snap: () => void;
  isAligned: () => boolean;
} {
  if (carousel.count < 2 || block.closest('.adobe-ue-edit'))
    return { cleanup() {}, cancel() {}, resize() {}, snap() {}, isAligned: () => true };
  const entry: Entry = {
    block,
    carousel,
    cancelGesture: () => {},
    visited: false,
    lastTop: block.getBoundingClientRect().top,
  };
  let gesture: 'slide' | 'copy' | 'entry' | 'page' | undefined;
  let copy: HTMLElement | undefined;
  let exited: Entry | undefined;
  const binding = bindGestures(block, {
    begin(target, direction, touch) {
      gesture = undefined;
      copy = undefined;
      exited = undefined;
      if (suspended()) return false;
      const blocked = Boolean(owner && owner !== entry && aligned(owner));
      if (!blocked && aligned(entry)) {
        claim(entry);
        if (carousel.isBusy) {
          gesture = 'entry';
          return true;
        }
        copy = copyAt(target, entry);
        if (copy && canScroll(copy, direction)) {
          gesture = 'copy';
          return true;
        }
        if (!edge(entry, direction)) {
          gesture = 'slide';
          return true;
        }
        setOwner(undefined);
        exited = entry;
      }
      // Nothing inside the block can consume this swipe, and the track suppresses native panning, so
      // the block has to carry the page itself — otherwise the gesture would simply do nothing.
      if (!touch) return false;
      stopScrollAnimation();
      gesture = 'page';
      return true;
    },
    move(delta) {
      if (gesture === 'copy' && copy) scrollCopy(copy, delta);
      if (gesture === 'page') scrollPage(delta);
    },
    end(direction, velocity) {
      const current = gesture;
      gesture = undefined;
      copy = undefined;
      if (current === 'page') {
        fling(velocity, exited);
        return false;
      }
      return (
        current === 'slide' &&
        direction !== null &&
        !suspended() &&
        aligned(entry) &&
        carousel.requestStep(direction) === 'changed'
      );
    },
    cancel() {
      gesture = undefined;
      copy = undefined;
      exited = undefined;
    },
  });
  entry.cancelGesture = binding.cancel;
  entries.add(entry);
  attach();
  return {
    cancel: binding.cancel,
    resize() {
      binding.cancel();
      if (owner === entry && !suspended()) align(entry);
    },
    snap() {
      if (suspended()) return;
      claim(entry);
      align(entry, true);
    },
    isAligned: () => aligned(entry),
    cleanup() {
      binding.cleanup();
      entries.delete(entry);
      if (owner === entry) {
        stopScrollAnimation();
        setOwner(undefined);
      }
      if (burst?.released === entry || !entries.size) burst = undefined;
      if (!entries.size) {
        stopScrollAnimation();
        listeners?.abort();
        listeners = undefined;
        modalObserver?.disconnect();
        modalObserver = undefined;
      }
    },
  };
}
