import { moveInstrumentation } from '@/app/scripts.js';
import { resolveDAMUrl } from '@/utils/env.js';
import { applyBlockIdentity } from '@/utils/block-identity.js';

/*
 * choose-space
 * Figma: desktop 6047:27021 (1440), tablet 6048:28586 (834), mobile 6048:30207 (393).
 *
 * Cell indices below mirror the field order of the `space-option` model. That order
 * is the contract between author and code: changing the model field list must
 * update these indices in the same commit. Cells are addressed positionally
 * because conditionally hidden and empty fields still occupy their cell, which
 * makes the index stable but makes content sniffing unreliable.
 */
const BLOCK_ROWS = { title: 0, exploreCta: 1 } as const;
// the `space-option` model id; the editor stamps it on every item row
const ITEM_MODEL = 'space-option';
const ITEM = {
  label: 0,
  thumbnail: 1,
  media: 2,
  mediaAsset: 3,
  mediaAssetMobile: 4,
  eyebrow: 5,
  title: 6,
  description: 7,
  primaryCta: 8,
  secondaryCta: 9,
} as const;

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

let blockCount = 0;

function textOf(cell?: Element | null): string {
  return cell?.textContent?.trim() || '';
}

function hasContent(cell?: Element | null): cell is Element {
  return !!cell && (!!textOf(cell) || !!cell.querySelector('picture, img, a'));
}

// in the editor the item rows are the ones carrying the item model; outside it they
// are the multi-cell rows, since every block-level field emits a single cell
function isItemRow(row: HTMLElement): boolean {
  if (row.dataset.aueModel) return row.dataset.aueModel === ITEM_MODEL;
  return row.children.length > 1;
}

/**
 * Reads an element-grouped CTA cell, which holds the label, the link and the
 * open-in-new-tab flag as separate children rather than as separate cells.
 */
function readCta(cell?: Element | null): { label: string; href: string; openInNewTab: boolean } {
  const children = [...(cell?.children || [])];
  const link = cell?.querySelector('a');
  const isFlag = (element: Element): boolean => ['true', 'false'].includes(textOf(element).toLowerCase());
  const label = children.find((element) => !element.querySelector('a') && !isFlag(element));

  return {
    label: textOf(label) || textOf(link),
    href: link?.getAttribute('href') || '',
    openInNewTab: children.some((element) => textOf(element).toLowerCase() === 'true'),
  };
}

