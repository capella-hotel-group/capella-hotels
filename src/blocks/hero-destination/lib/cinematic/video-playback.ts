import { deferred } from './timing';

const READY_TIMEOUT_MS = 5000;
const HAVE_FUTURE_DATA = 3;
const ERROR_RETRY_GRACE_MS = 400;
const FIRST_FRAME_TIMEOUT_MS = 900;
const GESTURE_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

export interface VideoPlaybackOptions {
  desktopUrl: string;
  mobileUrl: string;
  loop: boolean;
  posterUrl?: string;
  timeoutMs?: number;
  /** Hold the network request until start() so the intro image gets the bandwidth first. */
  deferLoad?: boolean;
}

export interface VideoPlayback {
  element: HTMLVideoElement;
  /** Resolves for the selected source; a source change creates a new readiness promise. */
  ready: Promise<boolean>;
  playing: Promise<void>;
  /** Error or timeout before ready, or a failed load. Once failed, always failed. */
  failed: Promise<void>;
  /** Resolves the first time the browser refuses play(); playback then retries on the next user gesture. */
  blocked: Promise<void>;
  isBlocked(): boolean;
  play(): void;
  /** Pauses and drops any pending gesture retry's intent to play. */
  pause(): void;
  /** Resolves once pixels are actually rendering after play() (capped), so a crossfade never shows a black frame. */
  firstFrame(): Promise<void>;
  /** Begins loading a deferLoad video; a no-op otherwise or when already started. */
  start(): void;
  isReady(): boolean;
}

export function createVideoPlayback({
  desktopUrl,
  mobileUrl,
  loop,
  posterUrl,
  timeoutMs = READY_TIMEOUT_MS,
  deferLoad = false,
}: VideoPlaybackOptions): VideoPlayback {
  const video = document.createElement('video');
  video.className = 'hero-destination-video';
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
  let started = !deferLoad;
  if (started) source.setAttribute('src', pickUrl());
  video.append(source);

  let currentReady = deferred<boolean>();
  let sourceReady = false;
  let outcome: 'pending' | 'playing' | 'failed' = 'pending';
  const playing = deferred();
  const failed = deferred();
  const blockedSignal = deferred();
  let timer = 0;
  let blocked = false;
  let wantsPlay = false;
  let gestureArmed = false;

  const retryOnGesture = (): void => {
    gestureArmed = false;
    GESTURE_EVENTS.forEach((type) => window.removeEventListener(type, retryOnGesture));
    if (wantsPlay && outcome !== 'failed') attemptPlay();
  };
  // Autoplay refusals (Low Power Mode, strict policies) are recoverable, unlike load failures.
  const markBlocked = (): void => {
    blocked = true;
    blockedSignal.resolve();
    if (gestureArmed) return;
    gestureArmed = true;
    GESTURE_EVENTS.forEach((type) => window.addEventListener(type, retryOnGesture, { once: true, passive: true }));
  };
  function attemptPlay(): void {
    video.play()?.then(() => {
      blocked = false;
    }, markBlocked);
  }

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

  timer = started ? window.setTimeout(markFailed, timeoutMs) : 0;
  video.addEventListener('canplay', markReady);
  // Chromium can abort the first byte-range probe under network contention; one delayed reload
  // recovers it, so only a second error (or the timeout) counts as a failure.
  let retry: 'none' | 'pending' | 'done' = 'none';
  const handleLoadError = (): void => {
    if (retry === 'pending') return;
    if (retry === 'done') {
      markFailed();
      return;
    }
    retry = 'pending';
    window.setTimeout(() => {
      if (outcome === 'failed' || sourceReady) return;
      retry = 'done';
      video.load();
    }, ERROR_RETRY_GRACE_MS);
  };
  video.addEventListener('error', handleLoadError);
  source.addEventListener('error', handleLoadError);
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
    if (!started) return;
    const url = pickUrl();
    if (source.getAttribute('src') === url) return;
    const wasPlaying = !video.paused;
    source.setAttribute('src', url);
    if (outcome !== 'failed') restartReadiness();
    video.load();
    if (outcome === 'playing' || wasPlaying) attemptPlay();
  });

  return {
    element: video,
    get ready() {
      return currentReady.promise;
    },
    playing: playing.promise,
    failed: failed.promise,
    blocked: blockedSignal.promise,
    isBlocked: () => blocked,
    play() {
      wantsPlay = true;
      if (outcome === 'failed') return;
      attemptPlay();
    },
    pause() {
      wantsPlay = false;
      video.pause();
    },
    firstFrame() {
      return new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, FIRST_FRAME_TIMEOUT_MS);
        const done = (): void => {
          window.clearTimeout(timer);
          resolve();
        };
        if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(done);
        else video.addEventListener('playing', done, { once: true });
      });
    },
    start() {
      if (started) return;
      started = true;
      source.setAttribute('src', pickUrl());
      timer = window.setTimeout(markFailed, timeoutMs);
      video.load();
    },
    isReady: () => sourceReady,
  };
}
