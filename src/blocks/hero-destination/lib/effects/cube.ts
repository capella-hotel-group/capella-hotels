// src/blocks/hero-destination/lib/effects/cube.ts
// Slides sit as faces of a 3D cube (rotateY) that turns to bring the active face forward.
import { loopOffset } from './offset';
import type { EffectController } from './types';

export const cubeEffect: EffectController = {
  init(track) {
    track.classList.add('hero-destination-effect-cube');
  },
  render(track, slides, activeIndex) {
    const half = track.offsetWidth / 2;
    slides.forEach((slide, index) => {
      const offset = loopOffset(index, activeIndex, slides.length);
      const visible = Math.abs(offset) <= 1;
      slide.style.opacity = visible ? '1' : '0';
      slide.style.zIndex = offset === 0 ? '2' : '1';
      slide.style.transform = `rotateY(${offset * 90}deg) translateZ(${half}px)`;
    });
  },
};
