// src/blocks/hero-video/lib/media-manager.ts
import type { HeroVideoItem } from './types';

const CROSSFADE_MS = 620;
const FIRST_FRAME_TIMEOUT_MS = 500;
const LOAD_TIMEOUT_MS = 8000;
const ERROR_RETRY_GRACE_MS = 400;

function waitForMediaReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let timer = 0;
    let pollId = 0;
    let retried = false;
    let errorSeenAt = 0;

    const finish = (ok: boolean): void => {
      window.clearInterval(pollId);
      window.clearTimeout(timer);
      if (ok) resolve();
      else reject(new Error('video-load-timeout'));
    };

    timer = window.setTimeout(() => finish(false), LOAD_TIMEOUT_MS);

    // Poll readyState. Chromium sometimes aborts a fresh video's initial byte-range probe under
    // network contention (e.g. right after page mount, competing with fonts/JS), which sets
    // `video.error` — a terminal state per the HTML spec that readyState will never advance past
    // without a new `.load()`. Give it a short grace window in case it's a transient recovery,
    // then retry the load once ourselves before falling back to the full timeout.
    pollId = window.setInterval(() => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        finish(true);
        return;
      }
      if (video.error && !retried) {
        if (!errorSeenAt) {
          errorSeenAt = Date.now();
        } else if (Date.now() - errorSeenAt >= ERROR_RETRY_GRACE_MS) {
          retried = true;
          video.load();
        }
      }
    }, 50);
  });
}

function waitForFirstFrame(video: HTMLVideoElement): Promise<void> {
  if (typeof video.requestVideoFrameCallback !== 'function') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, FIRST_FRAME_TIMEOUT_MS);

    video.requestVideoFrameCallback(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });
  });
}

export type TransitionStyle = 'crossfade' | 'slide' | 'cut';

export class MediaManager {
  private videoA: HTMLVideoElement;
  private videoB: HTMLVideoElement;
  private posterEl: HTMLElement;
  private activeLayer: 'a' | 'b' = 'a';
  private sequenceId = 0;
  private muted = true;
  private transition: TransitionStyle = 'crossfade';
  private onError: (item: HeroVideoItem, errorType: string) => void = () => {};
  private onFirstFrame: () => void = () => {};
  private firstFrameEmitted = false;
  private pendingFadeIn: Animation | null = null;
  private pendingFadeOut: Animation | null = null;
  // When autoplay is blocked, we register a one-shot listener that retries playback on the first
  // real user gesture. Tracked so we don't stack duplicate listeners.
  private gestureRetryBound = false;
  private readonly gestureRetry = (): void => {
    this.gestureRetryBound = false;
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((evt) =>
      window.removeEventListener(evt, this.gestureRetry),
    );
    this.resume();
  };

  constructor(videoA: HTMLVideoElement, videoB: HTMLVideoElement, posterEl: HTMLElement) {
    this.videoA = videoA;
    this.videoB = videoB;
    this.posterEl = posterEl;

    // Start both fully transparent; active layer will be faded in on first switchTo
    videoA.style.opacity = '0';
    videoB.style.opacity = '0';
    videoA.preload = 'auto';
    videoB.preload = 'auto';
  }

  get activeVideo(): HTMLVideoElement {
    return this.activeLayer === 'a' ? this.videoA : this.videoB;
  }

  get inactiveVideo(): HTMLVideoElement {
    return this.activeLayer === 'a' ? this.videoB : this.videoA;
  }

  setErrorHandler(cb: (item: HeroVideoItem, errorType: string) => void): void {
    this.onError = cb;
  }

  /** Fires once, right after the first successfully-loaded video decodes its first frame. */
  setFirstFrameHandler(cb: () => void): void {
    this.onFirstFrame = cb;
  }

  setTransition(style: TransitionStyle): void {
    this.transition = style;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.videoA.muted = muted;
    this.videoB.muted = muted;
  }

  pause(): void {
    this.videoA.pause();
    this.videoB.pause();
  }

