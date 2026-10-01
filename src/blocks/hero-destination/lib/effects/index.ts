// src/blocks/hero-destination/lib/effects/index.ts
import { cardsEffect } from './cards';
import { coverflowEffect } from './coverflow';
import { creativeEffect } from './creative';
import { cubeEffect } from './cube';
import { fadeEffect } from './fade';
import { flipEffect } from './flip';
import { slideEffect } from './slide';
import type { EffectController, EffectName } from './types';

const registry: Record<EffectName, EffectController> = {
  slide: slideEffect,
  fade: fadeEffect,
  cube: cubeEffect,
  coverflow: coverflowEffect,
  flip: flipEffect,
  creative: creativeEffect,
  cards: cardsEffect,
};

export function resolveEffect(name: string): EffectController {
  return registry[name as EffectName] ?? registry.fade;
}

export type { EffectController, EffectName } from './types';
