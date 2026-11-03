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
  /** True once the video can play; false if it failed or timed out first. */
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

  const ready = deferred<boolean>();
  const playing = deferred();
  const failed = deferred();
  let state: 'pending' | 'ready' | 'failed' = 'pending';
  let timer = 0;

  const markFailed = (): void => {
    if (state === 'failed') return;
    state = 'failed';
    window.clearTimeout(timer);
    ready.resolve(false);
    failed.resolve();
  };
  const markReady = (): void => {
    if (state !== 'pending') return;
    state = 'ready';
    window.clearTimeout(timer);
    ready.resolve(true);
  };

  timer = window.setTimeout(markFailed, timeoutMs);
  video.addEventListener('canplay', markReady);
  video.addEventListener('error', markFailed);
  source.addEventListener('error', markFailed);
  video.addEventListener('playing', () => playing.resolve(), { once: true });
  if (video.readyState >= HAVE_FUTURE_DATA) markReady();

  mq.addEventListener('change', () => {
    const url = pickUrl();
    if (source.getAttribute('src') === url) return;
    const wasPlaying = !video.paused;
    source.setAttribute('src', url);
    video.load();
    if (wasPlaying) video.play()?.catch(markFailed);
  });

  return {
    element: video,
    ready: ready.promise,
    playing: playing.promise,
    failed: failed.promise,
    play() {
      if (state === 'failed') return;
      video.play()?.catch(markFailed);
    },
    isReady: () => state === 'ready',
  };
}
