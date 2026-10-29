// src/blocks/hero-video/lib/wheel-picker.ts
// Momentum wheel-picker engine: owns a looping scroll position (in row "slots") and turns
// drag / wheel / programmatic input into motion that always settles exactly on one slot.

export type PickerInputSource = 'pointer' | 'touch' | 'keyboard';

export interface WheelPickerHost {
  render(pos: number): void;
  rowHeight(): number;
  /** Called once per gesture, when motion has come to rest on `slot`; `source` is null for programmatic moves. */
  settle(slot: number, source: PickerInputSource | null): void;
}

export interface WheelPickerOptions {
  /** Loop period in slots (item count). */
  period: number;
  /** First slot of the canonical (middle) cycle; position is kept within [origin, origin + period). */
  origin: number;
  reducedMotion?: boolean;
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
  now?: () => number;
}

export const STEP_MS = 585;
const SNAP_MS = 495;
const TAP_SLOP_MOUSE = 4;
const TAP_SLOP_TOUCH = 10;
const VELOCITY_WINDOW_MS = 100;
const RELEASE_STALE_MS = 50;
const MAX_VELOCITY = 0.06; // slots per ms
const MIN_FLING_VELOCITY = 0.0005;
const MOMENTUM_TAU_MS = 325;
const MOMENTUM_MIN_MS = 520;
const MOMENTUM_MAX_MS = 2080;
const WHEEL_IDLE_MS = 150;
const NOTCH_MIN_DELTA = 50;
// Rows that may be visible on either side of center (371px mask / 44px smallest row, plus margin).
const HALF_VISIBLE_ROWS = 6;

type Easing = (t: number) => number;
const easeInOutCubic: Easing = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutQuint: Easing = (t) => 1 - (1 - t) ** 5;
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export function cycleLayout(count: number): { cycles: number; origin: number } {
  if (count < 2) return { cycles: 1, origin: 0 };
  const side = Math.ceil((HALF_VISIBLE_ROWS + 1) / count);
  return { cycles: side * 2 + 1, origin: side * count };
}

export function isNotchedWheel(e: Pick<WheelEvent, 'deltaMode' | 'deltaY'>): boolean {
  return e.deltaMode !== 0 || (Math.abs(e.deltaY) >= NOTCH_MIN_DELTA && Number.isInteger(e.deltaY));
}

interface Tween {
  from: number;
  to: number;
  start: number;
  duration: number;
  source: PickerInputSource | null;
  easing: Easing;
}

interface Drag {
  id: number;
  source: PickerInputSource;
  slop: number;
  startY: number;
  startPos: number;
  active: boolean;
  caughtMotion: boolean;
  samples: Array<{ t: number; y: number }>;
}

export class WheelPicker {
  private viewport: HTMLElement;
  private host: WheelPickerHost;
  private period: number;
  private origin: number;
  private reducedMotion: boolean;
  private raf: (cb: FrameRequestCallback) => number;
  private caf: (id: number) => void;
  private now: () => number;

  private pos = 0;
  private tween: Tween | null = null;
  private drag: Drag | null = null;
  private rafId = 0;
  private wheelTimer = 0;
  private enabled = false;
  private suppressClick = false;

  constructor(viewport: HTMLElement, host: WheelPickerHost, options: WheelPickerOptions) {
    this.viewport = viewport;
    this.host = host;
    this.period = options.period;
    this.origin = options.origin;
    this.reducedMotion = options.reducedMotion ?? false;
    this.raf = options.raf ?? ((cb) => window.requestAnimationFrame(cb));
    this.caf = options.caf ?? ((id) => window.cancelAnimationFrame(id));
    this.now = options.now ?? (() => performance.now());

    viewport.addEventListener('pointerdown', this.onPointerDown);
    viewport.addEventListener('pointermove', this.onPointerMove);
    viewport.addEventListener('pointerup', this.onPointerUp);
    viewport.addEventListener('pointercancel', this.onPointerCancel);
    viewport.addEventListener('wheel', this.onWheel, { passive: false });
    viewport.addEventListener('click', this.onClickCapture, true);
  }

