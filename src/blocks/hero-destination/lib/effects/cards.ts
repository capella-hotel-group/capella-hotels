// src/blocks/hero-destination/lib/effects/cards.ts
// Slides stack like a deck: the active card sits on top, upcoming cards peek behind it, and
// already-seen cards are discarded off to the side.
import { dirSign, loopOffset } from './offset';
import type { EffectController } from './types';

export const cardsEffect: EffectController = {
  init(track) {
    track.classList.add('hero-destination-effect-cards');
  },
  render(track, slides, activeIndex) {
    const total = slides.length;
    const sign = dirSign(track);
    slides.forEach((slide, index) => {
      const offset = loopOffset(index, activeIndex, total);
      if (offset < 0) {
        slide.style.opacity = '0';
        slide.style.zIndex = '0';
        slide.style.transform = `translateX(${sign * -120}%) rotate(${sign * -8}deg)`;
        return;
      }
      const depth = Math.min(offset, 3);
      slide.style.opacity = '1';
      slide.style.zIndex = String(total - offset);
      slide.style.transform = `translateY(${depth * 4}%) scale(${1 - depth * 0.04})`;
    });
  },
};
