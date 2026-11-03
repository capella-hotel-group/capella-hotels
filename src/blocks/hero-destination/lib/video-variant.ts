// Rows (authored, one cell each): 0=introImage (+collapsed alt), 1=introImageMobile, 2=video,
// 3=videoMobile, 4=poster, 5=loop, 6=showOverlay, 7=heading, 8=headingDelay — see parseVideoHero.
import { buildHeading, scheduleHeadingReveal } from './cinematic/heading-reveal';
import { buildIntroMedia } from './cinematic/intro-media';
import { deferred, wait } from './cinematic/timing';
import { createVideoPlayback } from './cinematic/video-playback';
import { parseVideoHero } from './parse';

const MIN_INTRO_MS = 500;
const MAX_INTRO_WAIT_MS = 3000;
const EXPAND_MS = 900;
const CROSSFADE_PLAY_AT_MS = 225;

function isEditorOrFramed(): boolean {
  return document.documentElement.classList.contains('adobe-ue-edit') || window.self !== window.top;
}

function saveDataEnabled(): boolean {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

/** Only the first-section hero recolors the header, and only if no other hero already did. */
function ownsHeader(block: HTMLElement): boolean {
  if (document.body.hasAttribute('data-hero-intro')) return false;
  const section = block.closest('.section');
  return !!section && section === document.querySelector('main .section');
}

export default function decorateVideo(block: HTMLElement): void {
  const config = parseVideoHero([...block.children] as HTMLElement[]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIntroImage = !!(config.introPicture || config.introPictureMobile);
  const wantsVideo = !!config.desktopVideoUrl && !saveDataEnabled() && !(reducedMotion && hasIntroImage);

  const posterUrl = config.posterPicture?.querySelector('img')?.getAttribute('src') ?? undefined;
  const playback = wantsVideo
    ? createVideoPlayback({
        desktopUrl: config.desktopVideoUrl,
        mobileUrl: config.mobileVideoUrl,
        loop: config.loop,
        posterUrl,
      })
    : null;
  // Without a video the poster stands in as the image, so the hero is never empty.
  const intro = buildIntroMedia(
    config.introPicture ?? (playback ? null : config.posterPicture),
    config.introPictureMobile,
  );
  const heading = buildHeading(config.heading, config.headingCell);

  const frame = document.createElement('div');
  frame.className = 'hero-destination-video-frame';
  if (playback) frame.append(playback.element);
  if (intro) frame.append(intro.element);
  block.replaceChildren(frame, heading);
  block.setAttribute('data-testid', 'hero-destination-video');
  if (!config.showOverlay) block.classList.add('hero-destination-video--no-overlay');

  const playing = playback?.playing ?? new Promise<void>(() => {});
  const failed = playback?.failed ?? Promise.resolve();
  const reveal = (expanded: Promise<void>): Promise<void> =>
    scheduleHeadingReveal(heading, { expanded, playing, failed, delayMs: config.headingDelayMs });

  const skipIntro = isEditorOrFramed() || reducedMotion;
  if (skipIntro || !intro) {
    block.dataset.state = 'expanded';
    block.classList.add('is-static');
    if (playback) {
      block.classList.add('is-video-visible');
      if (intro) playback.failed.then(() => block.classList.remove('is-video-visible'));
      if (!reducedMotion) playback.play();
    }
    if (skipIntro || !playback) heading.classList.add('is-revealed');
    else reveal(Promise.resolve());
    return;
  }

  const controlsHeader = ownsHeader(block);
  const expanded = deferred();
  block.dataset.state = 'intro';
  if (controlsHeader) document.body.dataset.heroIntro = 'intro';
  reveal(expanded.promise);

  // A failed play() mid-crossfade drops back to the intro image instead of a frozen/black frame.
  playback?.failed.then(() => block.classList.remove('is-crossfading', 'is-late-crossfade'));

  Promise.all([wait(MIN_INTRO_MS), Promise.race([intro.loaded, wait(MAX_INTRO_WAIT_MS)])]).then(async () => {
    block.dataset.state = 'expanding';
    if (playback?.isReady()) {
      block.classList.add('is-crossfading');
      setTimeout(() => playback.play(), CROSSFADE_PLAY_AT_MS);
    } else if (playback) {
      playback.ready.then((ok) => {
        if (!ok) return;
        block.classList.add('is-late-crossfade');
        playback.play();
      });
    }
    await wait(EXPAND_MS);
    block.dataset.state = 'expanded';
    if (controlsHeader) document.body.dataset.heroIntro = 'done';
    expanded.resolve();
  });
}
