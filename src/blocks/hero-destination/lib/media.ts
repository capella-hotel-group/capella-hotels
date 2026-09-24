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
    if (img) img.alt = item.imageAlt;
    wrapper.replaceChildren(picture);
  };

  applyPicture();
  mqMobile.addEventListener('change', applyPicture);
  return wrapper;
}

function buildVideoMedia(item: HeroDestinationVideoItem): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'hero-destination-media';

  const video = document.createElement('video');
  video.className = 'hero-destination-video';
  video.autoplay = true;
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
      source.src = next;
      video.load();
    }
  });

  wrapper.append(video);
  return wrapper;
}

export function buildMedia(item: HeroDestinationItem): HTMLElement {
  return item.mediaType === 'video' ? buildVideoMedia(item) : buildImageMedia(item);
}
