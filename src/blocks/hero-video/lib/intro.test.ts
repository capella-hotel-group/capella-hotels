// src/blocks/hero-video/lib/intro.test.ts
import { runIntro, shouldSkipIntro, skipIntro } from './intro';
import type { IntroElements } from './types';

function mockMatchMedia(matches: boolean): void {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

function buildElements(): IntroElements {
  return {
    introPhrase: document.createElement('div'),
    phrasePrefix: document.createElement('span'),
    phraseSuffix: document.createElement('span'),
    prefix: document.createElement('div'),
    suffix: document.createElement('div'),
    itemList: document.createElement('ul'),
    controls: document.createElement('div'),
  };
}

describe('shouldSkipIntro', () => {
  afterEach(() => {
    document.documentElement.classList.remove('adobe-ue-edit');
    jest.restoreAllMocks();
  });

  it('returns false when no skip condition applies', () => {
    mockMatchMedia(false);
    expect(shouldSkipIntro()).toBe(false);
  });

  it('returns true when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    expect(shouldSkipIntro()).toBe(true);
  });

  it('returns true in Universal Editor edit mode', () => {
    mockMatchMedia(false);
    document.documentElement.classList.add('adobe-ue-edit');
    expect(shouldSkipIntro()).toBe(true);
  });

  it('returns true when running inside an iframe', () => {
    mockMatchMedia(false);
    // `window.top` is non-configurable in jsdom, so fake the inequality via `self` instead.
    jest.spyOn(window, 'self', 'get').mockReturnValue({} as Window & typeof globalThis);
    expect(shouldSkipIntro()).toBe(true);
  });
});

describe('skipIntro', () => {
  it('jumps straight to the final resting state', () => {
    const elements = buildElements();
    elements.itemList.inert = true;

    skipIntro(elements);

    expect(elements.introPhrase.style.opacity).toBe('0');
    expect(elements.introPhrase.style.display).toBe('none');
    expect(elements.prefix.style.opacity).toBe('0');
    expect(elements.suffix.style.opacity).toBe('1');
    expect(elements.itemList.style.opacity).toBe('1');
    expect(elements.itemList.inert).toBe(false);
    expect(elements.controls.style.opacity).toBe('1');
  });
});

describe('runIntro', () => {
  let animateMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    animateMock = jest.fn().mockReturnValue({
      finished: Promise.resolve(),
      cancel: jest.fn(),
    });
    // jsdom does not implement the Web Animations API used by the real intro.
    Element.prototype.animate = animateMock;
    Element.prototype.getBoundingClientRect = jest
      .fn()
      .mockReturnValue({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 } as DOMRect);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('keeps the item list out of the tab order until the split settles, then restores it', async () => {
    const elements = buildElements();
    const order: string[] = [];

    const onBeforeSplit = jest.fn(() => {
      order.push('onBeforeSplit');
      return 42;
    });
    const onSplitStart = jest.fn(() => order.push('onSplitStart'));

    const introPromise = runIntro(elements, onBeforeSplit, onSplitStart);
    expect(elements.itemList.inert).toBe(true);

    await jest.runAllTimersAsync();
    await introPromise;

    expect(order).toEqual(['onBeforeSplit', 'onSplitStart']);
    expect(elements.itemList.inert).toBe(false);
  });

  it('uses the value returned by onBeforeSplit as the list rest position', async () => {
    const elements = buildElements();
    const onBeforeSplit = jest.fn(() => 42);

    const introPromise = runIntro(elements, onBeforeSplit);
    await jest.runAllTimersAsync();
    await introPromise;

    expect(elements.itemList.style.transform).toBe('translateY(42px)');
  });

  it('defaults the rest position to 0 when onBeforeSplit is omitted', async () => {
    const elements = buildElements();

    const introPromise = runIntro(elements);
    await jest.runAllTimersAsync();
    await introPromise;

    expect(elements.itemList.style.transform).toBe('translateY(0px)');
  });
});
