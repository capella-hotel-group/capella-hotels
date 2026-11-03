import { deferred } from './timing';

export interface IntroMedia {
  element: HTMLElement;
  /** Resolves once the first displayed image loads or errors; callers cap the wait themselves. */
  loaded: Promise<void>;
}

function prioritize(picture: HTMLPictureElement): void {
  const img = picture.querySelector('img');
  if (!img) return;
  img.setAttribute('loading', 'eager');
  img.setAttribute('fetchpriority', 'high');
}

export function buildIntroMedia(
  desktop: HTMLPictureElement | null,
  mobile: HTMLPictureElement | null,
): IntroMedia | null {
  const desktopPicture = desktop ?? mobile;
  if (!desktopPicture) return null;
  const mobilePicture = mobile ?? desktopPicture;

  const desktopAlt = desktopPicture.querySelector('img')?.getAttribute('alt') ?? '';
  const mobileImg = mobilePicture.querySelector('img');
  if (mobilePicture !== desktopPicture && mobileImg && desktopAlt) mobileImg.setAttribute('alt', desktopAlt);
  prioritize(desktopPicture);
  prioritize(mobilePicture);

  const element = document.createElement('div');
  element.className = 'hero-destination-video-intro';
  const loaded = deferred();
  const mq = window.matchMedia('(max-width: 767px)');

  const show = (picture: HTMLPictureElement): void => {
    if (element.firstElementChild === picture) return;
    element.replaceChildren(picture);
    const img = picture.querySelector('img');
    if (!img || (img.complete && img.naturalWidth > 0)) {
      loaded.resolve();
      return;
    }
    img.addEventListener('load', () => loaded.resolve(), { once: true });
    img.addEventListener('error', () => loaded.resolve(), { once: true });
  };

  show(mq.matches ? mobilePicture : desktopPicture);
  mq.addEventListener('change', () => show(mq.matches ? mobilePicture : desktopPicture));

  return { element, loaded: loaded.promise };
}
