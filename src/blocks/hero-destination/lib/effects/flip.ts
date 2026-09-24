// src/blocks/hero-destination/lib/effects/flip.ts
// The active slide sits face-up; every other slide is flipped to its back (hidden via
// backface-visibility) so changing the active index reads as a single card flipping over.
import type { EffectController } from './types';

export const flipEffect: EffectController = {
  init(track) {
    track.classList.add('hero-destination-effect-flip');
  },
  render(_track, slides, activeIndex) {
    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.style.opacity = isActive ? '1' : '0';
      slide.style.zIndex = isActive ? '2' : '1';
      slide.style.transform = isActive ? 'rotateY(0deg)' : 'rotateY(180deg)';
    });
  },
};