function buildCta(cell: Element | null | undefined, variant: 'primary' | 'secondary'): HTMLAnchorElement | null {
  const { label, href, openInNewTab } = readCta(cell);
  if (!label || !href) return null;

  const link = document.createElement('a');
  link.className = `choose-space-link choose-space-link-${variant}`;
  link.href = href;
  link.textContent = label;
  if (openInNewTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  return link;
}

/** Moves a cell's children into a fresh element so no `data-aue-*` attribute is duplicated. */
function buildCopy(cell: Element | null | undefined, tag: string, className: string): HTMLElement | null {
  if (!hasContent(cell)) return null;
  const element = document.createElement(tag);
  element.className = className;
  while (cell.firstChild) element.append(cell.firstChild);
  return element;
}

/**
 * Rewrites the authored lines of a heading as `<span>` elements, since `<p>` is not
 * allowed inside `<h2>`/`<h3>`. `<p>one<br>two</p>` also becomes two spans, so a
 * heading written with soft breaks lines up with one written as separate
 * paragraphs. The stylesheet indents the second line, which only works when each
 * line is its own element.
 */
function buildHeadingLines(heading: Element): void {
  [...heading.children].forEach((element) => {
    if (!['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) return;

    const lines = [document.createDocumentFragment()];
    [...element.childNodes].forEach((node) => {
      if (node.nodeName === 'BR') lines.push(document.createDocumentFragment());
      else lines[lines.length - 1]!.append(node);
    });

    const spans = lines
      .filter((line) => line.textContent?.trim())
      .map((line) => {
        // a fresh element rather than a clone, so no data-aue-* attribute is duplicated
        const span = document.createElement('span');
        span.append(line);
        return span;
      });

    if (spans.length) element.replaceWith(...spans);
    else element.remove();
  });
}

/** Plain-text fields arrive wrapped in a paragraph, which would nest inside the element we build. */
function buildText(cell: Element | null | undefined, tag: string, className: string): HTMLElement | null {
  const text = textOf(cell);
  if (!text) return null;
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function buildVideo(
  cell: Element | null | undefined,
  mobileCell: Element | null | undefined,
  poster: string,
): HTMLVideoElement | null {
  const href = cell?.querySelector('a')?.getAttribute('href');
  if (!href) return null;

  const video = document.createElement('video');
  video.className = 'choose-space-media';
  video.muted = true;
  // of the four, `muted` is the only property that does not reflect to an attribute,
  // and both the autoplay policy and the editor's re-parse of the markup read attributes
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  if (poster) video.poster = poster;
  const description = altOf(cell);
  if (description) video.setAttribute('aria-label', description);

  const mobileHref = mobileCell?.querySelector('a')?.getAttribute('href');
  if (mobileHref) {
    const mobile = document.createElement('source');
    mobile.src = resolveDAMUrl(mobileHref);
    mobile.media = MOBILE_MEDIA_QUERY;
    video.append(mobile);
  }
  const desktop = document.createElement('source');
  desktop.src = resolveDAMUrl(href);
  video.append(desktop);

  return video;
}

/** Alt text collapses into the cell of the field it suffixes, arriving as a sibling of the picture. */
function altOf(cell?: Element | null): string {
  const img = cell?.querySelector('img');
  const authored = img?.getAttribute('alt');
  if (authored) return authored;
  const sibling = [...(cell?.children || [])].find((element) => !element.querySelector('picture, img, a'));
  return textOf(sibling);
}

function buildPicture(cell: Element | null | undefined, mobileCell: Element | null | undefined): HTMLElement | null {
  const picture = cell?.querySelector('picture');
  if (!picture) return null;
  picture.classList.add('choose-space-media');

  const img = picture.querySelector('img');
  if (img && !img.getAttribute('alt')) img.setAttribute('alt', altOf(cell));

  // The mobile asset arrives as its own <picture>; lifting its sources in front of
  // the desktop ones lets one <img> serve both without a second request.
  const mobilePicture = mobileCell?.querySelector('picture');
  if (mobilePicture) {
    const sources = [...mobilePicture.querySelectorAll('source')];
    const mobileImg = mobilePicture.querySelector('img');
    if (!sources.length && mobileImg) {
      const source = document.createElement('source');
      source.srcset = mobileImg.getAttribute('src') || '';
      sources.push(source);
    }
    sources.forEach((source) => {
      source.media = MOBILE_MEDIA_QUERY;
      picture.prepend(source);
    });
  }

  return picture;
}

interface Space {
  panel: HTMLElement;
  tab: HTMLButtonElement;
  video: HTMLVideoElement | null;
}

function buildSpace(row: Element, blockId: string, index: number): Space | null {
  const cells = [...row.children];
  const label = textOf(cells[ITEM.label]);
  const thumbnail = cells[ITEM.thumbnail]?.querySelector('picture');
  // a space just added in the editor has no content yet, but dropping it would
  // leave the author nothing to select and make the add look like it failed
  const authoring = (row as HTMLElement).dataset.aueModel === ITEM_MODEL;
  if (!label && !thumbnail && !authoring) return null;

  const panelId = `${blockId}-panel-${index}`;
  const tabId = `${blockId}-tab-${index}`;

  /* ---------- panel ---------- */

  const panel = document.createElement('div');
  panel.className = 'choose-space-panel';
  panel.id = panelId;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', tabId);
  // the panel holds the editable text, so it is the half of the pair that carries
  // the authoring instrumentation; the tab deliberately carries none
  moveInstrumentation(row, panel);

  const isVideo = textOf(cells[ITEM.media]).toLowerCase() === 'video';
  const posterImg = thumbnail?.querySelector('img');
  const media = isVideo
    ? buildVideo(cells[ITEM.mediaAsset], cells[ITEM.mediaAssetMobile], posterImg?.getAttribute('src') || '')
    : buildPicture(cells[ITEM.mediaAsset], cells[ITEM.mediaAssetMobile]);

  if (media) {
    const frame = document.createElement('div');
    frame.className = 'choose-space-panel-media';
    frame.append(media);
    panel.append(frame);
  }

  const body = document.createElement('div');
  body.className = 'choose-space-panel-body';
  const eyebrow = buildText(cells[ITEM.eyebrow], 'p', 'choose-space-eyebrow');
  const title = buildCopy(cells[ITEM.title], 'h3', 'choose-space-panel-title');
  if (title) buildHeadingLines(title);
  const description = buildCopy(cells[ITEM.description], 'div', 'choose-space-panel-description');
  if (eyebrow) body.append(eyebrow);
  if (title) body.append(title);
  if (description) body.append(description);

  const primary = buildCta(cells[ITEM.primaryCta], 'primary');
  const secondary = buildCta(cells[ITEM.secondaryCta], 'secondary');
  if (primary || secondary) {
    const links = document.createElement('div');
    links.className = 'choose-space-panel-links';
    if (primary) links.append(primary);
    if (primary && secondary) {
      const divider = document.createElement('span');
      divider.className = 'choose-space-panel-divider';
      divider.setAttribute('aria-hidden', 'true');
      links.append(divider);
    }
    if (secondary) links.append(secondary);
    body.append(links);
  }
  if (body.childElementCount) panel.append(body);

  /* ---------- tab ---------- */

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'choose-space-tab';
  tab.id = tabId;
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panelId);
  tab.dataset.index = String(index);

  const caption = label || (authoring ? `Space ${index + 1}` : '');
  if (caption) {
    // the label precedes the image in the design, so it leads in the DOM too
    const captionElement = document.createElement('span');
    captionElement.className = 'choose-space-tab-label';
    captionElement.textContent = caption;
    tab.append(captionElement);
  } else {
    tab.setAttribute('aria-label', `Space ${index + 1}`);
  }

  if (thumbnail) {
    const clone = thumbnail.cloneNode(true) as Element;
    // the clone would otherwise carry a copy of the item's data-aue-* attributes,
    // which makes the editor list every space twice in the content tree
    [clone, ...clone.querySelectorAll('*')].forEach((element) => moveInstrumentation(element, null));
    clone.classList.remove('choose-space-media');
    clone.classList.add('choose-space-tab-media');
    // the label already names the tab, so the thumbnail is decorative here
    clone.querySelector('img')?.setAttribute('alt', '');
    tab.append(clone);
  }

  return { panel, tab, video: isVideo ? (media as HTMLVideoElement | null) : null };
}

/**
 * loads and decorates the block
 * @param block The block element
 */
export default function decorate(block: HTMLElement): void {
  blockCount += 1;
  const blockId = `choose-space-${blockCount}`;
  const rows = [...block.children] as HTMLElement[];

  const itemRows = rows.filter(isItemRow);
  const blockRows = applyBlockIdentity(
    block,
    rows.filter((row) => !itemRows.includes(row)),
    { contentRows: Object.keys(BLOCK_ROWS).length },
  );

  const spaces = itemRows
    .map((row, index) => buildSpace(row, blockId, index))
    .filter((space): space is Space => space !== null);

  const stage = document.createElement('div');
  stage.className = 'choose-space-stage';
  spaces.forEach((space) => stage.append(space.panel));

  const head = document.createElement('div');
  head.className = 'choose-space-head';
  const title = buildCopy(blockRows[BLOCK_ROWS.title]?.firstElementChild, 'h2', 'choose-space-title');
  if (title) {
    buildHeadingLines(title);
    title.id = `${blockId}-title`;
    head.append(title);
  }
  const explore = buildCta(blockRows[BLOCK_ROWS.exploreCta]?.firstElementChild, 'primary');
  if (explore) {
    explore.className = 'choose-space-explore';
    head.append(explore);
  }

  const tablist = document.createElement('div');
  tablist.className = 'choose-space-tablist';
  tablist.setAttribute('role', 'tablist');
  // labelled by the visible title rather than its textContent, which runs the
  // heading's lines together ("SIGNATUREACCOMMODATION")
  if (title) tablist.setAttribute('aria-labelledby', title.id);
  else tablist.setAttribute('aria-label', 'Choose a space');
  spaces.forEach((space) => tablist.append(space.tab));

  // Figma has no prev/next controls: an overflowing list is swiped or scrolled,
  // and keyboard focus scrolls the focused tab into view
  const track = document.createElement('div');
  track.className = 'choose-space-track';
  track.append(tablist);

  const selector = document.createElement('div');
  selector.className = 'choose-space-selector';
  if (head.childElementCount) selector.append(head);
  // appended even when empty so the editor still offers the space container
  selector.append(track);

  block.textContent = '';
  if (spaces.length) block.append(stage);
  block.append(selector);

  if (!spaces.length) return;

  /* ---------- selection ---------- */

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = -1;

  const select = (index: number, reveal = true): void => {
    const next = Math.max(0, Math.min(index, spaces.length - 1));
    if (next === selected) return;
    selected = next;

    spaces.forEach((space, i) => {
      const active = i === selected;
      space.panel.classList.toggle('is-active', active);
      // the panel keeps its grid cell so it can fade out; `inert` stops it taking
      // focus during the crossfade, before `visibility` removes it
      space.panel.inert = !active;
      space.tab.classList.toggle('is-active', active);
      space.tab.setAttribute('aria-selected', String(active));
      space.tab.tabIndex = active ? 0 : -1;

      if (!space.video) return;
      if (active && !reduceMotion.matches) {
        void space.video.play().catch(() => {
          /* autoplay can still be refused; the poster stays visible */
        });
      } else {
        space.video.pause();
        space.video.currentTime = 0;
      }
    });

    // skipped on the initial pass so decorating the block never scrolls the page
    if (reveal) spaces[selected]?.tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  spaces.forEach((space, index) => {
    space.tab.addEventListener('click', () => select(index));
  });

  const STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };

  tablist.addEventListener('keydown', (event: KeyboardEvent) => {
    const step = STEPS[event.key];
    let target: number;
    if (step !== undefined) target = (selected + step + spaces.length) % spaces.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = spaces.length - 1;
    else return;

    event.preventDefault();
    select(target);
    spaces[target]?.tab.focus();
  });

  select(0, false);
  // armed a frame later so the first space appears instantly instead of fading in
  requestAnimationFrame(() => stage.classList.add('is-ready'));

  // `preload="none"` keeps the videos off the critical path; they start buffering
  // once the block is near the viewport, so switching space is not a cold start
  const videos = spaces.map((space) => space.video).filter((video): video is HTMLVideoElement => video !== null);
  const preloader = videos.length
    ? new IntersectionObserver(
        (entries, observer) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer.disconnect();
          videos.forEach((video) => {
            video.preload = 'auto';
            // a video already playing is loading anyway, and load() would restart it
            if (video.paused) video.load();
          });
        },
        { rootMargin: '200px' },
      )
    : null;
  preloader?.observe(block);

  // the editor replaces the block element on every item change, so the observer
  // must not outlive the DOM it was watching
  const parent = block.parentElement;
  if (parent) {
    const watcher = new MutationObserver(() => {
      if (block.isConnected) return;
      preloader?.disconnect();
      watcher.disconnect();
    });
    watcher.observe(parent, { childList: true });
  }

  // selecting a space in the editor rail, or editing its text inline, should
  // reveal the matching panel
  const revealFromEvent = (event: Event): void => {
    const panel = (event.target as Element | null)?.closest?.('.choose-space-panel');
    if (!panel) return;
    const index = spaces.findIndex((space) => space.panel === panel);
    if (index >= 0) select(index);
  };
  block.addEventListener('aue:ui-select', revealFromEvent);
  block.addEventListener('focusin', revealFromEvent);
}
