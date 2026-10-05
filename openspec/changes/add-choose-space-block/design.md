## Context

The Choose Space module is a two-part composite: a full-bleed hero at the top and a selector strip
below it. The hero always shows the currently selected space, so the two parts are not independent
content — one `space-option` item feeds both. Figma models the module as a single instance
(`Content-card/choose-space`) whose `Space option` frame holds the title block and a `space listing`
of thumbnails.

Constraints that shape the design:

- AEM EDS allows only `section > block`; a block cannot nest another block. Every space must
  therefore be a child **item** of one block, not a nested block.
- The block markup arrives as a table of rows/cells. Per the verified repo row contract, a field
  whose name ends in `Title`, `Type`, `MimeType`, `Alt` or `Text` collapses into the field it
  suffixes, and `id` / `classes` produce no row at all. Conditionally hidden fields still produce
  an empty cell, so cell indexes are stable regardless of what the author fills in.
- `src/styles/tokens.css` is contractually a 1:1 mirror of the Figma variable set. New spacing
  values must land as tokens, not as literals inside the block.
- The repo is plain CSS compiled by Vite. There is no Sass or PostCSS, so no `@mixin` is available.

## Goals / Non-Goals

**Goals:**

- One authoring model that produces both the hero panel and its tab trigger from a single item.
- Desktop spacing that resolves to the exact Figma pixel values at a 1440px viewport and scales
  proportionally at other widths.
- A carousel that exists only when the tab list actually overflows, and that can be torn down
  cleanly when it no longer does.
- Image and video hero media behind one authoring switch, with video playing only while visible.
- Universal Editor stays usable: inline text editing works and selecting an item reveals it.

**Non-Goals:**

- Nested or grouped spaces (e.g. Manors › Manor A). Flat list only.
- Deep-linking a specific space via URL hash.
- Promoting `--fluid-unit` to every existing block. This change proves it on one block.
- Fixing `--dimension-spacing-heading-to-content`. Tracked separately.
- Per-item scheduling, personalisation or availability data.

## Decisions

### D1 — One block with repeatable items, rendered into two places

The block renders each item twice in the DOM: once as a hero `panel`, once as a `tab` button.

```
choose-space (block)
└─ space-option (item)  ──┬──▶  .choose-space__panel   (hero: media + copy + CTAs)
                          └──▶  .choose-space__tab     (thumbnail + label)
```

**Alternative rejected — two sibling item models** (one for hero, one for tab). The verified repo
contract allows only one varying list at a given level, and the pairing between hero and tab would
depend on authoring order, which authors can silently break.

**Alternative rejected — hero as a separate block.** Two blocks cannot coordinate selection without
DOM coupling across section boundaries, and authors would have to keep two lists in sync.

### D2 — Field naming chosen to survive the cell-collapse rule

The obvious names collapse and silently destroy cells:

- `mediaType` ends in `Type` → absorbed into `media`, losing a cell.
- `thumbnailAlt` ends in `Alt` → intentionally absorbed into `thumbnail`, which is what we want.

The block therefore reuses the naming already proven by `hero-banner`: a `media` select plus a
`mediaAsset` reference. `hero-banner` is the evidence that `media` and `mediaAsset` do not collapse
into each other — six fields produce six rows there.

**Block fields → 3 rows**

| Row | Field(s)                                                     | Component                                            |
| --- | ------------------------------------------------------------ | ---------------------------------------------------- |
| 1   | `anchorId`                                                   | text (named `anchorId` because `id` produces no row) |
| 2   | `title`                                                      | richtext                                             |
| 3   | `exploreCta` + `exploreCta_link` + `exploreCta_openInNewTab` | element group → one cell                             |

**Item `space-option` → 1 row of 10 cells**

