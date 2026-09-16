// src/blocks/hero-video/lib/intro.ts
import type { IntroElements } from './types';

// Timeline (ms)
const T_PHRASE_START = 800; // unified phrase fades in
const T_PHRASE_FADE = 400; // phrase fade-in duration
const T_SPLIT_START = 2800; // phrase out → split layout in
const T_SPLIT_MOTION = 720; // words glide from the phrase to their split spots; list rises in
const T_CONTROLS_GAP = 180; // pause after the split settles before controls fade in
const T_CONTROLS_FADE = 320; // controls fade-in duration
const PHRASE_LIFT_PX = 28;
const PREFIX_EXIT_PX = 64; // "See" ends this far up as it fades out
const ITEMS_RISE_PX = 28; // list rises this far as it fades in
const EASE_ENTRANCE = 'cubic-bezier(0.22, 1, 0.36, 1)'; // soft ease-out for the slide + rise
const EASE_THROUGH = 'cubic-bezier(0.5, 0, 0.2, 1)'; // "See" gliding up and out
const CENTERED_TRANSLATE = 'translate(-50%, -50%)';

function centeredTranslateWithYOffset(yOffsetPx: number): string {
  return `translate(-50%, calc(-50% + ${yOffsetPx}px))`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the full intro animation sequence:
 * 1. Video plays with no UI
 * 2. "See with new eyes" fades in as one centered phrase
 * 3. Phrase crossfades out; "See" rises up through the center (fading in then out) while the
 *    destination list fades in and rises to meet it — resting layout is the list + "with new eyes"
 * 4. Controls fade in at the bottom
 *
 * onBeforeSplit is called just before the split so the caller can position
 * the selector list at item 0 while still invisible.
 * onSplitStart is called once the list has settled, letting the caller assert the active
 * destination highlight.
 */
export async function runIntro(
  elements: IntroElements,
  onBeforeSplit?: () => void,
  onSplitStart?: () => void,
): Promise<void> {
  const { introPhrase, phrasePrefix, phraseSuffix, prefix, suffix, itemList, controls } = elements;

  // Initial state: everything hidden
  introPhrase.style.display = '';
  introPhrase.style.opacity = '0';
  introPhrase.style.transform = centeredTranslateWithYOffset(PHRASE_LIFT_PX);
  prefix.style.display = '';
  prefix.style.opacity = '0';
  suffix.style.opacity = '0';
  itemList.style.opacity = '0';
  controls.style.opacity = '0';

  // Phase 1: fade in unified phrase
  await delay(T_PHRASE_START);
  const phraseIn = introPhrase.animate(
    [
      { opacity: 0, transform: centeredTranslateWithYOffset(PHRASE_LIFT_PX) },
      { opacity: 1, transform: CENTERED_TRANSLATE },
    ],
    {
      duration: T_PHRASE_FADE,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards',
    },
  );
  await phraseIn.finished.catch(() => {});
  introPhrase.style.opacity = '1';
  introPhrase.style.transform = CENTERED_TRANSLATE;
  phraseIn.cancel();

  // Wait until crossfade start
  await delay(T_SPLIT_START - T_PHRASE_START - T_PHRASE_FADE);

  // Let caller position the list at item 0 before the split begins.
  onBeforeSplit?.();

  // Phase 2: hand the phrase's words off to the split layout WITHOUT re-fading. The real prefix
  // and suffix appear at opacity 1 directly over their phrase counterparts (FLIP), then glide to
  // their split spots — "See" continues up and out, "with new eyes" slides beside the list — while
  // the list fades in and rises. The phrase fades out underneath, hidden by the reals.
  const restMatch = /translateY\(([-\d.]+)px\)/.exec(itemList.style.transform);
  const restMatchValue = restMatch?.[1];
  const restY = restMatchValue ? parseFloat(restMatchValue) : 0;

  // FIRST: where each word sits inside the centered phrase.
  const firstPrefix = phrasePrefix.getBoundingClientRect();
  const firstSuffix = phraseSuffix.getBoundingClientRect();

  // LAST: reveal the reals at their natural split positions and measure. Kept synchronous with the
  // invert below (only getBoundingClientRect between) so this natural state is never painted.
  prefix.style.opacity = '1';
  prefix.style.transform = 'translate(-50%, 0)';
  suffix.style.opacity = '1';
  suffix.style.transform = 'translateY(0)';
  const lastPrefix = prefix.getBoundingClientRect();
  const lastSuffix = suffix.getBoundingClientRect();

  // INVERT: offset the reals onto the phrase words ("See" by center; the suffix by left edge so
  // its trailing icon doesn't skew the text alignment).
  const dxPrefix = firstPrefix.left + firstPrefix.width / 2 - (lastPrefix.left + lastPrefix.width / 2);
  const dyPrefix = firstPrefix.top + firstPrefix.height / 2 - (lastPrefix.top + lastPrefix.height / 2);
  const dxSuffix = firstSuffix.left - lastSuffix.left;
  const dySuffix = firstSuffix.top + firstSuffix.height / 2 - (lastSuffix.top + lastSuffix.height / 2);
  const prefixStart = `translate(calc(-50% + ${dxPrefix}px), ${dyPrefix}px)`;
  const suffixStart = `translate(${dxSuffix}px, ${dySuffix}px)`;
  prefix.style.transform = prefixStart;
  suffix.style.transform = suffixStart;
  // Reals now cover the phrase words exactly — remove it instantly (display, not opacity, so a
  // lingering soft-nav opacity transition can't fade it out and reveal a ghosted double).
  introPhrase.style.display = 'none';
  introPhrase.style.opacity = '0';

  // PLAY.
  const suffixSlide = suffix.animate([{ transform: suffixStart }, { transform: 'translate(0, 0)' }], {
    duration: T_SPLIT_MOTION,
    easing: EASE_ENTRANCE,
    fill: 'forwards',
  });
  const prefixLeave = prefix.animate(
    [
      { transform: prefixStart, opacity: 1 },
      { transform: `translate(-50%, -${PREFIX_EXIT_PX}px)`, opacity: 0 },
    ],
    { duration: T_SPLIT_MOTION, easing: EASE_THROUGH, fill: 'forwards' },
  );
  const itemsIn = itemList.animate(
    [
      { opacity: 0, transform: `translateY(${restY + ITEMS_RISE_PX}px)` },
      { opacity: 1, transform: `translateY(${restY}px)` },
    ],
    { duration: T_SPLIT_MOTION, easing: EASE_ENTRANCE, fill: 'forwards' },
  );

  await Promise.all([suffixSlide.finished, prefixLeave.finished, itemsIn.finished]).catch(() => {});

  introPhrase.style.opacity = '0';
  introPhrase.style.display = 'none';
  itemList.style.opacity = '1';
  itemList.style.transform = `translateY(${restY}px)`;
  suffix.style.opacity = '1';
  suffix.style.transform = 'translateY(0)';
  prefix.style.opacity = '0';
  suffixSlide.cancel();
  prefixLeave.cancel();
  itemsIn.cancel();

  // List is in place — assert the active destination highlight (inline styles pre-set it, so this
  // only keeps SelectorUI's state in sync).
  onSplitStart?.();

  // Phase 3: fade in controls
  await delay(T_CONTROLS_GAP);
  const controlsIn = controls.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: T_CONTROLS_FADE,
    easing: 'ease-out',
    fill: 'forwards',
  });
  controlsIn.finished
    .then(() => {
      controls.style.opacity = '1';
      controlsIn.cancel();
    })
    .catch(() => {});

  // Wait until controls finish before unlocking interaction
  await delay(T_CONTROLS_FADE);
}

/**
 * Skip intro — jump to final state immediately.
 * Used for: prefers-reduced-motion, Universal Editor context.
 */
export function skipIntro(elements: IntroElements): void {
  const { introPhrase, prefix, suffix, itemList, controls } = elements;
  introPhrase.style.opacity = '0';
  introPhrase.style.display = 'none';
  prefix.style.opacity = '0';
  prefix.style.display = '';
  suffix.style.opacity = '1';
  suffix.style.transform = '';
  itemList.style.opacity = '1';
  controls.style.opacity = '1';
}
