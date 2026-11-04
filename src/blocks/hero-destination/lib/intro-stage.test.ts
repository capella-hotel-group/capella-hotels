import { deferred } from './cinematic/timing';
import type { VideoPlayback } from './cinematic/video-playback';
import { runIntroStage } from './intro-stage';

function setup({ firstSection = true } = {}) {
  const lead = firstSection ? '' : '<div class="section"></div>';
  document.body.innerHTML = `<main>${lead}<div class="section"><div class="hero-destination"></div></div></main>`;
  const block = document.querySelector('.hero-destination') as HTMLElement;
  const introEl = document.createElement('div');
  introEl.innerHTML = '<picture><img src="/intro.jpg" alt=""></picture>';
  const firstMedia = document.createElement('div');
  block.append(introEl, firstMedia);
  return { block, intro: { element: introEl, loaded: Promise.resolve() }, firstMedia };
}

function fakePlayback() {
  const ready = deferred<boolean>();
  const failed = deferred();
  let isReady = false;
  const playback = {
    element: document.createElement('video'),
    get ready() {
      return ready.promise;
    },
    playing: new Promise<void>(() => {}),
    failed: failed.promise,
    play: jest.fn(),
    firstFrame: () => Promise.resolve(),
    start: jest.fn(),
    isReady: () => isReady,
  } as unknown as VideoPlayback;
  return {
    playback,
    becomeReady: () => {
      isReady = true;
      ready.resolve(true);
    },
    fail: () => failed.resolve(),
  };
}

describe('runIntroStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    delete document.body.dataset.heroIntro;
  });

  it('runs intro, crossfade and expand for a ready video', async () => {
    const { block, intro, firstMedia } = setup();
    const { playback, becomeReady } = fakePlayback();
    const done = runIntroStage({ block, intro, firstMedia, firstPlayback: playback });
    expect(block.dataset.state).toBe('intro');
    expect(document.body.dataset.heroIntro).toBe('intro');

    await jest.advanceTimersByTimeAsync(0);
    expect(playback.start).toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1200);
    expect(block.dataset.state).toBe('intro');
    becomeReady();
    await jest.advanceTimersByTimeAsync(0);
    expect(playback.play).toHaveBeenCalled();
    expect(block.dataset.state).toBe('switching');
    expect(block.classList.contains('is-media-visible')).toBe(true);

    await jest.advanceTimersByTimeAsync(500);
    expect(block.dataset.state).toBe('expanding');
    await jest.advanceTimersByTimeAsync(900);
    await done;
    expect(block.dataset.state).toBe('expanded');
    expect(document.body.dataset.heroIntro).toBe('done');
  });

  it('uses the intro image as slide 1 background when the video fails', async () => {
    const { block, intro, firstMedia } = setup();
    const { playback, fail } = fakePlayback();
    const done = runIntroStage({ block, intro, firstMedia, firstPlayback: playback });
    await jest.advanceTimersByTimeAsync(1200);
    fail();
    await jest.advanceTimersByTimeAsync(1400);
    await done;
    expect(firstMedia.classList.contains('hero-destination-media--fallback')).toBe(true);
    expect(firstMedia.querySelector('picture img')?.getAttribute('src')).toBe('/intro.jpg');
    expect(block.dataset.state).toBe('expanded');
  });

  it('uses the intro image for an empty first slide', async () => {
    const { block, intro, firstMedia } = setup();
    const done = runIntroStage({ block, intro, firstMedia, firstPlayback: undefined });
    await jest.advanceTimersByTimeAsync(2600);
    await done;
    expect(firstMedia.querySelector('picture')).not.toBeNull();
    expect(firstMedia.classList.contains('hero-destination-media--fallback')).toBe(true);
  });

  it('does not claim the header outside the first section', async () => {
    const { block, intro, firstMedia } = setup({ firstSection: false });
    runIntroStage({ block, intro, firstMedia, firstPlayback: undefined });
    expect(document.body.dataset.heroIntro).toBeUndefined();
  });
});
