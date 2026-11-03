// src/blocks/hero-destination/hero-destination.ts
// Two UE definitions share this block: the default slider, and "Hero Destination (Video)"
// whose template adds the `video` class (see _hero-destination.json).
import decorateSlider from './lib/slider-variant';

export default function decorate(block: HTMLElement): void {
  decorateSlider(block);
}
