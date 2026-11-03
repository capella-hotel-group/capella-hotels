import { createVideoPlayback } from './video-playback';

describe('createVideoPlayback', () => {
  let mqMatches: boolean;
  let mqListener: (() => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    mqMatches = false;
    mqListener = undefined;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      get matches() {
        return mqMatches;
      },
      addEventListener: (_type: string, cb: () => void) => {
        mqListener = cb;
      },
      removeEventListener: jest.fn(),
    }));
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.load = jest.fn();
  });

  afterEach(() => jest.useRealTimers());

  const create = (overrides = {}) =>
    createVideoPlayback({ desktopUrl: '/d.mp4', mobileUrl: '/m.mp4', loop: true, ...overrides });
  const flag = (promise: Promise<unknown>) => {
    const state = { done: false };
    promise.then(() => {
      state.done = true;
    });
    return state;
  };

  it('builds a muted, inline, decorative video with the desktop source', () => {
    const { element } = create({ posterUrl: '/p.jpg' });
    expect(element.muted).toBe(true);
    expect(element.hasAttribute('playsinline')).toBe(true);
    expect(element.loop).toBe(true);
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.getAttribute('poster')).toBe('/p.jpg');
    expect(element.querySelector('source')?.getAttribute('src')).toBe('/d.mp4');
  });

  it('uses the mobile source below 768px', () => {
    mqMatches = true;
    expect(create().element.querySelector('source')?.getAttribute('src')).toBe('/m.mp4');
  });

  it('becomes ready on canplay and is not failed by the later timeout', async () => {
    const playback = create();
    const failed = flag(playback.failed);
    playback.element.dispatchEvent(new Event('canplay'));
    await expect(playback.ready).resolves.toBe(true);
    expect(playback.isReady()).toBe(true);
    await jest.advanceTimersByTimeAsync(6000);
    expect(failed.done).toBe(false);
  });

  it('fails after 5s without data, and stays failed if data arrives later', async () => {
    const playback = create();
    const failed = flag(playback.failed);
    await jest.advanceTimersByTimeAsync(4999);
    expect(failed.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(failed.done).toBe(true);
    await expect(playback.ready).resolves.toBe(false);
    playback.element.dispatchEvent(new Event('canplay'));
    expect(playback.isReady()).toBe(false);
    playback.play();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('fails on a media error', async () => {
    const playback = create();
    playback.element.dispatchEvent(new Event('error'));
    await expect(playback.ready).resolves.toBe(false);
  });

  it('fails when play() is rejected', async () => {
    HTMLMediaElement.prototype.play = jest.fn().mockRejectedValue(new Error('NotAllowed'));
    const playback = create();
    const failed = flag(playback.failed);
    playback.element.dispatchEvent(new Event('canplay'));
    playback.play();
    await jest.advanceTimersByTimeAsync(0);
    expect(failed.done).toBe(true);
  });

  it('resolves playing on the playing event', async () => {
    const playback = create();
    const playing = flag(playback.playing);
    playback.element.dispatchEvent(new Event('playing'));
    await jest.advanceTimersByTimeAsync(0);
    expect(playing.done).toBe(true);
  });

  it('swaps the source when crossing the breakpoint', () => {
    const { element } = create();
    mqMatches = true;
    mqListener?.();
    expect(element.querySelector('source')?.getAttribute('src')).toBe('/m.mp4');
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    mqListener?.();
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  });

  it('resets readiness for a new source before playback settles', async () => {
    const playback = create({ timeoutMs: 1000 });
    playback.element.dispatchEvent(new Event('canplay'));
    expect(playback.isReady()).toBe(true);
    const desktopReady = playback.ready;

    mqMatches = true;
    mqListener?.();

    expect(playback.isReady()).toBe(false);
    expect(playback.ready).not.toBe(desktopReady);
    const mobileReady = playback.ready;
    playback.element.dispatchEvent(new Event('canplay'));
    await expect(mobileReady).resolves.toBe(true);
    expect(playback.isReady()).toBe(true);
  });

  it('restarts the readiness timeout for the selected source', async () => {
    const playback = create({ timeoutMs: 1000 });
    const failed = flag(playback.failed);
    await jest.advanceTimersByTimeAsync(800);

    mqMatches = true;
    mqListener?.();
    await jest.advanceTimersByTimeAsync(800);
    expect(failed.done).toBe(false);

    await jest.advanceTimersByTimeAsync(200);
    expect(failed.done).toBe(true);
    await expect(playback.ready).resolves.toBe(false);
    expect(playback.isReady()).toBe(false);
  });

  it('loads and resumes a new source after playback has already started', () => {
    const playback = create();
    playback.element.dispatchEvent(new Event('canplay'));
    playback.play();
    playback.element.dispatchEvent(new Event('playing'));
    Object.defineProperty(playback.element, 'paused', { configurable: true, value: false });

    mqMatches = true;
    mqListener?.();

    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
  });
});
