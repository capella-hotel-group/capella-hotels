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

- A shared scroll coordinator owns at most one block at a time. It claims the block as soon
  as the block is within a quarter of a viewport of the alignment point and the page is
  still travelling towards it, then settles it onto the viewport top with an eased animation
  whose duration scales with the travel (instant under `prefers-reduced-motion`, with a timer
  fallback because background tabs freeze animation frames). Distance, not wheel delta, is
  the trigger: trackpads emit a few pixels per event
  and a delta-sized window would let the block slip past. The direction rule keeps a block
  the user has already left from grabbing the page back.
- Entering from above selects the first slide, entering from below the last; the entry
  gesture is consumed to align the block (within 2px) and never also changes slide.
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
- Because that `touch-action` also suppresses native vertical panning, a touch gesture the
  block cannot consume — at the first or last slide, or anywhere the block is not yet
  aligned — is carried by the block itself: it drags the page 1:1 and runs its own momentum
  on release, checking every frame whether a block has entered the snap band. A swipe that
  starts on a link still scrolls; the 6px recognition threshold and the click suppression
  keep the tap working. Mouse drags never scroll the page.
- Overflowing copy wins. A gesture that starts in a scrollable overlay stays with that
  overlay for its whole duration — reaching its boundary neither changes slide nor chains
  to the page. An overlay that actually overflows gets `tabindex="0"`, `role="group"` and
  `split-media-overlay--scrollable`, which is what carries `overflow-y: auto`. There is
  deliberately no `overscroll-behavior` on it: the scrolling is JS-driven on both the wheel
  and the touch path, so containment would only ever fire once the coordinator had already
  released the page, trapping the reader at the bottom of a long copy block. Copy that fits
  is never a scroll container at all.
- At the first or last slide only a fresh outward gesture releases the page; inward
  gestures still navigate. There is no loop and no queued destination: input during a
  transition is consumed, not replayed.
- Ownership is dropped when the page leaves the aligned position by scrollbar, keyboard or
  external navigation, when the tab hides, a dialog/menu opens, the window blurs, or the
  block/track is removed or replaced. No body scroll lock is used.
- Only one alignment runs per gesture, so a scroll that cannot settle within the tolerance
  can never pin the carousel to an edge slide. Chrome keeps animating its wheel fling after
  `preventDefault`, so while a burst is still live the coordinator re-settles the block
  instead of handing the page back; ownership is only released once the wheel goes quiet.
- The resize guard watches track _width_ only, on both the `ResizeObserver` and the
  `window.resize` path. The track is `100dvh`, so its height also changes every time a
  mobile URL bar collapses — and that fires `resize` just as it fires the observer, so a
  guard on only one of them would still cancel gestures and re-align the page mid-scroll.
  Both breakpoints are width-based.

### Tuning

The knobs live at the top of `src/blocks/split-media/lib/scroll-controller.ts`. They are
ratios and durations, never per-breakpoint pixel sizes, so one set covers every device.

| Constant                                      | Decides                                                       | Lower it                                        | Raise it                                    |
| --------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| `ALIGN_TOLERANCE` (3px)                       | slop that still counts as aligned                             | ownership drops right after snapping            | snap sits visibly off the edge              |
| `WHEEL_THRESHOLD` (40px)                      | wheel accumulated per slide step                              | trigger-happy, easy to overshoot                | needs a deliberate flick                    |
| `WHEEL_IDLE_MS` (200ms)                       | silence that ends a burst                                     | trackpad inertia leaks through and skips slides | slower to hand the page back at a boundary  |
| `SETTLE_MIN_MS` / `SETTLE_MAX_MS` (220/620ms) | bounds of the ease-out that lands the block, scaled by travel | abrupt snap                                     | sluggish, the user can out-scroll it        |
| `FLING_DECAY` (0.95)                          | survival per 16ms of the touch momentum the block runs itself | stops dead on release                           | glides far past the intended slide          |
| `SNAP_DISTANCE` (0.25)                        | how far from the alignment point a block may still be claimed | block parks near the top and never snaps        | grabs the page early, long involuntary jump |

`SNAP_DISTANCE` is the one authors notice. The block is claimed from
`|top| <= value x viewport`, so 0.25 snaps once roughly three quarters of a `100dvh` block
is on screen — the same feel everywhere because the trigger is a share, not a pixel count.
It must never be compared against the wheel delta: trackpads emit a few pixels per event and
the block would slip past unsnapped.

`ALIGN_TOLERANCE` is 3px rather than 1px because iOS reports a fractional `100dvh`
(e.g. 745.5) and browser zoom adds its own rounding. The settle duration scales with the
travel between `SETTLE_MIN_MS` and `SETTLE_MAX_MS` so that a few pixels of correction and a
near-viewport jump do not share one timing; `SETTLE_MAX_MS` also drives the x3 fallback
timer. `WHEEL_THRESHOLD` and `WHEEL_IDLE_MS` only affect pointer devices — touch runs
through the drag path, which has its own 40px release threshold in `gesture.ts`.

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
