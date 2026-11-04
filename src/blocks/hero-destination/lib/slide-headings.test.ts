import { createHeadingSequencer } from './slide-headings';

describe('createHeadingSequencer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const headings = (count: number): HTMLElement[] => Array.from({ length: count }, () => document.createElement('h2'));
  const revealed = (el: HTMLElement): boolean => el.classList.contains('is-revealed');
  const video = (): { element: HTMLVideoElement; failed: Promise<void> } => {
    const element = document.createElement('video');
    Object.defineProperty(element, 'paused', { configurable: true, value: true });
    return { element, failed: new Promise<void>(() => {}) };
  };

  it('reveals an image slide heading after 750ms', async () => {
    const [heading] = headings(1);
    createHeadingSequencer({
      headings: [heading],
      playbacks: [undefined],
      instant: false,
      gate: Promise.resolve(),
    }).activate(0);
    await jest.advanceTimersByTimeAsync(749);
    expect(revealed(heading)).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(revealed(heading)).toBe(true);
  });

  it('reveals a video slide heading 1500ms after the video starts playing', async () => {
    const [heading] = headings(1);
    const playback = video();
    createHeadingSequencer({
      headings: [heading],
      playbacks: [playback],
      instant: false,
      gate: Promise.resolve(),
    }).activate(0);
    await jest.advanceTimersByTimeAsync(3000);
    expect(revealed(heading)).toBe(false);
    playback.element.dispatchEvent(new Event('playing'));
    await jest.advanceTimersByTimeAsync(1500);
    expect(revealed(heading)).toBe(true);
  });

  it('reveals a video slide heading immediately when the video fails', async () => {
    const [heading] = headings(1);
    let fail = (): void => {};
    const failed = new Promise<void>((resolve) => {
      fail = resolve;
    });
    const playback = { ...video(), failed };
    createHeadingSequencer({
      headings: [heading],
      playbacks: [playback],
      instant: false,
      gate: Promise.resolve(),
    }).activate(0);
    await jest.advanceTimersByTimeAsync(1000);
    expect(revealed(heading)).toBe(false);
    fail();
    await jest.advanceTimersByTimeAsync(0);
    expect(revealed(heading)).toBe(true);
  });

  it('reveals a video slide heading at the 6000ms cap without the extra delay', async () => {
    const [heading] = headings(1);
    createHeadingSequencer({
      headings: [heading],
      playbacks: [video()],
      instant: false,
      gate: Promise.resolve(),
    }).activate(0);
    await jest.advanceTimersByTimeAsync(5999);
    expect(revealed(heading)).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(revealed(heading)).toBe(true);
  });

  it('waits for the gate', async () => {
    const [heading] = headings(1);
    let open = (): void => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    createHeadingSequencer({ headings: [heading], playbacks: [undefined], instant: false, gate }).activate(0);
    await jest.advanceTimersByTimeAsync(5000);
    expect(revealed(heading)).toBe(false);
    open();
    await jest.advanceTimersByTimeAsync(0);
    expect(revealed(heading)).toBe(true);
  });

  it('hides the previous heading and drops a stale reveal', async () => {
    const [first, second] = headings(2);
    const sequencer = createHeadingSequencer({
      headings: [first, second],
      playbacks: [undefined, undefined],
      instant: false,
      gate: Promise.resolve(),
    });
    sequencer.activate(0);
    await jest.advanceTimersByTimeAsync(750);
    sequencer.activate(1);
    expect(revealed(first)).toBe(false);
    sequencer.activate(0);
    await jest.advanceTimersByTimeAsync(750);
    expect(revealed(second)).toBe(false);
    expect(revealed(first)).toBe(true);
  });

  it('reveals immediately in instant mode', () => {
    const [heading] = headings(1);
    createHeadingSequencer({
      headings: [heading],
      playbacks: [video()],
      instant: true,
      gate: new Promise(() => {}),
    }).activate(0);
    expect(revealed(heading)).toBe(true);
  });
});
