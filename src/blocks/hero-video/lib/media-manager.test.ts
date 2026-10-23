import { MediaManager } from './media-manager';
import type { HeroVideoItem } from './types';

function createItem(videoUrl: string): HeroVideoItem {
  return {
    label: 'Ubud',
    videoUrl,
    posterUrl: '',
    link: '',
    openInNewTab: false,
    focalDesktop: 'center',
    focalMobile: 'center',
    sourceRow: document.createElement('div'),
  };
}

function setup(): { media: MediaManager; videoA: HTMLVideoElement; videoB: HTMLVideoElement } {
  const videoA = document.createElement('video');
  const videoB = document.createElement('video');
  const media = new MediaManager(videoA, videoB, document.createElement('div'));
  return { media, videoA, videoB };
}

describe('hero-video MediaManager', () => {
  let play: jest.SpyInstance;

  beforeEach(() => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('notifies onEnded only when the active layer ends', () => {
    const { media, videoA, videoB } = setup();
    const onEnded = jest.fn();
    media.setEndedHandler(onEnded);

    videoB.dispatchEvent(new Event('ended'));
    expect(onEnded).not.toHaveBeenCalled();

    videoA.dispatchEvent(new Event('ended'));
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ignores the outgoing layer ending while a switch is in flight', async () => {
    jest.useFakeTimers();
    const { media, videoA } = setup();
    const onEnded = jest.fn();
    media.setEndedHandler(onEnded);

    const pending = media.switchTo(createItem('https://example.com/b.mp4'));
    expect(media.isSwitching).toBe(true);
    videoA.dispatchEvent(new Event('ended'));
    expect(onEnded).not.toHaveBeenCalled();

    media.destroy();
    jest.advanceTimersByTime(10000);
    await pending.catch(() => {});
    jest.useRealTimers();
  });

  it('restarts playback when switching to the URL already playing', async () => {
    const { media, videoA } = setup();
    videoA.src = 'https://example.com/a.mp4';
    Object.defineProperty(videoA, 'currentTime', { configurable: true, writable: true, value: 12 });

    const outcome = await media.switchTo(createItem('https://example.com/a.mp4'), { restartIfSame: true });

    expect(outcome).toBe('same');
    expect(videoA.currentTime).toBe(0);
    expect(play).toHaveBeenCalled();
  });

  it('reports blank for items without a video', async () => {
    const { media } = setup();

    const outcome = await media.switchTo(createItem(''));

    expect(outcome).toBe('blank');
    expect(media.isSwitching).toBe(false);
  });
});
