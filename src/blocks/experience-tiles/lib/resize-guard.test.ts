// src/blocks/experience-tiles/lib/resize-guard.test.ts
import { suppressTransitionsDuringResize } from './resize-guard';

// The guard measures the track, so every fixture needs one plus a stubbed rect: jsdom reports zeros.
function fixture(width = 1440) {
  const block = document.createElement('div');
  const track = document.createElement('ul');
  track.className = 'experience-tiles-track';
  block.append(track);
  const size = { width, height: 900 };
  track.getBoundingClientRect = () =>
    ({ ...size, top: 0, bottom: 0, left: 0, right: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return {
    block,
    resize(next: Partial<typeof size>) {
      Object.assign(size, next);
      window.dispatchEvent(new Event('resize'));
    },
  };
}

describe('suppressTransitionsDuringResize', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds the class while resizing and removes it once resizing settles', () => {
    jest.useFakeTimers();
    const { block, resize } = fixture();
    suppressTransitionsDuringResize(block);

    resize({ width: 1200 });
    expect(block.classList.contains('experience-tiles-resizing')).toBe(true);

    jest.advanceTimersByTime(150);
    expect(block.classList.contains('experience-tiles-resizing')).toBe(false);
  });

  it('keeps the class present across repeated resize events until they stop', () => {
    jest.useFakeTimers();
    const { block, resize } = fixture();
    suppressTransitionsDuringResize(block);

    resize({ width: 1200 });
    jest.advanceTimersByTime(100);
    resize({ width: 1100 });
    jest.advanceTimersByTime(100);
    expect(block.classList.contains('experience-tiles-resizing')).toBe(true);

    jest.advanceTimersByTime(50);
    expect(block.classList.contains('experience-tiles-resizing')).toBe(false);
  });

  it('supports a custom class name', () => {
    jest.useFakeTimers();
    const { block, resize } = fixture();
    suppressTransitionsDuringResize(block, { className: 'custom-class' });

    resize({ width: 1200 });
    expect(block.classList.contains('custom-class')).toBe(true);
  });

  it('notifies the controller after suppressing transitions, and resumes only after the final resize', () => {
    jest.useFakeTimers();
    const { block, resize } = fixture();
    const onStart = jest.fn(() => expect(block.classList.contains('experience-tiles-resizing')).toBe(true));
    const onEnd = jest.fn(() => expect(block.classList.contains('experience-tiles-resizing')).toBe(false));
    const cleanup = suppressTransitionsDuringResize(block, { onStart, onEnd });
    resize({ width: 1200 });
    jest.advanceTimersByTime(100);
    resize({ width: 1100 });
    jest.advanceTimersByTime(149);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('removes its listener, pending callback and suppression class on cleanup', () => {
    jest.useFakeTimers();
    const { block, resize } = fixture();
    const onEnd = jest.fn();
    const cleanup = suppressTransitionsDuringResize(block, { onEnd });
    resize({ width: 1200 });
    cleanup();
    resize({ width: 1100 });
    jest.advanceTimersByTime(200);
    expect(onEnd).not.toHaveBeenCalled();
    expect(block.classList.contains('experience-tiles-resizing')).toBe(false);
  });

  it('ignores a window resize that only changed the dynamic viewport height', () => {
    jest.useFakeTimers();
    const { block, resize } = fixture();
    const onStart = jest.fn();
    const cleanup = suppressTransitionsDuringResize(block, { onStart });

    // a mobile URL bar collapsing fires `resize` with the same width — it must not cancel the gesture
    resize({ height: 800 });
    expect(onStart).not.toHaveBeenCalled();

    resize({ width: 834 });
    expect(onStart).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('ignores dynamic-viewport height changes and reacts to width changes', () => {
    jest.useFakeTimers();
    let notify = (): void => {};
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    } as unknown as typeof ResizeObserver;

    const block = document.createElement('div');
    const track = document.createElement('ul');
    track.className = 'experience-tiles-track';
    block.append(track);
    let size = { width: 1440, height: 900 };
    track.getBoundingClientRect = () => ({ ...size, top: 0, bottom: 0, left: 0, right: 0, x: 0, y: 0, toJSON() {} });
    const onStart = jest.fn();
    const cleanup = suppressTransitionsDuringResize(block, { onStart });

    // the mobile URL bar collapsing only changes 100dvh, never the breakpoint
    size = { width: 1440, height: 840 };
    notify();
    expect(onStart).not.toHaveBeenCalled();

    size = { width: 834, height: 840 };
    notify();
    expect(onStart).toHaveBeenCalledTimes(1);

    cleanup();
    globalThis.ResizeObserver = original;
  });
});
