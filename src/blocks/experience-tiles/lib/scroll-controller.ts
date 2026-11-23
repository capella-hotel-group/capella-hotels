import type { CarouselController, Direction, StepResult } from './carousel-controller';
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
/*
 * Continuous input. A burst is swallowed after it has done something (entered, stepped) so momentum
 * cannot skip slides — but a hand that keeps scrolling must keep the slides moving.
 *
 * INTENT_WINDOW_MS  wheel speed (per ms and per event) of the latest window of this length is compared
 * INTENT_HISTORY_MS with the window just before it (>= INTENT_RATIO) and with the first window of this
 *                   longer history (>= INTENT_TREND). Momentum always loses speed and keeps losing it; a
 *                   hand — trackpad or a mouse wheel turned notch after notch — holds it. Speed over
 *                   windows, never single deltas or runs of equal ones: Chrome coalesces frames (one
 *                   event carries two frames of travel) and quantises deltas, so a slow momentum tail
 *                   repeats a value for a while and only the longer trend still shows it decaying.
 *                   lower ratios: momentum reads as a hand and flings the block out — raise: a hand
 *                   that slows a little stops stepping.
 * INTENT_MIN_SPEED  px/ms below which the stream is a momentum tail whatever its shape.
 * REARM_MIN_MS      shortest gap between two actions of one burst, for when nothing is animating
 *                   (reduced motion); otherwise the panel animation already spaces them.
 * TOUCH_STEP        finger travel that steps the slides while the finger is still down.
 * TOUCH_CONTINUE    further travel in the same drag that asks for the next step (queued if needed).
 */
