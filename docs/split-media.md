# Split media navigation

The block renders one 100dvh slide at a time (100vh fallback) and keeps the two-panel
split animation. Navigation is scroll-driven: there is no autoplay, no dots and no
Previous/Next buttons. Root model fields are `id` and `dataTestId`; the slide model is
unchanged.

## Layout

- The track is `100dvh` tall and every slide covers it; no aspect ratio is applied at any
  breakpoint. Mobile and tablet stack the two panels, desktop (from 1200px) places them
  side by side.
- Heading, description and CTA share one overlay per panel. When the copy exceeds the
  available height the overlay scrolls (`overflow-y: auto`), so nothing is unreachable.
- Published descriptions keep every paragraph, list and link: after the headline is split
  off, the whole remainder moves into the description wrapper. UE descriptions are taken
  from the instrumented field.

## Navigation

- A shared scroll coordinator owns at most one block at a time. Entering from above selects
  the first slide, entering from below the last; the entry gesture is consumed to align the
  block to the viewport (within 2px) and never also changes slide.
- Wheel: vertical-dominant events only, `ctrlKey` and already-handled events ignored.
  `deltaMode` is normalised (line = 16px, page = viewport height). One step needs 40px of
  accumulated delta; a burst ends after 200ms of wheel silence, and after a step every
  remaining event is consumed until both the transition finishes and the wheel goes quiet.
- Drag: pointer events for mouse, touch listeners for touch. Release must travel at least
  40px vertically and farther vertically than horizontally; one release moves one slide.
  Taps, horizontal drags, text selection, multitouch and pinch do not navigate, and a click
  produced by a real drag is suppressed for 400ms. Tracks that own page scrolling carry
  `split-media-track--scroll` so the stylesheet can set `touch-action: pan-x pinch-zoom`
  once, for the whole gesture, instead of swapping it mid-drag. Single-slide blocks and
  Universal Editor keep `touch-action: auto`.
- Overflowing copy wins. A gesture that starts in a scrollable overlay stays with that
  overlay for its whole duration — reaching its boundary neither changes slide nor chains
  to the page. An overlay that actually overflows gets `tabindex="0"` and `role="group"`
  so keyboard users can scroll it too; the attributes are removed again when it fits.
- At the first or last slide only a fresh outward gesture releases the page; inward
  gestures still navigate. There is no loop and no queued destination: input during a
  transition is consumed, not replayed.
- Ownership is dropped when the page leaves the aligned position by scrollbar, keyboard or
  external navigation, when the tab hides, a dialog/menu opens, the window blurs, or the
  block/track is removed or replaced. No body scroll lock is used.
- Only one alignment runs per gesture, so a scroll that cannot settle within the tolerance
  can never pin the carousel to an edge slide.
- The resize guard watches track _width_ only. The track is `100dvh`, so its height also
  changes every time a mobile URL bar collapses, and reacting to that would cancel gestures
  and re-align the page mid-scroll. Both breakpoints are width-based.

## Controller

`CarouselController` takes only the slide elements and exposes `index`, `count`, `isBusy`
and `requestStep(-1 | 1)` returning `changed | edge | busy` (busy is checked before edge so
a still-animating last slide does not release the page). `select(index)` finishes any
running transition and jumps immediately — used for viewport entry and `aue:ui-select`.
Reduced motion switches state without animating. `destroy()` clears transition listeners
and fallback timers.

## Accessibility and authoring

- The block is a labelled carousel region. ArrowUp/ArrowDown navigate when the block itself
  has focus; at a boundary the default behaviour is returned, and keys inside links, inputs
  or editable content are never intercepted.
- Tab order is untouched. If the active slide holds focus when it becomes inert, focus moves
  to the block root with `preventScroll`.
- In Universal Editor scroll capture is off, all slides are visible, and `inert`/`aria-hidden`
  are not applied so authors can select any slide. Instrumentation and authored nodes are
  preserved; configuration rows stay in the DOM, hidden.
- Legacy published configurations (including a leading autoplay boolean) still parse for
  identity; retired settings are recognised and ignored.

Component JSON and runtime assets are generated with `npm run build:json` and `npm run build`.

## Validation, 2026-10-01

- `npm test -- --runInBand`: 7 suites / 48 tests covering legacy and current parsing,
  complete description rendering with instrumentation retention, `changed/edge/busy`,
  both boundaries without loop, no queueing, reduced motion, an animated transition held
  busy until both it and the wheel burst finish, cancelled transitions, width-only resize
  detection, wheel coordination (entry both directions, single entry per gesture,
  thresholds, inertia consumption, edge release, multiple instances), vertical gestures,
  keyboard, copy focusability, UE selection and removal/replacement cleanup.
- `npm run lint`, `npm run build:json` and `npm run build` (runtime + editor, including
  TypeScript) all exit 0. Generated output under `blocks/split-media/` is build-produced.
- Chrome on `/drafts/split-media` (three blocks, 3 + 3 + 1 slides, long copy, empty
  description): track height equals the viewport at 393x852, 834x1194, 1440x900 and
  844x390; panels stack below 1200px and sit side by side at 1440. Entry from above
  selects the first slide, entry from below the last; both align the block and consume the
  entry gesture. Wheel steps both ways, outward wheel at a boundary releases the page while
  inward still navigates. Overflowing copy scrolls first, its boundary does not change slide
  in the same gesture, and the next gesture does. ArrowUp/ArrowDown navigate from the block
  root. Multi-slide tracks resolve to `touch-action: pan-x pinch-zoom`, the single-slide
  block to `auto`. The overflowing overlay carries `tabindex="0"`/`role="group"` and the
  overlays that fit carry neither. No dots, arrows or pause control exist in the DOM. With
  `prefers-reduced-motion: reduce` steps are instant with no leaving state.
- Not claimed as verified: live UE authoring on a pushed branch, physical-device trackpad
  inertia and touch, screen-reader output. Synthetic events do not prove those, and the
  automation harness emits non-cancelable wheel events during its own fling animation.

The local CMS/fixture pages have pre-existing missing navigation/footer fragment requests.
Browser extensions also report unrelated errors and can block `scripts/delayed.js`.