  enable(): void {
    this.enabled = true;
  }

  getPosition(): number {
    return this.pos;
  }

  /** Jump without animating or settling (layout / intro positioning). */
  setPosition(pos: number): void {
    this.stop();
    this.pos = pos;
    this.normalize();
    this.host.render(this.pos);
  }

  /** Slot showing logical item `index` that is closest to the current position. */
  nearestSlot(index: number): number {
    const base = this.origin + index;
    return base + Math.round((this.pos - base) / this.period) * this.period;
  }

  isUserInteracting(): boolean {
    return this.drag !== null || this.wheelTimer !== 0 || (this.tween !== null && this.tween.source !== null);
  }

  scrollTo(target: number, duration: number, source: PickerInputSource | null, easing: Easing = easeInOutCubic): void {
    this.stop();
    if (duration <= 0 || this.reducedMotion || target === this.pos) {
      this.pos = target;
      this.finish(source);
      return;
    }
    this.tween = { from: this.pos, to: target, start: this.now(), duration, source, easing };
    this.rafId = this.raf(this.frame);
  }

  /** Move `delta` items from the current target (consecutive steps accumulate). Returns the target slot. */
  stepBy(delta: number, source: PickerInputSource | null): number {
    const base = this.tween ? this.tween.to : Math.round(this.pos);
    const target = base + delta;
    this.scrollTo(target, STEP_MS, source);
    return target;
  }

  destroy(): void {
    this.stop();
    this.enabled = false;
    this.viewport.removeEventListener('pointerdown', this.onPointerDown);
    this.viewport.removeEventListener('pointermove', this.onPointerMove);
    this.viewport.removeEventListener('pointerup', this.onPointerUp);
    this.viewport.removeEventListener('pointercancel', this.onPointerCancel);
    this.viewport.removeEventListener('wheel', this.onWheel);
    this.viewport.removeEventListener('click', this.onClickCapture, true);
  }

  private stop(): void {
    if (this.rafId) this.caf(this.rafId);
    this.rafId = 0;
    this.tween = null;
    if (this.wheelTimer) window.clearTimeout(this.wheelTimer);
    this.wheelTimer = 0;
  }

  private finish(source: PickerInputSource | null): void {
    this.pos = Math.round(this.pos);
    this.normalize();
    this.host.render(this.pos);
    this.host.settle(this.pos, source);
  }

  private frame = (): void => {
    this.rafId = 0;
    const t = this.tween;
    if (!t) return;
    const progress = Math.min(1, (this.now() - t.start) / t.duration);
    this.pos = progress >= 1 ? t.to : t.from + (t.to - t.from) * t.easing(progress);
    if (progress >= 1) {
      this.tween = null;
      this.finish(t.source);
      return;
    }
    this.normalize();
    this.host.render(this.pos);
    this.rafId = this.raf(this.frame);
  };

  /** Shift every stored position by whole periods so `pos` stays inside the rendered middle cycle. */
  private normalize(): void {
    if (this.period < 2) return;
    let shift = 0;
    while (this.pos + shift < this.origin) shift += this.period;
    while (this.pos + shift >= this.origin + this.period) shift -= this.period;
    if (shift === 0) return;
    this.pos += shift;
    if (this.tween) {
      this.tween.from += shift;
      this.tween.to += shift;
    }
    if (this.drag) this.drag.startPos += shift;
  }

