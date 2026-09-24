// src/blocks/hero-video/lib/types.ts

export type TransitionStyle = 'crossfade' | 'slide' | 'cut';

// Distance the mode-toggle indicator (a fixed-size dot) slides to reach the "experience" side —
// track width minus the dot and its two paddings, all read from CSS so it stays in sync per breakpoint.
// The trailing "- 2px" accounts for the track's two 1px borders: --component-toogle-width is the
// border-box width (box-sizing: border-box), but the indicator's `left`/translate offsets are
// relative to the padding-box, so the border must be subtracted to land symmetrically on the right.
export const TOGGLE_INDICATOR_SHIFT =
  'translateX(calc(var(--component-toogle-width) - var(--component-toogle-selector-dot) - 2 * var(--component-toogle-padding) - 2px))';

export interface HeroVideoConfig {
  prefix: string;
  suffix: string;
  transition: TransitionStyle;
  destinationLabel: string;
  destinationHref: string;
  experienceLabel: string;
  experienceHref: string;
}

/** hero-video block element carrying the soft-nav readiness gate promise. */
export interface HeroVideoElement extends HTMLElement {
  __heroFirstFrameReady?: Promise<void>;
}

export interface HeroVideoItem {
  label: string;
  videoUrl: string;
  posterUrl: string;
  link: string | null;
  focalDesktop: string;
  focalMobile: string;
  /** Original row element for moveInstrumentation */
  sourceRow: HTMLElement;
}

export interface HeroVideoState {
  activeIndex: number;
  introComplete: boolean;
  muted: boolean;
}

export interface IntroElements {
  introPhrase: HTMLElement;
  phrasePrefix: HTMLElement;
  phraseSuffix: HTMLElement;
  prefix: HTMLElement;
  suffix: HTMLElement;
  itemList: HTMLElement;
  controls: HTMLElement;
}
