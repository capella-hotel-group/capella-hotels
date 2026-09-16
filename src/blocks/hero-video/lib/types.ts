// src/blocks/hero-video/lib/types.ts

export type TransitionStyle = 'crossfade' | 'slide' | 'cut';

// Distance the mode-toggle indicator (a fixed-size dot) slides to reach the "experience" side —
// track width minus the dot and its two paddings, all read from CSS so it stays in sync per breakpoint.
export const TOGGLE_INDICATOR_SHIFT =
  'translateX(calc(var(--component-toogle-width) - var(--component-toogle-selector-dot) - 2 * var(--component-toogle-padding)))';

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
