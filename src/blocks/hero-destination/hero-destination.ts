// src/blocks/hero-destination/hero-destination.ts
// Two UE definitions share this block: the default slider, and "Hero Destination (Video)"
// whose template adds the `video` class (see _hero-destination.json).
import decorateSlider from './lib/slider-variant';
import decorateVideo from './lib/video-variant';

export default function decorate(block: HTMLElement): void {
  if (block.classList.contains('video')) decorateVideo(block);
  else decorateSlider(block);
}
