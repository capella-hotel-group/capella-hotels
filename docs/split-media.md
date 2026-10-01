# Split media navigation

The block retains the two-panel 1200 ms animation. Its root model fields are ordered as
`id`, `dataTestId`, `autoplay`, `autoplayInterval`, `showDots`, `showControls`.
The slide model is unchanged.

- Missing settings enable autoplay, dots and Previous/Next. Explicit `false` is respected.
- The autoplay interval defaults to 6 seconds and starts after the image/text transition finishes.
  Manual navigation restarts the full countdown. Pause remains paused until Play is selected.
- Dots and Previous/Next can be hidden independently. Pause/Play remains available when autoplay
  is enabled and there is more than one slide.
- Horizontal mouse/touch gestures work with either navigation group hidden. Release must travel
  at least 40 CSS pixels, farther horizontally than vertically. Taps do not navigate.
- Left/Right keys navigate when the carousel region is focused. Inactive slides are inert.
- Visibility, reduced motion, resize and active gestures prevent new autoplay transitions.
  Removal/replacement of the block or its track disposes timers and listeners.

Legacy published configurations with or without the conditional interval still work. UE fields
are identified by instrumentation when available; published HTML does not require instrumentation.
Configuration nodes remain in the DOM, hidden. Component JSON and runtime assets are generated
through `npm run build:json` and `npm run build`.

## Validation, 2026-09-30

- `npm test -- --runInBand`: 62 tests passed, including legacy/new parsing, all four navigation
  combinations, transition fallback, queued navigation, autoplay restart, Pause, visibility,
  reduced motion, resize, gestures, multiple instances and removal/replacement cleanup.
- `npm run lint`, TypeScript (through `npm run build`), runtime/editor build and JSON generation passed.
- Native Chrome: CMS `/test-pages/split-media-content-card` at widths 393, 834 and 1440;
  autoplay, Pause, coordinate clicks on dots, rapid destination changes and breakpoint resize.
  Buttons measure 32x32 pixels for dots and 44x44 for arrows. Mobile spacing was corrected so
  Pause is clear of the header and pagination is clear of slide CTAs.
- Local distinct-slide fixture `/drafts/split-media-hidden`: left/right touch-emulated swipes and
  mouse drag navigate with both navigation groups hidden; taps and vertical gestures do not.
- Live UE authoring has not been exercised against a pushed branch. Instrumentation retention
  and replacement lifecycle are covered by integration tests. Physical-device pinch zoom,
  screen-reader output and the remaining interaction matrix are not claimed as manual browser tests.

The local CMS/fixture pages have pre-existing missing navigation/footer fragment requests.
Browser extensions also report unrelated errors and can block `scripts/delayed.js`.
