// src/blocks/hero-destination/lib/effects/fade.ts
// Premium cross-fade: no horizontal movement. The entering slide settles from a subtle 1.02 scale
// down to 1 with a soft, slightly longer ease; the exiting slide dissolves faster and simpler, so
// slides never appear to visually "tie" together mid-transition.
import type { EffectController } from './types';

const ENTER_TRANSITION = 'opacity 0.75s cubic-bezier(0.4, 0, 0.2, 1), transform 0.75s cubic-bezier(0.4, 0, 0.2, 1)';
const EXIT_TRANSITION = 'opacity 0.5s cubic-bezier(0.4, 0, 1, 1), transform 0.5s cubic-bezier(0.4, 0, 1, 1)';
const REDUCED_MOTION_TRANSITION = 'opacity 0.3s ease';

export const fadeEffect: EffectController = {
  init(track) {
    track.classList.add('hero-destination-effect-fade');
  },
  render(_track, slides, activeIndex) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.style.transition = reduced ? REDUCED_MOTION_TRANSITION : isActive ? ENTER_TRANSITION : EXIT_TRANSITION;
      slide.style.opacity = isActive ? '1' : '0';
      slide.style.zIndex = isActive ? '2' : '1';
      slide.style.transform = reduced ? 'none' : isActive ? 'scale(1)' : 'scale(1)';
    });
  },
};
