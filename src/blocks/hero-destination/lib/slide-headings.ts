// src/blocks/hero-destination/lib/slide-headings.ts
import { wait } from './cinematic/timing';
import type { VideoPlayback } from './cinematic/video-playback';

export const VIDEO_HEADING_DELAY_MS = 1500;
/** Matches .hero-destination-media's transition, so the text rises once the background settles. */
export const IMAGE_HEADING_DELAY_MS = 750;
/** A video that never reports `playing` (blocked, stalled) must not keep its heading hidden. */
export const VIDEO_HEADING_CAP_MS = 6000;

type HeadingPlayback = Pick<VideoPlayback, 'element' | 'failed'>;

export interface HeadingSequencerOptions {
  headings: HTMLElement[];
  playbacks: (HeadingPlayback | undefined)[];
  instant: boolean;
  /** Every reveal also waits for this (the intro expansion). */
  gate: Promise<void>;
}

function nextPlaying(video: HTMLVideoElement): Promise<void> {
  if (!video.paused) return Promise.resolve();
  return new Promise((resolve) => {
    video.addEventListener('playing', () => resolve(), { once: true });
  });
}

export function createHeadingSequencer({ headings, playbacks, instant, gate }: HeadingSequencerOptions): {
  activate(index: number): void;
} {
  let token = 0;
  return {
    activate(index: number): void {
      token += 1;
      const current = token;
      headings.forEach((heading, i) => {
        if (i !== index) heading.classList.remove('is-revealed');
      });
      const heading = headings[index];
      if (!heading) return;
      if (instant) {
        heading.classList.add('is-revealed');
        return;
      }
      heading.classList.remove('is-revealed');
      const playback = playbacks[index];
      const ready = playback
        ? Promise.race([nextPlaying(playback.element), playback.failed, wait(VIDEO_HEADING_CAP_MS)]).then(() =>
            wait(VIDEO_HEADING_DELAY_MS),
          )
        : wait(IMAGE_HEADING_DELAY_MS);
      Promise.all([gate, ready]).then(() => {
        if (current === token) heading.classList.add('is-revealed');
      });
    },
  };
}
