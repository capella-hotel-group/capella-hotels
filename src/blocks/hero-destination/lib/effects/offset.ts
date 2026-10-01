// src/blocks/hero-destination/lib/effects/offset.ts
// Shortest signed distance from `activeIndex` to `index` around a circular track of `total`
// slides. Using this instead of the raw `index - activeIndex` difference is what makes looping
// from the last slide back to the first animate as a single forward step instead of visibly
// snapping/rewinding backward across every slide in between.
export function loopOffset(index: number, activeIndex: number, total: number): number {
  const raw = index - activeIndex;
  if (total <= 0) return raw;
  const half = total / 2;
  if (raw > half) return raw - total;
  if (raw < -half) return raw + total;
  return raw;
}
