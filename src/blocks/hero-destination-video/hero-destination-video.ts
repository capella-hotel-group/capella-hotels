// Rows (authored, one cell each): 0=introImage (+collapsed alt), 1=introImageMobile, 2=video,
// 3=videoMobile, 4=poster, 5=loop, 6=showOverlay, 7=heading, 8=headingDelay — see parseVideoHero.
import { moveInstrumentation } from '@/app/scripts.js';
import { ownsPageHeading } from '../hero-destination/lib/page-heading';
import { buildHeading, scheduleHeadingReveal } from './lib/cinematic/heading-reveal';
import { buildIntroMedia } from './lib/cinematic/intro-media';
import { deferred, wait } from './lib/cinematic/timing';
import { createVideoPlayback, type VideoPlayback } from './lib/cinematic/video-playback';
import { parseVideoHero } from './lib/parse';

const INTRO_MS = 1200;
const MAX_INTRO_WAIT_MS = 3000;
const CROSSFADE_MS = 500;
const EXPAND_MS = 900;
const VIDEO_READY_TIMEOUT_MS = 6000;

function transferInstrumentation(sourceCell: HTMLElement | null, target: Element | null): void {
  if (!sourceCell || !target) return;
  const source = sourceCell.hasAttribute('data-aue-prop')
    ? sourceCell
    : (sourceCell.querySelector('[data-aue-prop]') ?? sourceCell);
  if (source !== target) moveInstrumentation(source, target);
}

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

/** Holds the intro image until a playable frame exists; false once playback has failed or timed out. */
async function untilVideoReady(playback: VideoPlayback): Promise<boolean> {
  let failed = false;
  playback.failed.then(() => {
    failed = true;
  });
  while (!playback.isReady()) {
    if (failed) return false;
    await Promise.race([playback.ready, playback.failed]);
  }
  return true;
}

/** WCAG 2.2.2 pause control: invisible until keyboard focus, so the visual design is untouched. */
function buildPauseToggle(playback: VideoPlayback): HTMLButtonElement {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'hero-destination-video-toggle';
  const icon = document.createElement('span');
  icon.className = 'hero-destination-video-toggle-icon';
  icon.setAttribute('aria-hidden', 'true');
  toggle.append(icon);
  const setPaused = (paused: boolean): void => {
    toggle.dataset.state = paused ? 'paused' : 'playing';
    toggle.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
  };
  setPaused(false);
  toggle.addEventListener('click', () => {
    const pausing = toggle.dataset.state === 'playing';
    if (pausing) playback.element.pause();
    else playback.play();
    setPaused(pausing);
  });
  return toggle;
}

export default function decorate(block: HTMLElement): void {
  const config = parseVideoHero([...block.children] as HTMLElement[]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIntroImage = !!(config.introPicture || config.introPictureMobile);
  const wantsVideo = !!config.desktopVideoUrl && !saveDataEnabled() && !(reducedMotion && hasIntroImage);

  const posterUrl =
    (config.posterPicture ?? config.introPicture ?? config.introPictureMobile)
      ?.querySelector('img')
      ?.getAttribute('src') ?? undefined;
  const playback = wantsVideo
    ? createVideoPlayback({
        desktopUrl: config.desktopVideoUrl,
        mobileUrl: config.mobileVideoUrl,
        loop: config.loop,
        posterUrl,
        timeoutMs: VIDEO_READY_TIMEOUT_MS,
        deferLoad: true,
      })
    : null;
  // Without a video the poster stands in as the image, so the hero is never empty.
  const intro = buildIntroMedia(
    config.introPicture ?? (playback ? null : config.posterPicture),
    config.introPictureMobile,
  );
  const heading = buildHeading(config.heading, config.headingCell, ownsPageHeading(block) ? 'h1' : 'h2');

  const frame = document.createElement('div');
  frame.className = 'hero-destination-video-frame';
  const createFieldTarget = (): HTMLElement => document.createElement('span');
  const targetFor = (sourceCell: HTMLElement | null, target: Element | null): Element | null => {
    if (!sourceCell || target) return target;
    const marker = createFieldTarget();
    frame.append(marker);
    return marker;
  };
  const videoSource = playback?.element.querySelector('source') ?? null;

  transferInstrumentation(config.introPictureCell, targetFor(config.introPictureCell, config.introPicture));
  transferInstrumentation(
    config.introImageAltCell,
    targetFor(config.introImageAltCell, config.introPicture?.querySelector('img') ?? null),
  );
  transferInstrumentation(
    config.introPictureMobileCell,
    targetFor(config.introPictureMobileCell, intro?.element ?? config.introPictureMobile),
  );
  transferInstrumentation(
    config.desktopVideoCell,
    targetFor(config.desktopVideoCell, playback?.element ?? intro?.element ?? null),
  );
  transferInstrumentation(config.mobileVideoCell, targetFor(config.mobileVideoCell, videoSource));
  transferInstrumentation(config.posterCell, targetFor(config.posterCell, config.posterPicture));
  transferInstrumentation(config.loopCell, targetFor(config.loopCell, null));
  transferInstrumentation(config.showOverlayCell, block);
  transferInstrumentation(config.headingDelayCell, targetFor(config.headingDelayCell, null));

  if (config.posterPicture && playback) playback.element.append(config.posterPicture);
  if (config.posterPicture && !playback && !intro?.element.contains(config.posterPicture)) {
    config.posterPicture.hidden = true;
    frame.append(config.posterPicture);
  }
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
    playback?.start();
    if (playback) {
      block.classList.add('is-video-visible');
      if (intro) playback.failed.then(() => block.classList.remove('is-video-visible'));
      if (!reducedMotion) {
        playback.play();
        block.append(buildPauseToggle(playback));
      }
    }
    if (skipIntro || !playback) heading.classList.add('is-revealed');
    else reveal(Promise.resolve());
    return;
  }

  const controlsHeader = ownsHeader(block);
  const expanded = deferred();
  block.style.setProperty('--hero-destination-parallax-duration', `${INTRO_MS + CROSSFADE_MS}ms`);
  block.style.setProperty('--hero-destination-crossfade-duration', `${CROSSFADE_MS}ms`);
  block.style.setProperty('--hero-destination-expand-duration', `${EXPAND_MS}ms`);
  block.dataset.state = 'intro';
  if (controlsHeader) document.body.dataset.heroIntro = 'intro';
  reveal(expanded.promise);

  // A failed play() mid-crossfade drops back to the intro image instead of a frozen/black frame.
  playback?.failed.then(() => block.classList.remove('is-video-visible'));

  // The video request waits for the intro image so the LCP image gets the bandwidth first.
  const imageSettled = Promise.race([intro.loaded, wait(MAX_INTRO_WAIT_MS)]);
  imageSettled.then(() => playback?.start());

  Promise.all([wait(INTRO_MS), imageSettled]).then(async () => {
    // Without a playable video the intro image itself expands (image-only fallback).
    if (playback && (await untilVideoReady(playback))) {
      block.dataset.state = 'switching';
      playback.play();
      await playback.firstFrame();
      block.classList.add('is-video-visible');
      await wait(CROSSFADE_MS);
    }
    block.dataset.state = 'expanding';
    await wait(EXPAND_MS);
    block.dataset.state = 'expanded';
    if (controlsHeader) document.body.dataset.heroIntro = 'done';
    if (playback && block.classList.contains('is-video-visible')) block.append(buildPauseToggle(playback));
    expanded.resolve();
  });
}
