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

  it('uses the slider video class', () => {
    expect(create().element.className).toBe('hero-destination-video');
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

  it('retries a media error once after a short grace, then fails on a second error', async () => {
    const playback = create();
    const failed = flag(playback.failed);
    playback.element.dispatchEvent(new Event('error'));
    await jest.advanceTimersByTimeAsync(399);
    expect(HTMLMediaElement.prototype.load).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(failed.done).toBe(false);
    playback.element.dispatchEvent(new Event('error'));
    await expect(playback.ready).resolves.toBe(false);
    expect(failed.done).toBe(true);
  });

  it('recovers when the retried load becomes ready', async () => {
    const playback = create();
    const failed = flag(playback.failed);
    playback.element.dispatchEvent(new Event('error'));
    await jest.advanceTimersByTimeAsync(400);
    playback.element.dispatchEvent(new Event('canplay'));
    await expect(playback.ready).resolves.toBe(true);
    expect(failed.done).toBe(false);
  });

  it('resolves firstFrame on the playing event, or after the cap', async () => {
    const playback = create();
    const viaEvent = flag(playback.firstFrame());
    playback.element.dispatchEvent(new Event('playing'));
    await jest.advanceTimersByTimeAsync(0);
    expect(viaEvent.done).toBe(true);

    const capped = flag(create().firstFrame());
    await jest.advanceTimersByTimeAsync(899);
    expect(capped.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(capped.done).toBe(true);
  });

  describe('when the browser refuses play()', () => {
    const gesture = (type = 'pointerdown'): void => {
      window.dispatchEvent(new Event(type));
    };

    // Drain gesture listeners armed by earlier tests so they cannot hit this test's play mock.
    afterEach(() => {
      HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
      gesture();
    });

    it('reports blocked instead of failed', async () => {
      HTMLMediaElement.prototype.play = jest.fn().mockRejectedValue(new Error('NotAllowed'));
      const playback = create();
      const failed = flag(playback.failed);
      const blocked = flag(playback.blocked);
      playback.element.dispatchEvent(new Event('canplay'));
      playback.play();
      await jest.advanceTimersByTimeAsync(0);
      expect(blocked.done).toBe(true);
      expect(playback.isBlocked()).toBe(true);
      expect(failed.done).toBe(false);
    });

    it.each(['pointerdown', 'keydown', 'touchstart', 'wheel'])(
      'retries once on %s and clears blocked',
      async (type) => {
        const play = jest.fn().mockRejectedValueOnce(new Error('NotAllowed')).mockResolvedValue(undefined);
        HTMLMediaElement.prototype.play = play;
        const playback = create();
        playback.play();
        await jest.advanceTimersByTimeAsync(0);
        expect(play).toHaveBeenCalledTimes(1);

        gesture(type);
        await jest.advanceTimersByTimeAsync(0);
        expect(play).toHaveBeenCalledTimes(2);
        expect(playback.isBlocked()).toBe(false);

        gesture(type);
        expect(play).toHaveBeenCalledTimes(2);
      },
    );

    it('re-arms when the gesture retry is refused too', async () => {
      const play = jest
        .fn()
        .mockRejectedValueOnce(new Error('NotAllowed'))
        .mockRejectedValueOnce(new Error('NotAllowed'))
        .mockResolvedValue(undefined);
      HTMLMediaElement.prototype.play = play;
      const playback = create();
      playback.play();
      await jest.advanceTimersByTimeAsync(0);
      gesture();
      await jest.advanceTimersByTimeAsync(0);
      expect(playback.isBlocked()).toBe(true);
      gesture();
      await jest.advanceTimersByTimeAsync(0);
      expect(play).toHaveBeenCalledTimes(3);
      expect(playback.isBlocked()).toBe(false);
    });

    it('does not retry after pause()', async () => {
      const play = jest.fn().mockRejectedValue(new Error('NotAllowed'));
      HTMLMediaElement.prototype.play = play;
      HTMLMediaElement.prototype.pause = jest.fn();
      const playback = create();
      playback.play();
      await jest.advanceTimersByTimeAsync(0);
      playback.pause();
      gesture();
      await jest.advanceTimersByTimeAsync(0);
      expect(play).toHaveBeenCalledTimes(1);
    });

    it('does not retry once the video has failed to load', async () => {
      const play = jest.fn().mockRejectedValue(new Error('NotAllowed'));
      HTMLMediaElement.prototype.play = play;
      const playback = create();
      playback.play();
      await jest.advanceTimersByTimeAsync(0);
      await jest.advanceTimersByTimeAsync(5000);
      gesture();
      await jest.advanceTimersByTimeAsync(0);
      expect(play).toHaveBeenCalledTimes(1);
    });
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
