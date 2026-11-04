// src/blocks/hero-destination/lib/media.ts
// Builds a slide's background media (image or video) and swaps the mobile/desktop asset live on
// breakpoint change, without re-requesting the asset that's already active.
import { createVideoPlayback, type VideoPlayback } from './cinematic/video-playback';
import type { HeroDestinationImageItem, HeroDestinationItem, HeroDestinationVideoItem } from './types';

const VIDEO_READY_TIMEOUT_MS = 6000;
const mqMobile = window.matchMedia('(max-width: 767px)');
const playbacks = new WeakMap<HTMLElement, VideoPlayback>();

export interface MediaOptions {
  /** Load right away (slide 1 without an intro); otherwise loading waits for playback.start(). */
  eager: boolean;
  loop: boolean;
}

export function playbackFor(media: HTMLElement): VideoPlayback | undefined {
  return playbacks.get(media);
}

function saveDataEnabled(): boolean {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

function buildImageMedia(item: HeroDestinationImageItem): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-destination-media';

  const applyPicture = (): void => {
    const picture = (mqMobile.matches && item.mobilePicture) || item.desktopPicture;
    const img = picture.querySelector('img');
    if (img && item.imageAlt) img.alt = item.imageAlt;
    wrapper.replaceChildren(picture);
  };

  applyPicture();
  mqMobile.addEventListener('change', applyPicture);
  return wrapper;
}

function buildEmptyMedia(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-destination-media';
  return wrapper;
}

function buildVideoMedia(item: HeroDestinationVideoItem, { eager, loop }: MediaOptions): HTMLElement {
  const wrapper = buildEmptyMedia();
  if (saveDataEnabled()) return wrapper;
  // Playback is driven by the slider so only the active slide's video runs.
  const playback = createVideoPlayback({
    desktopUrl: item.desktopVideoUrl,
    mobileUrl: item.mobileVideoUrl,
    loop,
    timeoutMs: VIDEO_READY_TIMEOUT_MS,
    deferLoad: !eager,
  });
  wrapper.append(playback.element);
  playbacks.set(wrapper, playback);
  return wrapper;
}

export function buildMedia(item: HeroDestinationItem, options: MediaOptions): HTMLElement {
  if (item.mediaType === 'video') return buildVideoMedia(item, options);
  if (item.mediaType === 'image') return buildImageMedia(item);
  return buildEmptyMedia();
}
