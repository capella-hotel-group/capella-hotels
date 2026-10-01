import type { CarouselController, Direction } from './carousel-controller';
import { bindGestures } from './gesture';

const ALIGN_TOLERANCE = 2;
const WHEEL_THRESHOLD = 40;
const WHEEL_IDLE_MS = 200;
const SETTLE_MS = 350;
const SNAP_VISIBILITY = 0.5;
interface Entry {
  block: HTMLElement;
  carousel: CarouselController;
  cancelGesture: () => void;
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
  const copy = target instanceof Element ? target.closest<HTMLElement>('.split-media-overlay') : null;
  return copy && entry.block.contains(copy) && copy.scrollHeight > copy.clientHeight + 1 ? copy : undefined;
}
function canScroll(copy: HTMLElement, delta: number): boolean {
  return delta > 0 ? copy.scrollTop < copy.scrollHeight - copy.clientHeight - 1 : copy.scrollTop > 1;
}
function scrollCopy(copy: HTMLElement, delta: number): void {
  copy.scrollTop = Math.max(0, Math.min(copy.scrollHeight - copy.clientHeight, copy.scrollTop + delta));
}
function stopSettle(): void {
  if (settleFrame !== undefined) cancelAnimationFrame(settleFrame);
  if (settleTimer !== undefined) clearTimeout(settleTimer);
  settleFrame = undefined;
  settleTimer = undefined;
}
function settling(): boolean {
  return settleFrame !== undefined;
}
function align(entry: Entry, animate = false): void {
  stopSettle();
  const start = window.scrollY;
  const distance = entry.block.getBoundingClientRect().top;
  const jump = (top: number): void => window.scrollTo({ top, behavior: 'instant' });
  if (
    !animate ||
    Math.abs(distance) <= ALIGN_TOLERANCE ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    jump(start + distance);
    return;
  }
  const begin = performance.now();
  const step = (now: number): void => {
    const progress = Math.min((now - begin) / SETTLE_MS, 1);
    jump(start + distance * (1 - (1 - progress) ** 3));
    if (progress < 1) {
      settleFrame = requestAnimationFrame(step);
      return;
    }
    stopSettle();
  };
  settleFrame = requestAnimationFrame(step);
  // Background tabs freeze animation frames; without this the block would stay stuck mid-settle.
  settleTimer = setTimeout(() => {
    stopSettle();
    jump(window.scrollY + entry.block.getBoundingClientRect().top);
  }, SETTLE_MS * 3);
}
function enter(entry: Entry, direction: Direction): void {
  entry.carousel.select(direction > 0 ? 0 : entry.carousel.count - 1);
  owner = entry;
  align(entry, true);
}
function reset(): void {
  stopSettle();
  owner = undefined;
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
    // Claim the block once it owns most of the viewport, never by wheel delta: trackpads emit a few
    // pixels at a time and the block would slip past. Direction keeps a block we left from grabbing back.
    const covered = (Math.min(rect.bottom, viewport) - Math.max(rect.top, 0)) / viewport;
    const approaching = delta > 0 ? rect.top > 0 : rect.top < 0;
    const reachable = Math.abs(rect.top) <= ALIGN_TOLERANCE || (approaching && covered >= SNAP_VISIBILITY);
    if (!reachable || Math.abs(rect.top) >= bestDistance) return;
    best = entry;
    bestDistance = Math.abs(rect.top);
  });
  return best;
}
function onWheel(event: WheelEvent): void {
  if (suspended()) {
    reset();
    return;
  }
  if (event.defaultPrevented || !event.cancelable || event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX))
    return;
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
  const direction: Direction = delta > 0 ? 1 : -1;
  const time = performance.now();
  const fresh = !burst || time - burst.time >= WHEEL_IDLE_MS;
  if (fresh) burst = { time, total: 0, consumed: false };
  const current = burst!;
  current.time = time;
  if (owner && !owner.block.isConnected) owner = undefined;
  // Chrome keeps animating its fling after preventDefault; re-settle rather than hand the page back mid-gesture.
  else if (owner && !aligned(owner) && !settling()) {
    if (current.consumed) align(owner, true);
    else owner = undefined;
  }
  if (!owner) {
    const entry = candidate(delta, current.released);
    if (!entry) return;
    if (!aligned(entry)) {
      event.preventDefault();
      // One alignment per gesture: a scroll that cannot settle must not keep re-selecting the edge slide.
      if (!current.consumed) {
        enter(entry, direction);
        current.consumed = true;
      }
      return;
    }
    owner = entry;
  }
  const entry = owner;
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
    owner = undefined;
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
      if (owner && !aligned(owner) && !wheeling() && !settling()) {
        owner.cancelGesture();
        owner = undefined;
      }
    },
    { passive: true, signal },
  );
  window.addEventListener('blur', reset, { signal });
  document.addEventListener('visibilitychange', reset, { signal });
  // Menus can open without a subsequent wheel event. Release immediately on their DOM update.
  modalObserver = new MutationObserver(() => {
    if (suspended()) reset();
  });
  modalObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'open', 'style', 'aria-modal', 'aria-hidden', 'hidden'],
  });
}

/** Shared wheel ownership; per-block gestures feed the same finite carousel controller. */
export function registerScrollController(
  block: HTMLElement,
  carousel: CarouselController,
): {
  cleanup: () => void;
  cancel: () => void;
  resize: () => void;
} {
  if (carousel.count < 2 || block.closest('.adobe-ue-edit')) return { cleanup() {}, cancel() {}, resize() {} };
  const entry: Entry = { block, carousel, cancelGesture: () => {} };
  let gesture: 'slide' | 'copy' | 'approach' | 'entry' | undefined;
  let copy: HTMLElement | undefined;
  const binding = bindGestures(block, {
    begin(target, direction, touch) {
      if (suspended()) return false;
      if (owner && owner !== entry && aligned(owner)) return false;
      gesture = undefined;
      copy = undefined;
      if (!aligned(entry)) {
        const top = block.getBoundingClientRect().top;
        if (!touch || direction * top <= 0) return false;
        gesture = 'approach';
        return true;
      }
      owner = entry;
      if (carousel.isBusy) {
        gesture = 'entry';
        return true;
      }
      copy = copyAt(target, entry);
      if (copy && canScroll(copy, direction)) {
        gesture = 'copy';
        return true;
      }
      if (edge(entry, direction)) {
        owner = undefined;
        return false;
      }
      gesture = 'slide';
      return true;
    },
    move(delta) {
      if (gesture === 'copy' && copy) scrollCopy(copy, delta);
      if (gesture !== 'approach') return;
      const top = block.getBoundingClientRect().top;
      if (Math.abs(top) <= ALIGN_TOLERANCE || (delta > 0 ? top >= 0 && top <= delta : top <= 0 && top >= delta)) {
        enter(entry, delta > 0 ? 1 : -1);
        gesture = 'entry';
      } else window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
    },
    end(direction) {
      const changed =
        gesture === 'slide' &&
        direction !== null &&
        !suspended() &&
        aligned(entry) &&
        carousel.requestStep(direction) === 'changed';
      gesture = undefined;
      copy = undefined;
      return changed;
    },
    cancel() {
      gesture = undefined;
      copy = undefined;
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
    cleanup() {
      binding.cleanup();
      entries.delete(entry);
      if (owner === entry) {
        stopSettle();
        owner = undefined;
      }
      if (burst?.released === entry || !entries.size) burst = undefined;
      if (!entries.size) {
        listeners?.abort();
        listeners = undefined;
        modalObserver?.disconnect();
        modalObserver = undefined;
      }
    },
  };
}
