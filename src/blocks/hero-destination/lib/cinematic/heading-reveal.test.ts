const mockMoveInstrumentation = jest.fn();
jest.mock('@/app/scripts.js', () => ({
  moveInstrumentation: (...args: unknown[]) => mockMoveInstrumentation(...args),
}));

import { buildHeading, scheduleHeadingReveal } from './heading-reveal';
import { deferred } from './timing';

describe('buildHeading', () => {
  it('wraps the text in a masked span and moves UE instrumentation', () => {
    const cell = document.createElement('div');
    cell.innerHTML = '<p data-aue-prop="heading">Kyoto</p>';
    const heading = buildHeading('Kyoto', cell);
    expect(heading.tagName).toBe('H2');
    expect(heading.className).toBe('hero-destination-video-heading');
    expect(heading.querySelector('.hero-destination-video-heading-text')?.textContent).toBe('Kyoto');
    expect(mockMoveInstrumentation).toHaveBeenCalledWith(cell.querySelector('p'), heading);
  });
});

describe('scheduleHeadingReveal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup(delayMs = 1500) {
    const heading = buildHeading('Kyoto', null);
    const expanded = deferred();
    const playing = deferred();
    const failed = deferred();
    scheduleHeadingReveal(heading, {
      expanded: expanded.promise,
      playing: playing.promise,
      failed: failed.promise,
      delayMs,
    });
    const revealed = () => heading.classList.contains('is-revealed');
    return { expanded, playing, failed, revealed };
  }

  it('reveals delayMs after playback starts, once expanded', async () => {
    const t = setup();
    t.expanded.resolve();
    t.playing.resolve();
    await jest.advanceTimersByTimeAsync(1499);
    expect(t.revealed()).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(t.revealed()).toBe(true);
  });

  it('waits for expansion even when the delay has already elapsed', async () => {
    const t = setup(100);
    t.playing.resolve();
    await jest.advanceTimersByTimeAsync(500);
    expect(t.revealed()).toBe(false);
    t.expanded.resolve();
    await jest.advanceTimersByTimeAsync(0);
    expect(t.revealed()).toBe(true);
  });

  it('reveals delayMs after expansion when playback fails', async () => {
    const t = setup();
    t.failed.resolve();
    await jest.advanceTimersByTimeAsync(3000);
    expect(t.revealed()).toBe(false);
    t.expanded.resolve();
    await jest.advanceTimersByTimeAsync(1500);
    expect(t.revealed()).toBe(true);
  });
});
