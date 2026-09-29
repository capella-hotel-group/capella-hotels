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
    suppressTransitionsDuringResize(block, 'custom-class');

    window.dispatchEvent(new Event('resize'));
    expect(block.classList.contains('custom-class')).toBe(true);
  });
});
