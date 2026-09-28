// src/blocks/hero-video/lib/intro.ts
import type { IntroElements } from './types';

// Timeline (ms)
const T_PHRASE_START = 800; // unified phrase fades in
const T_PHRASE_FADE = 400; // phrase fade-in duration
const T_SPLIT_START = 2800; // phrase out → split layout in
const T_PHRASE_SLIDE = 480; // whole "See with new eyes" phrase glides intact onto its resting spot
const T_SPLIT_MOTION = 720; // "See" peels off, rising/fading, while the list rises in
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
 * 3a. The whole phrase (still one block) glides intact onto "with new eyes"'s final resting spot,
 *     temporarily overlapping the not-yet-visible destination list
 * 3b. The real prefix/suffix take over with zero visual jump; "See" peels off — rising and fading
 *     out — while the destination list fades in and rises into place — resting layout is the list
 *     + "with new eyes"
 * 4. Controls fade in at the bottom
 *
 * onBeforeSplit is called just before the split so the caller can position
 * the selector list at item 0 while still invisible.
 * onSplitStart is called once the list has settled, letting the caller assert the active
 * destination highlight.
 */
export async function runIntro(
  elements: IntroElements,
  onBeforeSplit?: () => number | null | undefined,
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
  itemList.inert = true; // keep the (invisible) destination buttons out of the tab order
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

  // Let caller position the list at item 0 before the split begins, returning that offset
  // directly (avoids re-parsing it back out of the inline style string).
  const restY = onBeforeSplit?.() ?? 0;

  // Phase 2a: slide the WHOLE phrase (still one block, "See" still attached) onto the exact spot
  // "with new eyes" will finally rest — it temporarily overlaps the not-yet-visible list area.
  suffix.style.transform = 'translate(0, 0)';
  const suffixRest = suffix.getBoundingClientRect();
  const phraseSuffixRect = phraseSuffix.getBoundingClientRect();
  const dxPhrase = suffixRest.left - phraseSuffixRect.left;
  const dyPhrase = suffixRest.top + suffixRest.height / 2 - (phraseSuffixRect.top + phraseSuffixRect.height / 2);
  const phraseTarget = `translate(calc(-50% + ${dxPhrase}px), calc(-50% + ${dyPhrase}px))`;

  const phraseSlide = introPhrase.animate([{ transform: CENTERED_TRANSLATE }, { transform: phraseTarget }], {
    duration: T_PHRASE_SLIDE,
    easing: EASE_ENTRANCE,
    fill: 'forwards',
  });
  await phraseSlide.finished.catch(() => {});
  introPhrase.style.transform = phraseTarget;
  phraseSlide.cancel();

  // Phase 2b: swap in the real suffix — it lands exactly where the phrase's tail word just
  // arrived, so it reveals with zero jump and never moves again. "See" then peels off the phrase,
  // rising and fading out, while the destination list fades in and rises into place.
  suffix.style.opacity = '1';

  const firstPrefix = phrasePrefix.getBoundingClientRect();
  prefix.style.opacity = '1';
  prefix.style.transform = 'translate(0, 0)';
  const lastPrefix = prefix.getBoundingClientRect();
  const dxPrefix = firstPrefix.left + firstPrefix.width / 2 - (lastPrefix.left + lastPrefix.width / 2);
  const dyPrefix = firstPrefix.top + firstPrefix.height / 2 - (lastPrefix.top + lastPrefix.height / 2);
  const prefixStart = `translate(${dxPrefix}px, ${dyPrefix}px)`;
  prefix.style.transform = prefixStart;
  // Reals now cover the phrase exactly — remove it instantly (display, not opacity, so a lingering
  // soft-nav opacity transition can't fade it out and reveal a ghosted double).
  introPhrase.style.display = 'none';
  introPhrase.style.opacity = '0';

  // X is frozen at dxPrefix for the whole rise (never animated back toward the right-anchored
  // rest position) so "See" glides straight up instead of sliding sideways — it's fully faded
  // out by the time it would reach that rest spot anyway, so nothing needs to land there.
  const prefixLeave = prefix.animate(
    [
      { transform: prefixStart, opacity: 1 },
      { transform: `translate(${dxPrefix}px, ${dyPrefix - PREFIX_EXIT_PX}px)`, opacity: 0 },
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

  await Promise.all([prefixLeave.finished, itemsIn.finished]).catch(() => {});

  itemList.style.opacity = '1';
  itemList.style.transform = `translateY(${restY}px)`;
  prefix.style.opacity = '0';
  prefixLeave.cancel();
  itemsIn.cancel();

  itemList.inert = false;
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
  await controlsIn.finished.catch(() => {});
  controls.style.opacity = '1';
  controlsIn.cancel();
}

/** True when the intro animation should be bypassed: reduced-motion, Universal Editor edit mode, or embedded in an iframe (UE preview). */
export function shouldSkipIntro(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  if (document.documentElement.classList.contains('adobe-ue-edit')) return true;
  if (window.self !== window.top) return true; // inside iframe (UE)
  return false;
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
  itemList.inert = false;
  controls.style.opacity = '1';
}
