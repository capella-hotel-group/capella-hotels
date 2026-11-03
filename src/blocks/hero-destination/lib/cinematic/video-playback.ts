import { deferred } from './timing';

const READY_TIMEOUT_MS = 5000;
const HAVE_FUTURE_DATA = 3;

export interface VideoPlaybackOptions {
  desktopUrl: string;
  mobileUrl: string;
  loop: boolean;
  posterUrl?: string;
  timeoutMs?: number;
}

export interface VideoPlayback {
  element: HTMLVideoElement;
  /** Resolves for the selected source; a source change creates a new readiness promise. */
  ready: Promise<boolean>;
  playing: Promise<void>;
  /** Error, timeout before ready, or a rejected play(). Once failed, always failed. */
  failed: Promise<void>;
  play(): void;
  isReady(): boolean;
}

export function createVideoPlayback({
  desktopUrl,
  mobileUrl,
  loop,
  posterUrl,
  timeoutMs = READY_TIMEOUT_MS,
}: VideoPlaybackOptions): VideoPlayback {
  const video = document.createElement('video');
  video.className = 'hero-destination-video-media';
  video.muted = true;
  video.setAttribute('muted', '');
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.loop = loop;
  video.preload = 'auto';
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  if (posterUrl) video.setAttribute('poster', posterUrl);

  const mq = window.matchMedia('(max-width: 767px)');
  const pickUrl = (): string => (mq.matches ? mobileUrl : desktopUrl);
  const source = document.createElement('source');
  source.type = 'video/mp4';
  source.setAttribute('src', pickUrl());
  video.append(source);

  let currentReady = deferred<boolean>();
  let sourceReady = false;
  let outcome: 'pending' | 'playing' | 'failed' = 'pending';
  const playing = deferred();
  const failed = deferred();
  let timer = 0;

  const markFailed = (): void => {
    if (outcome === 'failed') return;
    outcome = 'failed';
    sourceReady = false;
    window.clearTimeout(timer);
    currentReady.resolve(false);
    failed.resolve();
  };
  const markReady = (): void => {
    if (outcome === 'failed' || sourceReady) return;
    sourceReady = true;
    window.clearTimeout(timer);
    currentReady.resolve(true);
  };
  const restartReadiness = (): void => {
    const previousReady = currentReady;
    currentReady = deferred<boolean>();
    sourceReady = false;
    if (outcome !== 'failed') {
      window.clearTimeout(timer);
      timer = window.setTimeout(markFailed, timeoutMs);
    }
    previousReady.resolve(false);
  };

  timer = window.setTimeout(markFailed, timeoutMs);
  video.addEventListener('canplay', markReady);
  video.addEventListener('error', markFailed);
  source.addEventListener('error', markFailed);
  video.addEventListener(
    'playing',
    () => {
      markReady();
      if (outcome === 'pending') outcome = 'playing';
      playing.resolve();
    },
    { once: true },
  );
  if (video.readyState >= HAVE_FUTURE_DATA) markReady();

  mq.addEventListener('change', () => {
    const url = pickUrl();
    if (source.getAttribute('src') === url) return;
    const wasPlaying = !video.paused;
    source.setAttribute('src', url);
    if (outcome !== 'failed') restartReadiness();
    video.load();
    if (outcome === 'playing' || wasPlaying) video.play()?.catch(markFailed);
  });

  return {
    element: video,
    get ready() {
      return currentReady.promise;
    },
    playing: playing.promise,
    failed: failed.promise,
    play() {
      if (outcome === 'failed') return;
      video.play()?.catch(markFailed);
    },
    isReady: () => sourceReady,
  };
}
