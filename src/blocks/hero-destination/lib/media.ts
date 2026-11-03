// src/blocks/hero-destination/lib/media.ts
// Builds a slide's background media (image or video) and swaps the mobile/desktop asset live on
// breakpoint change, without re-requesting the asset that's already active.
import type { HeroDestinationImageItem, HeroDestinationItem, HeroDestinationVideoItem } from './types';

const mqMobile = window.matchMedia('(max-width: 767px)');

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

function buildVideoMedia(item: HeroDestinationVideoItem, eager: boolean): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-destination-media';

  // Playback is driven by the slider so only the active slide's video runs.
  const video = document.createElement('video');
  video.className = 'hero-destination-video';
  video.preload = eager ? 'auto' : 'none';
  video.muted = true;
  video.loop = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');

  const source = document.createElement('source');
  source.type = 'video/mp4';
  const pickSrc = (): string => (mqMobile.matches ? item.mobileVideoUrl : item.desktopVideoUrl);
  source.src = pickSrc();
  video.append(source);

  mqMobile.addEventListener('change', () => {
    const next = pickSrc();
    if (source.src !== next) {
      const wasPlaying = !video.paused;
      source.src = next;
      video.load();
      if (wasPlaying) video.play()?.catch(() => {});
    }
  });

  wrapper.append(video);
  return wrapper;
}

function buildEmptyMedia(): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-destination-media';
  return wrapper;
}

export function buildMedia(item: HeroDestinationItem, eager: boolean): HTMLElement {
  if (item.mediaType === 'video') return buildVideoMedia(item, eager);
  if (item.mediaType === 'image') return buildImageMedia(item);
  return buildEmptyMedia();
}
