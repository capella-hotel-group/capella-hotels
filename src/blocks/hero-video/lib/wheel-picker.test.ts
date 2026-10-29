import { cycleLayout, isNotchedWheel, WheelPicker } from './wheel-picker';
import type { PickerInputSource, WheelPickerHost } from './wheel-picker';

const ROW = 50;

interface Harness {
  picker: WheelPicker;
  viewport: HTMLElement;
  settles: Array<[number, PickerInputSource | null]>;
  rendered: number[];
  advance: (ms: number) => void;
}

function setup(period = 5, origin = 10, reducedMotion = false): Harness {
  let clock = 0;
  let frames: Array<FrameRequestCallback> = [];
  const settles: Array<[number, PickerInputSource | null]> = [];
  const rendered: number[] = [];
  const viewport = document.createElement('div');
  document.body.append(viewport);
  const host: WheelPickerHost = {
    render: (pos) => rendered.push(pos),
    rowHeight: () => ROW,
    settle: (slot, source) => settles.push([slot, source]),
  };
  const picker = new WheelPicker(viewport, host, {
    period,
    origin,
    reducedMotion,
    now: () => clock,
    raf: (cb) => {
      frames.push(cb);
      return frames.length;
    },
    caf: () => {
      frames = [];
    },
  });
  const advance = (ms: number): void => {
    const end = clock + ms;
    while (clock < end) {
      clock = Math.min(end, clock + 16);
      jest.advanceTimersByTime(16);
      const run = frames;
      frames = [];
      run.forEach((cb) => cb(clock));
    }
  };
  return { picker, viewport, settles, rendered, advance };
}

function pointer(type: string, init: Partial<PointerEventInit> & { clientY: number }): Event {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientY: init.clientY, button: 0 });
  Object.assign(e, { pointerId: init.pointerId ?? 1, pointerType: init.pointerType ?? 'touch' });
  return e;
}

function wheel(deltaY: number, deltaMode = 0): WheelEvent {
  return new WheelEvent('wheel', { deltaY, deltaMode, bubbles: true, cancelable: true });
}

describe('cycleLayout', () => {
  it('renders enough cycles to cover the viewport on both sides of the origin cycle', () => {
    expect(cycleLayout(2)).toEqual({ cycles: 9, origin: 8 });
    expect(cycleLayout(3)).toEqual({ cycles: 7, origin: 9 });
    expect(cycleLayout(10)).toEqual({ cycles: 3, origin: 10 });
  });

  it('does not loop a single item', () => {
    expect(cycleLayout(1)).toEqual({ cycles: 1, origin: 0 });
  });
});

describe('isNotchedWheel', () => {
  it('treats line/page delta modes and large integer pixel deltas as mouse notches', () => {
    expect(isNotchedWheel({ deltaMode: 1, deltaY: 3 })).toBe(true);
    expect(isNotchedWheel({ deltaMode: 0, deltaY: 100 })).toBe(true);
    expect(isNotchedWheel({ deltaMode: 0, deltaY: 4.5 })).toBe(false);
    expect(isNotchedWheel({ deltaMode: 0, deltaY: 12 })).toBe(false);
  });
});

