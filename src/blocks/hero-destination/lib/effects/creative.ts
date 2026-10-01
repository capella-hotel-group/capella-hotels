// src/blocks/hero-destination/lib/effects/creative.ts
// A tasteful preset combining translate, scale, and rotate for a modern, non-linear transition.
import { loopOffset } from './offset';
import type { EffectController } from './types';

export const creativeEffect: EffectController = {
  init(track) {
    track.classList.add('hero-destination-effect-creative');
  },
  render(_track, slides, activeIndex) {
    slides.forEach((slide, index) => {
      const offset = loopOffset(index, activeIndex, slides.length);
      const isActive = offset === 0;
      slide.style.opacity = isActive ? '1' : '0';
      slide.style.zIndex = isActive ? '2' : '1';
      slide.style.transform = isActive
        ? 'translateY(0) scale(1) rotate(0deg)'
        : `translateY(${offset > 0 ? '6%' : '-6%'}) scale(0.9) rotate(${offset > 0 ? 2 : -2}deg)`;
    });
  },
};
