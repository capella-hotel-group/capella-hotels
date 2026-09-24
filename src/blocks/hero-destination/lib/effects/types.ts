// src/blocks/hero-destination/lib/effects/types.ts

export type EffectName = 'slide' | 'fade' | 'cube' | 'coverflow' | 'flip' | 'creative' | 'cards';

export interface EffectController {
  /** One-time setup: add effect-specific classes to the track. */
  init(track: HTMLElement, slides: HTMLElement[]): void;
  /** Positions/animates every slide for the given active index; called on every slide change. */
  render(track: HTMLElement, slides: HTMLElement[], activeIndex: number): void;
}