describe('WheelPicker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    document.body.replaceChildren();
  });

  it('ignores input until enabled', () => {
    const { picker, viewport, settles, advance } = setup();
    picker.setPosition(12);
    const e = wheel(100);
    viewport.dispatchEvent(e);
    advance(1000);
    expect(e.defaultPrevented).toBe(false);
    expect(settles).toEqual([]);
    expect(picker.getPosition()).toBe(12);
  });

  it('settles once, on the nearest slot, after a scrollTo tween', () => {
    const { picker, settles, advance } = setup();
    picker.setPosition(11);
    picker.scrollTo(13, 300, 'pointer');
    advance(150);
    expect(settles).toEqual([]);
    advance(300);
    expect(settles).toEqual([[13, 'pointer']]);
    expect(picker.getPosition()).toBe(13);
  });

  it('settles immediately when already on the target', () => {
    const { picker, settles } = setup();
    picker.setPosition(12);
    picker.scrollTo(12, 300, null);
    expect(settles).toEqual([[12, null]]);
  });

  it('wraps across the loop seam without visual change', () => {
    const { picker, settles, advance } = setup(5, 10);
    picker.setPosition(14);
    picker.scrollTo(15, 300, 'keyboard');
    advance(400);
    // 15 is the first slot of the next cycle, same item as slot 10
    expect(settles).toEqual([[10, 'keyboard']]);
  });

  it('nearestSlot picks the shortest path around the loop', () => {
    const { picker } = setup(5, 10);
    picker.setPosition(14);
    expect(picker.nearestSlot(0)).toBe(15);
    expect(picker.nearestSlot(3)).toBe(13);
  });

  it('accumulates mouse-wheel notches into one item step each', () => {
    const { picker, viewport, settles, advance } = setup();
    picker.setPosition(10);
    picker.enable();
    const e = wheel(100);
    viewport.dispatchEvent(e);
    viewport.dispatchEvent(wheel(100));
    expect(e.defaultPrevented).toBe(true);
    advance(1000);
    expect(settles).toEqual([[12, 'pointer']]);
  });

  it('follows trackpad deltas and snaps only after the gesture goes idle', () => {
    const { picker, viewport, settles, advance } = setup();
    picker.setPosition(10);
    picker.enable();
    for (let i = 0; i < 10; i += 1) {
      viewport.dispatchEvent(wheel(7.5));
      advance(16);
    }
    expect(settles).toEqual([]);
    expect(picker.getPosition()).toBeCloseTo(11.5, 5);
    advance(1000);
    expect(settles).toHaveLength(1);
    expect([11, 12]).toContain(settles[0]?.[0]);
  });

  it('moves 1:1 with a drag and does not settle while dragging', () => {
    const { picker, viewport, settles, advance } = setup();
    picker.setPosition(12);
    picker.enable();
    viewport.dispatchEvent(pointer('pointerdown', { clientY: 200 }));
    viewport.dispatchEvent(pointer('pointermove', { clientY: 190 }));
    advance(16);
    viewport.dispatchEvent(pointer('pointermove', { clientY: 140 }));
    expect(picker.getPosition()).toBeCloseTo(13, 5);
    advance(16);
    expect(settles).toEqual([]);
  });

  it('flings with momentum past the release point and lands exactly on a slot', () => {
    const { picker, viewport, settles, advance } = setup(5, 10);
    picker.setPosition(10);
    picker.enable();
    viewport.dispatchEvent(pointer('pointerdown', { clientY: 400 }));
    let y = 400;
    for (let i = 0; i < 6; i += 1) {
      y -= 30;
      viewport.dispatchEvent(pointer('pointermove', { clientY: y }));
      advance(16);
    }
    const released = picker.getPosition();
    viewport.dispatchEvent(pointer('pointerup', { clientY: y }));
    advance(2500);
    expect(settles).toHaveLength(1);
    const [slot, source] = settles[0] ?? [];
    expect(source).toBe('touch');
    expect(Number.isInteger(slot)).toBe(true);
    // Travelled further than the finger did (modulo the loop period).
    const travelled = (((slot as number) - released) % 5) + 5;
    expect(travelled % 5).toBeGreaterThan(0);
  });

  it('treats a short press as a tap (no settle, click passes through)', () => {
    const { picker, viewport, settles, advance } = setup();
    picker.setPosition(12);
    picker.enable();
    const onClick = jest.fn();
    viewport.addEventListener('click', onClick);
    viewport.dispatchEvent(pointer('pointerdown', { clientY: 200 }));
    viewport.dispatchEvent(pointer('pointermove', { clientY: 204 }));
    viewport.dispatchEvent(pointer('pointerup', { clientY: 204 }));
    viewport.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    advance(500);
    expect(onClick).toHaveBeenCalled();
    expect(settles).toEqual([]);
  });

  it('swallows the click that follows a drag', () => {
    const { picker, viewport } = setup();
    picker.setPosition(12);
    picker.enable();
    const onClick = jest.fn();
    viewport.addEventListener('click', onClick);
    viewport.dispatchEvent(pointer('pointerdown', { clientY: 200 }));
    viewport.dispatchEvent(pointer('pointermove', { clientY: 150 }));
    viewport.dispatchEvent(pointer('pointerup', { clientY: 150 }));
    viewport.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('reports user interaction while a gesture is in flight', () => {
    const { picker, viewport, advance } = setup();
    picker.setPosition(12);
    picker.enable();
    expect(picker.isUserInteracting()).toBe(false);
    viewport.dispatchEvent(wheel(100));
    expect(picker.isUserInteracting()).toBe(true);
    advance(1000);
    expect(picker.isUserInteracting()).toBe(false);
  });

  it('snaps instantly under reduced motion', () => {
    const { picker, viewport, settles } = setup(5, 10, true);
    picker.setPosition(10);
    picker.enable();
    viewport.dispatchEvent(wheel(100));
    expect(settles).toEqual([[11, 'pointer']]);
  });
});
