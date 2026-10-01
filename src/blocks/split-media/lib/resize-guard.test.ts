// src/blocks/split-media/lib/resize-guard.test.ts
import { suppressTransitionsDuringResize } from './resize-guard';

describe('suppressTransitionsDuringResize', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('adds the class while resizing and removes it once resizing settles', () => {
    jest.useFakeTimers();
    const block = document.createElement('div');
    suppressTransitionsDuringResize(block);

    window.dispatchEvent(new Event('resize'));
    expect(block.classList.contains('split-media-resizing')).toBe(true);

    jest.advanceTimersByTime(150);
    expect(block.classList.contains('split-media-resizing')).toBe(false);
  });

  it('keeps the class present across repeated resize events until they stop', () => {
    jest.useFakeTimers();
    const block = document.createElement('div');
    suppressTransitionsDuringResize(block);

    window.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(100);
    window.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(100);
    expect(block.classList.contains('split-media-resizing')).toBe(true);

    jest.advanceTimersByTime(50);
    expect(block.classList.contains('split-media-resizing')).toBe(false);
  });

  it('supports a custom class name', () => {
    jest.useFakeTimers();
    const block = document.createElement('div');
    suppressTransitionsDuringResize(block, { className: 'custom-class' });

    window.dispatchEvent(new Event('resize'));
    expect(block.classList.contains('custom-class')).toBe(true);
  });

  it('notifies the controller after suppressing transitions, and resumes only after the final resize', () => {
    jest.useFakeTimers();
    const block = document.createElement('div');
    const onStart = jest.fn(() => expect(block.classList.contains('split-media-resizing')).toBe(true));
    const onEnd = jest.fn(() => expect(block.classList.contains('split-media-resizing')).toBe(false));
    const cleanup = suppressTransitionsDuringResize(block, { onStart, onEnd });
    window.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(100);
    window.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(149);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('removes its listener, pending callback and suppression class on cleanup', () => {
    jest.useFakeTimers();
    const block = document.createElement('div');
    const onEnd = jest.fn();
    const cleanup = suppressTransitionsDuringResize(block, { onEnd });
    window.dispatchEvent(new Event('resize'));
    cleanup();
    window.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(200);
    expect(onEnd).not.toHaveBeenCalled();
    expect(block.classList.contains('split-media-resizing')).toBe(false);
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
    track.className = 'split-media-track';
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
