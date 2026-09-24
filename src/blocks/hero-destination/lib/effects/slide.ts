// src/blocks/hero-destination/lib/effects/slide.ts
// Default effect: the active slide slides fully in while the previous one slides fully out.
import { loopOffset } from './offset';
import type { EffectController } from './types';

export const slideEffect: EffectController = {
  init(track) {
    track.classList.add('hero-destination-effect-slide');
  },
  render(_track, slides, activeIndex) {
    slides.forEach((slide, index) => {
      const offset = loopOffset(index, activeIndex, slides.length);
      slide.style.opacity = '1';
      slide.style.zIndex = index === activeIndex ? '2' : '1';
      slide.style.transform = `translateX(${offset * 100}%)`;
    });
  },
};