  private fling(velocity: number, source: PickerInputSource): void {
    const v = clamp(velocity, -MAX_VELOCITY, MAX_VELOCITY);
    const snap = Math.round(this.pos);
    if (Math.abs(v) < MIN_FLING_VELOCITY) {
      this.scrollTo(snap, SNAP_MS, source);
      return;
    }
    const target = Math.round(this.pos + v * MOMENTUM_TAU_MS);
    const distance = target - this.pos;
    if (distance === 0 || Math.sign(distance) !== Math.sign(v)) {
      this.scrollTo(snap, SNAP_MS, source);
      return;
    }
    // Ease-out quint starts at 5·d/T, so this T continues the release velocity seamlessly.
    const duration = clamp((5 * Math.abs(distance)) / Math.abs(v), MOMENTUM_MIN_MS, MOMENTUM_MAX_MS);
    this.scrollTo(target, duration, source, easeOutQuint);
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.enabled || this.drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const caughtMotion = this.tween !== null || this.wheelTimer !== 0;
    this.stop();
    const isMouse = e.pointerType === 'mouse';
    this.drag = {
      id: e.pointerId,
      source: e.pointerType === 'touch' ? 'touch' : 'pointer',
      slop: isMouse ? TAP_SLOP_MOUSE : TAP_SLOP_TOUCH,
      startY: e.clientY,
      startPos: this.pos,
      active: false,
      caughtMotion,
      samples: [{ t: this.now(), y: e.clientY }],
    };
  };

  private onPointerMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.active) {
      if (Math.abs(e.clientY - d.startY) < d.slop) return;
      d.active = true;
      d.startY = e.clientY;
      d.startPos = this.pos;
      this.viewport.setPointerCapture?.(e.pointerId);
      this.viewport.classList.add('hero-video-items-viewport--dragging');
    }
    this.pos = d.startPos - (e.clientY - d.startY) / this.host.rowHeight();
    this.normalize();
    this.host.render(this.pos);
    const t = this.now();
    d.samples.push({ t, y: e.clientY });
    while (d.samples.length > 2 && t - (d.samples[0]?.t ?? t) > VELOCITY_WINDOW_MS) d.samples.shift();
  };

  private onPointerUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.endDrag(d);
    if (d.active) {
      this.blockNextClick();
      this.fling(this.releaseVelocity(d, e.clientY), d.source);
    } else if (d.caughtMotion) {
      // Touching a moving wheel only stops it (as on iOS); it must not also select the tapped row.
      this.blockNextClick();
      this.scrollTo(Math.round(this.pos), SNAP_MS, d.source);
    }
  };

  private onPointerCancel = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.endDrag(d);
    if (d.active || d.caughtMotion) this.scrollTo(Math.round(this.pos), SNAP_MS, d.source);
  };

  private endDrag(d: Drag): void {
    this.drag = null;
    if (d.active) {
      this.viewport.classList.remove('hero-video-items-viewport--dragging');
      if (this.viewport.hasPointerCapture?.(d.id)) this.viewport.releasePointerCapture(d.id);
    }
  }

  private releaseVelocity(d: Drag, y: number): number {
    const t = this.now();
    const last = d.samples[d.samples.length - 1];
    if (!last || t - last.t > RELEASE_STALE_MS) return 0;
    d.samples.push({ t, y });
    const first = d.samples.find((s) => t - s.t <= VELOCITY_WINDOW_MS) ?? d.samples[0];
    if (!first || t === first.t) return 0;
    return -(y - first.y) / (t - first.t) / this.host.rowHeight();
  }

  private blockNextClick(): void {
    this.suppressClick = true;
    window.setTimeout(() => {
      this.suppressClick = false;
    }, 0);
  }

  private onClickCapture = (e: MouseEvent): void => {
    if (!this.suppressClick) return;
    this.suppressClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.enabled || e.ctrlKey || this.drag) return;
    if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();

    if (isNotchedWheel(e)) {
      this.stepBy(Math.sign(e.deltaY), 'pointer');
      return;
    }

    // Trackpad: the OS already applies inertia, so follow its deltas and snap once they stop.
    if (this.tween) this.stop();
    this.pos += e.deltaY / this.host.rowHeight();
    this.normalize();
    this.host.render(this.pos);
    if (this.wheelTimer) window.clearTimeout(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => {
      this.wheelTimer = 0;
      this.scrollTo(Math.round(this.pos), SNAP_MS, 'pointer');
    }, WHEEL_IDLE_MS);
  };
}
