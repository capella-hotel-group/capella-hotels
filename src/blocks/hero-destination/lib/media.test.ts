jest.mock('@/utils/env.js', () => ({ resolveDAMUrl: (url: string) => url }));
jest.mock('@/app/scripts.js', () => ({ moveInstrumentation: () => {} }));

import type { HeroDestinationVideoItem } from './types';

const videoItem = (): HeroDestinationVideoItem => ({
  mediaType: 'video',
  desktopVideoUrl: '/d.mp4',
  mobileVideoUrl: '/m.mp4',
  heading: 'Kyoto',
  sourceRow: document.createElement('div'),
});

describe('hero-destination media', () => {
  beforeEach(() => {
    jest.resetModules();
    window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn() });
    HTMLMediaElement.prototype.load = jest.fn();
    delete (navigator as unknown as { connection?: unknown }).connection;
  });

  it('builds an eager video with its source and registers its playback', async () => {
    const { buildMedia, playbackFor } = await import('./media');
    const media = buildMedia(videoItem(), { eager: true, loop: false });
    const playback = playbackFor(media);
    expect(playback?.element.loop).toBe(false);
    expect(media.querySelector('source')?.getAttribute('src')).toBe('/d.mp4');
  });

  it('defers a non-eager video source until start()', async () => {
    const { buildMedia, playbackFor } = await import('./media');
    const media = buildMedia(videoItem(), { eager: false, loop: true });
    expect(media.querySelector('source')?.hasAttribute('src')).toBe(false);
    playbackFor(media)?.start();
    expect(media.querySelector('source')?.getAttribute('src')).toBe('/d.mp4');
  });

  it('renders an empty media box under save-data', async () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    const { buildMedia, playbackFor } = await import('./media');
    const media = buildMedia(videoItem(), { eager: true, loop: false });
    expect(media.querySelector('video')).toBeNull();
    expect(playbackFor(media)).toBeUndefined();
  });

  it('wraps the slide heading text in a reveal span', async () => {
    const { buildSlide } = await import('./dom-builder');
    const slide = buildSlide(videoItem(), 0, 'hd', 1, 'h1');
    const heading = slide.querySelector('h1.hero-destination-heading');
    expect(heading?.querySelector('.hero-destination-heading-text')?.textContent).toBe('Kyoto');
  });
});