| Cell | Field(s)                                   | Component                 | Notes                                |
| ---- | ------------------------------------------ | ------------------------- | ------------------------------------ |
| 1    | `label`                                    | text                      | tab caption                          |
| 2    | `thumbnail` + `thumbnailAlt`               | reference + text          | also serves as the video `poster`    |
| 3    | `media`                                    | select `image` \| `video` |                                      |
| 4    | `mediaAsset` + `mediaAssetAlt`             | reference + text          | required                             |
| 5    | `mediaAssetMobile`                         | reference                 | optional, falls back to `mediaAsset` |
| 6    | `eyebrow`                                  | text                      |                                      |
| 7    | `title`                                    | richtext                  |                                      |
| 8    | `description`                              | richtext                  |                                      |
| 9    | `primaryCta` + `_link` + `_openInNewTab`   | element group             |                                      |
| 10   | `secondaryCta` + `_link` + `_openInNewTab` | element group             |                                      |

Parsing reads fixed indexes from the start of the row. It must not detect cells by probing for
`picture` or by counting children — both are unreliable under this contract.

### D3 — Single DOM, reordered by breakpoint instead of duplicated markup

Desktop puts the section title and the "Explore all" link in a left column beside the tab list;
tablet and mobile stack title, tab list, then link. Rather than emitting the link twice, the head
wrapper uses `display: contents` below the desktop breakpoint so its children become direct flex
children and can be ordered around the tab list.

```
mobile / tablet                      desktop >= 1200px
.selector      flex-direction:column .selector      flex-direction:row
.selector-head display:contents      .selector-head display:flex; column
  title    order 1                     ├─ title
  tablist  order 2                     └─ exploreCta
  explore  order 3                   .tablist  order 2; flex:1; scrollable
```

Flexbox throughout, per the repo convention that CSS Grid is not used unless explicitly requested.
All inline offsets use logical properties so the module works under RTL.

### D4 — `--fluid-unit` for desktop scaling, using `vw` not `cqi`

```css
:root {
  --fluid-unit: 1px;
}
@media (width >= 1200px) {
  :root {
    --fluid-unit: calc(100vw / 1440);
  }
}
```

Consumers write `calc(296 * var(--fluid-unit))`.

| Viewport | `--fluid-unit` | `calc(296 * unit)` | `calc(80 * unit)` |
| -------- | -------------- | ------------------ | ----------------- |
| 1200px   | 0.833px        | 246.7px            | 66.7px            |
| 1440px   | 1.000px        | **296px**          | **80px**          |
| 1920px   | 1.333px        | 394.7px            | 106.7px           |

**Why `vw` and not `cqi`:** on a 1440px device with classic scrollbars, `100cqi` measures 1425px
and yields 292.9px, missing the specified 296px. `100vw` measures the device width and hits the
number exactly. The usual `100vw` overflow hazard does not apply because the unit is only consumed
by `padding`, never by `width` — padding is absorbed inside a `border-box` element, so the module
never becomes wider than its container.

**Why no upper cap:** an explicit product decision to keep scaling past 1440px.

**Why a custom property instead of a mixin:** the repo has no preprocessor. A single custom
property declared once in `tokens.css` gives the same reuse a mixin would, costs no build step, and
is inert for blocks that never reference it. Native CSS `@function` would read better but its
browser baseline must be checked before the repo depends on it.

### D5 — Carousel initialises only on measured overflow

```
      ResizeObserver(tablist)
                │  (catches zoom, font swap and container changes
                │   that a window resize listener would miss)
                ▼
      debounce 150ms trailing
                ▼
      scrollWidth > clientWidth + 1 ?
         ╱                        ╲
      yes, not inited          no, inited
         ▼                        ▼
       init()                 destroy()
   arrows + snap          remove arrows, listeners,
   + aria wiring          reset scroll position
```

- An `inited` flag makes repeated `init()` calls a no-op, so listeners are never double-bound.
- Arrow controls are appended to a **sibling** of the observed element. Mutating the observed
  element inside its own `ResizeObserver` callback would loop.
- Listener references are retained so `destroy()` can remove exactly what it added.
- Media loading changes the tab list width; the observer already covers it, so no extra `load`
  handler is needed.