  resume(): void {
    // Play whichever layer has a loaded resource and isn't fully faded out — during a
    // switchTo() crossfade, activeLayer hasn't swapped yet but the incoming layer is visible
    // and needs to play. Iterating both layers avoids racing with the swap.
    [this.videoA, this.videoB].forEach((v) => {
      if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && parseFloat(v.style.opacity || '0') > 0 && v.paused) {
        this.playSafely(v);
      }
    });
  }

  /**
   * Mimics a manual click: forces the active layer visible and re-attempts play(), bypassing
   * both switchTo()'s same-URL dedupe (which skips replaying) and resume()'s opacity gate (which
   * no-ops if the crossfade left opacity at 0). Safety net for soft-nav mounts where play()
   * itself never rejects, but the video is left loaded-yet-paused/invisible.
   */
  ensureActivePlaying(): void {
    const v = this.activeVideo;
    if (v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && v.paused) {
      v.style.opacity = '1';
      this.playSafely(v);
    }
  }

  /**
   * Play a video, re-asserting muted first (muted playback is exempt from autoplay blocking in
   * all modern browsers). If the browser still rejects the play() promise, arm a one-shot retry
   * on the next user gesture so playback recovers as soon as the visitor interacts.
   */
  private playSafely(video: HTMLVideoElement): void {
    video.muted = this.muted;
    const p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => this.armGestureRetry());
    }
  }

  private armGestureRetry(): void {
    if (this.gestureRetryBound) return;
    this.gestureRetryBound = true;
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((evt) =>
      window.addEventListener(evt, this.gestureRetry, { once: true, passive: true }),
    );
  }

  /** Switch to a new item's video with opacity crossfade. */
  async switchTo(item: HeroVideoItem): Promise<void> {
    this.sequenceId += 1;
    const mySeq = this.sequenceId;

    const incoming = this.inactiveVideo;
    const outgoing = this.activeVideo;

    // If the active layer is already playing this URL, avoid redundant reload/fade.
    const activeSrc = this.normalizeUrl(outgoing.currentSrc || outgoing.src);
    const requestedSrc = this.normalizeUrl(item.videoUrl);
    if (activeSrc && requestedSrc && activeSrc === requestedSrc) {
      outgoing.style.objectPosition = this.getFocalPosition(item);
      return;
    }

    // Cancel any in-flight fade animations so a new switch starts from a clean state.
    this.pendingFadeIn?.cancel();
    this.pendingFadeOut?.cancel();
    this.pendingFadeIn = null;
    this.pendingFadeOut = null;

    // Update poster fallback immediately
    this.posterEl.style.backgroundImage = `url(${item.posterUrl})`;
    this.posterEl.style.backgroundPosition = this.getFocalPosition(item);

    // Load video into incoming layer
    incoming.src = item.videoUrl;
    incoming.muted = this.muted;
    incoming.style.objectPosition = this.getFocalPosition(item);
    incoming.style.transform = '';

    // Wait until browser has media data. If it fails, keep current video visible.
    incoming.load();
    const loadFailed = await waitForMediaReady(incoming)
      .then(() => false)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'load-error';
        this.onError(item, msg);
        return true;
      });

    if (loadFailed) {
      // True load failure (persistent video.error). Fade the outgoing video out to reveal the
      // new item's poster underneath. Leave outgoing.src loaded so re-selecting the previous
      // item can resume cheaply, and don't swap activeLayer so future dedup still references
      // the last successfully-playing item.
      if (this.sequenceId !== mySeq) return;

      const startOpacity = outgoing.style.opacity || '1';
      if (startOpacity !== '0') {
        const fade = outgoing.animate([{ opacity: startOpacity }, { opacity: '0' }], {
          duration: CROSSFADE_MS,
          easing: 'ease-in-out',
          fill: 'forwards',
        });
        this.pendingFadeOut = fade;
        await fade.finished.catch(() => {});
        if (this.sequenceId !== mySeq) return;
        this.pendingFadeOut = null;
        fade.cancel();
      }
      outgoing.style.opacity = '0';
      outgoing.pause();
      return;
    }

    // Stale request guard: another switchTo() was called while we were loading
    if (this.sequenceId !== mySeq) return;

    // Start playback before fade
    this.playSafely(incoming);

    // Ensure at least one decoded frame is available before we begin the fade.
    await waitForFirstFrame(incoming);

    if (!this.firstFrameEmitted) {
      this.firstFrameEmitted = true;
      this.onFirstFrame();
    }

    if (this.transition === 'cut') {
      incoming.style.opacity = '1';
      outgoing.style.opacity = '0';
    } else if (this.transition === 'slide') {
      incoming.style.transform = 'translateX(100%)';
      incoming.style.opacity = '1';
      outgoing.style.transform = 'translateX(0%)';
      const slideIn = incoming.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0%)' }], {
        duration: CROSSFADE_MS,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      const slideOut = outgoing.animate([{ transform: 'translateX(0%)' }, { transform: 'translateX(-100%)' }], {
        duration: CROSSFADE_MS,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      this.pendingFadeIn = slideIn;
      this.pendingFadeOut = slideOut;

      await Promise.all([slideIn.finished, slideOut.finished]).catch(() => {
        // Animation interrupted (e.g. rapid switching) — that's fine
      });

      if (this.sequenceId !== mySeq) return;

      incoming.style.transform = 'translateX(0%)';
      outgoing.style.opacity = '0';
      slideIn.cancel();
      slideOut.cancel();
    } else {
      // Crossfade (default): incoming fades in, outgoing fades out simultaneously.
      // fadeOut starts from outgoing's current opacity so that a click after a previous load
      // failure (which left outgoing at 0) doesn't flash the paused frame back to full opacity.
      const outgoingStartOpacity = outgoing.style.opacity || '1';
      const fadeIn = incoming.animate([{ opacity: '0' }, { opacity: '1' }], {
        duration: CROSSFADE_MS,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      const fadeOut = outgoing.animate([{ opacity: outgoingStartOpacity }, { opacity: '0' }], {
        duration: CROSSFADE_MS,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      this.pendingFadeIn = fadeIn;
      this.pendingFadeOut = fadeOut;

      await Promise.all([fadeIn.finished, fadeOut.finished]).catch(() => {
        // Animation interrupted (e.g. rapid switching) — that's fine
      });

      if (this.sequenceId !== mySeq) return;

      incoming.style.opacity = '1';
      outgoing.style.opacity = '0';
      fadeIn.cancel();
      fadeOut.cancel();
    }

    this.pendingFadeIn = null;
    this.pendingFadeOut = null;

    // Cleanup outgoing — clear src to free decode memory for the old video, reset transform
    outgoing.pause();
    outgoing.removeAttribute('src');
    outgoing.load();
    outgoing.style.transform = '';

    // Swap active layer
    this.activeLayer = this.activeLayer === 'a' ? 'b' : 'a';

    // Ensure the newly-active video is playing. During soft-nav mount, IntersectionObserver
    // callbacks can fire mid-crossfade — resume() no-ops if it runs before this swap because
    // activeVideo still points to the outgoing layer, and pause() can interrupt the incoming
    // layer's playback that was started earlier. Re-play here so a spurious mid-flight pause
    // doesn't leave the video stalled at opacity 1 but paused.
    if (incoming.paused) {
      this.playSafely(incoming);
    }
  }

  private getFocalPosition(item: HeroVideoItem): string {
    const isMobile = window.matchMedia('(width < 768px)').matches;
    return isMobile ? item.focalMobile : item.focalDesktop;
  }

  private normalizeUrl(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.origin);
      return `${parsed.origin}${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }

  destroy(): void {
    this.sequenceId = Number.MAX_SAFE_INTEGER; // invalidate any pending switchTo
    this.pendingFadeIn?.cancel();
    this.pendingFadeOut?.cancel();
    this.pendingFadeIn = null;
    this.pendingFadeOut = null;
    if (this.gestureRetryBound) {
      this.gestureRetryBound = false;
      ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((evt) =>
        window.removeEventListener(evt, this.gestureRetry),
      );
    }
    this.videoA.pause();
    this.videoB.pause();
    this.videoA.removeAttribute('src');
    this.videoB.removeAttribute('src');
    this.videoA.load();
    this.videoB.load();
  }
}
