// Intro image in a 20vw square → slide 1 crossfades in behind it → the square opens to full screen.
import type { IntroMedia } from './cinematic/intro-media';
import { wait } from './cinematic/timing';
import type { VideoPlayback } from './cinematic/video-playback';

export const INTRO_MS = 1200;
export const MAX_INTRO_WAIT_MS = 3000;
export const CROSSFADE_MS = 500;
export const EXPAND_MS = 900;

export interface IntroStageOptions {
  block: HTMLElement;
  intro: IntroMedia;
  firstMedia: HTMLElement;
  firstPlayback: VideoPlayback | undefined;
}

/** Only the first-section hero recolors the header, and only if no other hero already did. */
function ownsHeader(block: HTMLElement): boolean {
  if (document.body.hasAttribute('data-hero-intro')) return false;
  const section = block.closest('.section');
  return !!section && section === document.querySelector('main .section');
}

async function untilVideoReady(playback: VideoPlayback): Promise<boolean> {
  let failed = false;
  playback.failed.then(() => {
    failed = true;
  });
  while (!playback.isReady()) {
    if (failed) return false;
    await Promise.race([playback.ready, playback.failed]);
    // Let the failed flag settle before re-checking.
    await Promise.resolve();
  }
  return true;
}

function imageSettled(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}

/** True once slide 1 has something to show behind the intro image. */
async function prepareFirstSlide(media: HTMLElement, playback: VideoPlayback | undefined): Promise<boolean> {
  if (playback) {
    if (!(await untilVideoReady(playback))) return false;
    playback.play();
    await playback.firstFrame();
    return true;
  }
  const img = media.querySelector('img');
  if (!img) return false;
  await Promise.race([imageSettled(img), wait(MAX_INTRO_WAIT_MS)]);
  return true;
}

function useIntroAsBackground(intro: IntroMedia, media: HTMLElement): void {
  const picture = intro.element.querySelector('picture');
  if (!picture || media.classList.contains('hero-destination-media--fallback')) return;
  media.classList.add('hero-destination-media--fallback');
  media.prepend(picture.cloneNode(true));
}

export async function runIntroStage({ block, intro, firstMedia, firstPlayback }: IntroStageOptions): Promise<void> {
  const controlsHeader = ownsHeader(block);
  block.style.setProperty('--hero-destination-parallax-duration', `${INTRO_MS + CROSSFADE_MS}ms`);
  block.style.setProperty('--hero-destination-crossfade-duration', `${CROSSFADE_MS}ms`);
  block.style.setProperty('--hero-destination-expand-duration', `${EXPAND_MS}ms`);
  block.dataset.state = 'intro';
  if (controlsHeader) document.body.dataset.heroIntro = 'intro';
  // A play() rejected after the crossfade still needs a picture behind the scrim.
  firstPlayback?.failed.then(() => useIntroAsBackground(intro, firstMedia));

  // Slide 1 waits for the intro image so the LCP image gets the bandwidth first.
  const introSettled = Promise.race([intro.loaded, wait(MAX_INTRO_WAIT_MS)]);
  introSettled.then(() => firstPlayback?.start());
  await Promise.all([wait(INTRO_MS), introSettled]);

  if (!(await prepareFirstSlide(firstMedia, firstPlayback))) useIntroAsBackground(intro, firstMedia);
  block.dataset.state = 'switching';
  block.classList.add('is-media-visible');
  await wait(CROSSFADE_MS);
  block.dataset.state = 'expanding';
  await wait(EXPAND_MS);
  block.dataset.state = 'expanded';
  if (controlsHeader) document.body.dataset.heroIntro = 'done';
}