const INTENT_WINDOW_MS = 150;
const INTENT_HISTORY_MS = 600;
const INTENT_RATIO = 0.94;
const INTENT_TREND = 0.95;
const INTENT_MIN_SPEED = 0.15;
const REARM_MIN_MS = 600;
const TOUCH_STEP = 40;
const TOUCH_CONTINUE = 160;
// How long after a finger lifts the browser may still be running its own fling.
const TOUCH_MOMENTUM_MS = 3000;
interface Entry {
  block: HTMLElement;
  carousel: CarouselController;
  cancelGesture: () => void;
  visited: boolean;
  lastTop?: number;
  // Side of the alignment point the block was last seen on, outside the tolerance; 0 once it has been
  // claimed, so leaving a block you used never reads as carrying the page past it.
  side: -1 | 0 | 1;
  // Some of the block has been on screen since it was last fully off it: its slide has been seen.
  seen: boolean;
}
interface WheelBurst {
  time: number;
  total: number;
  consumed: boolean;
  actedAt: number;
  samples: { delta: number; time: number; span: number }[];
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
let lastTouchEnd = -Infinity;
let haltedOverflow: string | undefined;

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
function stepped(result: StepResult): boolean {
  return result === 'changed' || result === 'queued';
}
// While the block is fully off screen and unused, show the slide the reader will meet first, so the
// swap to the edge slide on entry never happens in view.
// Only scroll events record `seen`: the layout a block reports while the page is still being built
// (registration) is not where the reader actually is.
function prime(entry: Entry, scrolled = true): void {
  if (entry.visited || entry.carousel.isBusy || !entry.block.isConnected) return;
  const { top, bottom, height } = entry.block.getBoundingClientRect();
  // A block without layout (hidden, not yet rendered) has no side of the viewport to wait on.
  if (height <= 0) return;
  if (scrolled) entry.seen = top < window.innerHeight && bottom > 0;
  if (top >= window.innerHeight) entry.carousel.select(0);
  else if (bottom <= 0) entry.carousel.select(entry.carousel.count - 1);
}
// The edge slide is picked off screen; a slide the reader has already looked at is never swapped.
function pickEdge(entry: Entry, direction: Direction): void {
  if (!entry.visited && !entry.seen) entry.carousel.select(direction > 0 ? 0 : entry.carousel.count - 1);
}
function copyAt(target: EventTarget | null, entry: Entry): HTMLElement | undefined {
  const copy = target instanceof Element ? target.closest<HTMLElement>('.experience-tiles-overlay--scrollable') : null;
  return copy && entry.block.contains(copy) ? copy : undefined;
}
// Copy left with only a sliver to scroll (a landscape phone can clip a few pixels) must not swallow a
// whole gesture; the sliver stays reachable by keyboard.
const COPY_MIN_TRAVEL = 8;
function canScroll(copy: HTMLElement, delta: number): boolean {
  const remaining = delta > 0 ? copy.scrollHeight - copy.clientHeight - copy.scrollTop : copy.scrollTop;
  return remaining > COPY_MIN_TRAVEL;
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
  entry.side = 0;
}
function enter(entry: Entry, direction: Direction): void {
  // Only a first encounter picks the edge slide; coming back to a block you started keeps your place.
  pickEdge(entry, direction);
  claim(entry);
  align(entry, true);
}
function reset(): void {
  stopScrollAnimation();
  setOwner(undefined);
  burst = undefined;
  entries.forEach((entry) => entry.cancelGesture());
}
// The burst just did something: whatever follows is momentum until the hand proves otherwise.
function act(current: WheelBurst, time: number): void {
  current.consumed = true;
  current.actedAt = time;
  current.samples = [];
}
// Two readings of how fast a window scrolled: per millisecond, and per event. Momentum always shows up
// decaying in at least one of them — per millisecond when Chrome coalesces events (one carries two
// frames of travel), per event when events arrive at an uneven rate — while a hand holds both.
function speedsBetween(samples: WheelBurst['samples'], from: number, to: number): [number, number] {
  let travel = 0;
  let covered = 0;
  let count = 0;
  samples.forEach(({ delta, time, span }) => {
    if (time <= from || time > to) return;
    travel += delta;
    covered += span;
    count += 1;
  });
  return count ? [travel / covered, travel / count] : [0, 0];
}
function intentional(samples: WheelBurst['samples'], now: number): boolean {
  if (!samples.length || now - samples[0]!.time < INTENT_HISTORY_MS - 10) return false;
  const recent = speedsBetween(samples, now - INTENT_WINDOW_MS, now);
  const before = speedsBetween(samples, now - 2 * INTENT_WINDOW_MS, now - INTENT_WINDOW_MS);
  const start = speedsBetween(samples, now - INTENT_HISTORY_MS, now - INTENT_HISTORY_MS + INTENT_WINDOW_MS);
  if (recent[0] < INTENT_MIN_SPEED) return false;
  return [0, 1].every(
    (reading) =>
      before[reading]! > 0 &&
      start[reading]! > 0 &&
      recent[reading]! >= before[reading]! * INTENT_RATIO &&
      recent[reading]! >= start[reading]! * INTENT_TREND,
  );
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
/**
 * A browser touch fling cannot be cancelled from script and would carry the page straight past a block
 * that just caught it. Making the root unscrollable for a frame ends the fling; the scroll position
 * stays where it is.
 */
function haltMomentum(): void {
  if (haltedOverflow !== undefined || performance.now() - lastTouchEnd > TOUCH_MOMENTUM_MS) return;
  const root = document.documentElement;
  haltedOverflow = root.style.overflow;
  root.style.overflow = 'hidden';
  const restore = (): void => {
    if (haltedOverflow === undefined) return;
    root.style.overflow = haltedOverflow;
    haltedOverflow = undefined;
  };
  requestAnimationFrame(() => requestAnimationFrame(restore));
  setTimeout(restore, 50);
}
function crossed(): Entry | undefined {
  let hit: Entry | undefined;
  const reach = SNAP_DISTANCE * window.innerHeight;
  entries.forEach((entry) => {
    const { top } = entry.block.getBoundingClientRect();
    entry.lastTop = top;
    // A sample can land inside the tolerance on the way through, so compare sides, not neighbours.
    const side = top > ALIGN_TOLERANCE ? 1 : top < -ALIGN_TOLERANCE ? -1 : 0;
    const previous = entry.side;
    if (side !== 0) entry.side = side;
    if (hit || side === 0 || previous === 0 || side === previous || Math.abs(top) > reach) return;
    hit = entry;
  });
  return hit;
}
// The page is about to move by `delta`: the nearest block whose top would pass the alignment point.
function crossingIn(delta: number, excluded?: Entry): Entry | undefined {
  let hit: Entry | undefined;
  let best = Infinity;
  entries.forEach((entry) => {
    if (entry === excluded || !entry.block.isConnected) return;
    const { top, height } = entry.block.getBoundingClientRect();
    if (height <= 0) return;
    const reaches = delta > 0 ? top > 0 && top - delta <= 0 : top < 0 && top - delta >= 0;
    if (reaches && Math.abs(top) < best) {
      hit = entry;
      best = Math.abs(top);
    }
  });
  return hit;
}
/** A finger carrying the page stops on the block like a detent instead of dragging it past. */
function land(entry: Entry, direction: Direction): void {
  pickEdge(entry, direction);
  claim(entry);
  align(entry);
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
  if (fresh) burst = { time, total: 0, consumed: false, actedAt: time, samples: [] };
  const current = burst!;
  current.time = time;
  const previous = current.samples[current.samples.length - 1];
  // each sample stands for the time since the last one (capped: a pause is not slow scrolling)
  current.samples.push({
    delta: Math.abs(delta),
    time,
    span: previous ? Math.min(50, Math.max(1, time - previous.time)) : 16,
  });
  while (current.samples.length && current.samples[0]!.time <= time - INTENT_HISTORY_MS - 50) current.samples.shift();
  // Chrome keeps animating its fling after preventDefault; re-settle rather than hand the page back mid-gesture.
  if (owner && !aligned(owner) && !settling()) {
    if (current.consumed) align(owner, true);
    else setOwner(undefined);
  }
  // A hand still scrolling once the block is ready again takes the next step (or leaves at the edge).
  if (
    current.consumed &&
    owner &&
    aligned(owner) &&
    !settling() &&
    !owner.carousel.isBusy &&
    time - current.actedAt >= (reducedMotion() ? REARM_MIN_MS : 0) &&
    intentional(current.samples, time)
  ) {
    current.consumed = false;
    current.total = 0;
    current.samples = [];
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
        act(current, time);
      }
      return;
    }
    claim(found);
    entry = found;
  }
  if (current.released === entry) return;
  // A fresh gesture during a slide animation is kept as the next step; resizing still drops input.
  const animating = entry.carousel.isAnimating;
  if (settling() || current.consumed || (entry.carousel.isBusy && !animating)) {
    event.preventDefault();
    current.consumed = true;
    return;
  }
  if (!animating && (fresh || current.total === 0)) {
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
  act(current, time);
}
function attach(): void {
  if (listeners) return;
  listeners = new AbortController();
  const { signal } = listeners;
  window.addEventListener('wheel', onWheel, { passive: false, signal });
  window.addEventListener(
    'scroll',
    () => {
      entries.forEach((entry) => prime(entry));
      if (owner && !aligned(owner) && !wheeling() && !settling() && !flinging()) {
        owner.cancelGesture();
        setOwner(undefined);
      }
      const slipped = crossed();
      if (!slipped || owner || settling() || (wheeling() && burst?.released === slipped) || suspended()) return;
      haltMomentum();
      enter(slipped, (slipped.lastTop ?? 0) < 0 ? 1 : -1);
      // The rest of this burst is momentum that carried the page past; it must not also step slides.
      if (burst) act(burst, performance.now());
    },
    { passive: true, signal },
  );
  window.addEventListener(
    'touchend',
    () => {
      lastTouchEnd = performance.now();
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
  beginResize: () => void;
  resize: () => void;
  snap: () => void;
  isAligned: () => boolean;
} {
  if (carousel.count < 2 || block.closest('.adobe-ue-edit'))
    return { cleanup() {}, cancel() {}, beginResize() {}, resize() {}, snap() {}, isAligned: () => true };
  const initialTop = block.getBoundingClientRect().top;
  const entry: Entry = {
    block,
    carousel,
    cancelGesture: () => {},
    visited: false,
    lastTop: initialTop,
    side: initialTop > ALIGN_TOLERANCE ? 1 : initialTop < -ALIGN_TOLERANCE ? -1 : 0,
    seen: false,
  };
  let gesture: 'slide' | 'copy' | 'entry' | 'page' | 'held' | undefined;
  let copy: HTMLElement | undefined;
  let exited: Entry | undefined;
  let touching = false;
  // Finger travel since the last step of this drag, and whether the drag has stepped yet.
  let travel = 0;
  let fired = false;
  // A drag steps the slides as it goes; out of slides, it carries the page on instead of stalling.
  const drive = (delta: number): void => {
    travel += delta;
    if (Math.abs(travel) < (fired ? TOUCH_CONTINUE : TOUCH_STEP)) return;
    const direction: Direction = travel > 0 ? 1 : -1;
    travel = 0;
    if (suspended() || !aligned(entry)) return;
    const result = carousel.requestStep(direction);
    if (stepped(result)) {
      fired = true;
      return;
    }
    if (result !== 'edge' || !touching) return;
    setOwner(undefined);
    exited = entry;
    stopScrollAnimation();
    gesture = 'page';
  };
  const binding = bindGestures(block, {
    begin(target, direction, touch) {
      gesture = undefined;
      copy = undefined;
      exited = undefined;
      touching = touch;
      travel = 0;
      fired = false;
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
      if (gesture === 'slide' || gesture === 'entry') {
        drive(delta);
        return;
      }
      if (gesture !== 'page') return;
      const caught = crossingIn(delta, exited);
      if (caught && !suspended()) {
        land(caught, delta > 0 ? 1 : -1);
        // The rest of this touch is spent; the next swipe steps the slides.
        gesture = 'held';
        return;
      }
      scrollPage(delta);
    },
    end(direction, velocity) {
      const current = gesture;
      gesture = undefined;
      copy = undefined;
      if (current === 'page') {
        fling(velocity, exited);
        return false;
      }
      // The drag already stepped while the finger was down; the lift only has to swallow the tap.
      if ((current === 'slide' || current === 'entry') && fired) return true;
      return (
        (current === 'slide' || current === 'entry') &&
        direction !== null &&
        !suspended() &&
        aligned(entry) &&
        stepped(carousel.requestStep(direction))
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
  prime(entry, false);
  attach();
  // A rotation reflows the page and fires scroll events that drop ownership before the resize settles;
  // remember whether the reader was in the block so it can be lined back up afterwards.
  let pinned = false;
  return {
    cancel: binding.cancel,
    beginResize() {
      binding.cancel();
      pinned = pinned || owner === entry;
    },
    resize() {
      binding.cancel();
      const realign = pinned || owner === entry;
      pinned = false;
      if (!realign || suspended()) return;
      claim(entry);
      align(entry);
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
        lastTouchEnd = -Infinity;
        modalObserver?.disconnect();
        modalObserver = undefined;
      }
    },
  };
}
