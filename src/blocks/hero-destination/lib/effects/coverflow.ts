// src/blocks/hero-destination/lib/effects/coverflow.ts
// The active slide sits centered and flat; neighbors are pushed back, tilted, and dimmed.
import { dirSign, loopOffset } from './offset';
import type { EffectController } from './types';

export const coverflowEffect: EffectController = {
  init(track) {
    track.classList.add('hero-destination-effect-coverflow');
  },
  render(track, slides, activeIndex) {
    const sign = dirSign(track);
    slides.forEach((slide, index) => {
      const offset = loopOffset(index, activeIndex, slides.length);
      const visible = Math.abs(offset) <= 2;
      slide.style.opacity = visible ? (offset === 0 ? '1' : '0.6') : '0';
      slide.style.zIndex = String(10 - Math.abs(offset));
      if (offset === 0) {
        slide.style.transform = 'translateX(0) translateZ(0) rotateY(0deg) scale(1)';
      } else {
        const direction = sign * Math.sign(offset);
        // Slides fill the track, so % of their own width equals % of the track width.
        slide.style.transform = `translateX(${sign * offset * 55}%) translateZ(-200px) rotateY(${direction * -40}deg) scale(0.75)`;
      }
    });
  },
};
