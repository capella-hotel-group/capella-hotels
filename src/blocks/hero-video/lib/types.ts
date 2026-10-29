// src/blocks/hero-video/lib/types.ts

export type TransitionStyle = 'crossfade' | 'slide' | 'cut';

// Distance the mode-toggle indicator (a fixed-size dot) slides to reach the "experience" side —
// track width minus the dot and its two paddings, all read from CSS so it stays in sync per breakpoint.
// The CSS `left` is `padding - 1px` (the indicator is positioned from the padding-box, inside the 1px
// border), so the dot sits `padding` from the outer edge on both ends, as in Figma.
// Applied via the --toggle-indicator-x custom property so the CSS transform keeps its translateY(-50%).
export const TOGGLE_INDICATOR_SHIFT =
  'calc(var(--component-toogle-width) - var(--component-toogle-selector-dot) - 2 * var(--component-toogle-padding))';

export interface HeroVideoConfig {
  prefix: string;
  suffix: string;
  transition: TransitionStyle;
  destinationLabel: string;
  destinationHref: string;
  experienceLabel: string;
  experienceHref: string;
  showOverlay: boolean;
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
  openInNewTab: boolean;
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