- The observer is disconnected when the block leaves the DOM, which the Universal Editor does on
  every item re-render.

### D6 — Media polymorphism and playback

The `media` switch applies to the hero panel only. The tab `thumbnail` is always a still image, and
it doubles as the video poster.

`media = image` renders `<picture>`; `media = video` renders
`<video muted loop playsinline preload="none" poster="{thumbnail}">`. `mediaAssetMobile`, when
present, is attached as a `<source media="(max-width: 767px)">`; otherwise `mediaAsset` serves all
breakpoints.

Playback is bound to selection: activating a panel calls `play()`, deactivating calls `pause()` and
resets `currentTime` to 0. `preload="none"` keeps inactive panels off the network. Under
`prefers-reduced-motion: reduce` no video autoplays and the poster remains visible.

### D7 — Universal Editor instrumentation goes on the panel

`moveInstrumentation()` can only carry the `data-aue-resource` URN to one element, but each item
renders twice. The panel wins, because it holds the editable text (`eyebrow`, `title`,
`description`, CTA labels) and inline editing is the higher-value affordance. Tab buttons are
built without any `data-aue-*` attributes so the editor does not count items twice. An editor-only
hook listens for item selection and activates the matching panel, so selecting an item in the
editor rail still reveals it.

### D8 — Text is cap-trimmed, so vertical rhythm comes from measurement

Text in this project is trimmed to its cap box:

```css
text-box-trim: trim-both;
text-box-edge: cap alphabetic;
```

This removes half-leading and the descender gap, so a text element's border box is
`padding + cap-height`, not `padding + line-height`. Figma's frame heights already assume the
trimmed box, which is why Figma numbers do not reconcile with untrimmed CSS arithmetic.

Consequences for this block: apply the trim to the eyebrow, title, description, CTA links, tab
label and section title, then verify spacing by measuring against the artboard rather than by
computing it from `line-height`.

## Risks / Trade-offs

- **Completing `--component-button-padding-block` at desktop changes `destination-introduction`.**
  → Intended correction toward Figma parity, blast radius is one declaration in one file; the
  change includes a visual check of that block at desktop.

- **The Figma text link must be measured, not derived.** Verified against `Button/text-standard`
  (`I6047:27021;4214:5202;6047:25034`): the component applies `padding-block`, `gap` and
  `corner-standard` but sets no height of its own — it is `size-full` inside a `text-links` frame
  fixed at 40px, so `--component-button-height` belongs to the wrapper, not the link.
  → Do not emit `height` on the link. Its rendered height depends on cap trim
  (`text-box-trim: trim-both; text-box-edge: cap alphabetic`), which makes the content box
  cap-height rather than line-height, so the box cannot be predicted from `padding-block` and
  `line-height` alone. Measure it in the browser against the artboard.

- **`100vw` includes the scrollbar, so desktop padding is computed from a slightly wider box than
  the visible area.** → Accepted deliberately: it is what makes the 1440px device match the
  artboard. Safe because the unit never feeds `width`.

- **`display: contents` removes a box from layout.** → Only applied to a semantically empty wrapper
  `div`, so no accessibility semantics are dropped.

- **A `ResizeObserver` that mutates its own observed element loops.** → Mitigated by D5's sibling
  placement rule plus the `inited` guard; the teardown path is exercised by a resize test that
  crosses the overflow threshold in both directions.

- **Author supplies many items with heavy media.** → Only the active panel preloads; inactive
  panels use `preload="none"` and lazily loaded images.

## Migration Plan

Additive. The block does not exist yet, so there is no content to migrate and no rollback beyond
reverting the change. Token additions are new declarations; the only behavioural change outside the
block is the corrected desktop button padding, which reverts with the same commit.

## Open Questions

- None blocking. The text link box model is settled as a measurement task: no explicit height,
  `padding-block` from the token, cap trim applied, verified in the browser against the artboard.
