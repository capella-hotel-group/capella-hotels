// src/blocks/hero-destination/lib/parse.ts
// Rows (authored): config rows have a single cell (0=autoplay, 1=autoplayInterval, 2=loop,
// 3=transitionEffect, 4=simulateTouch); item rows carry mediaType, image, imageMobile, imageAlt,
// video, videoMobile, showOverlay, heading fields, but conditionally-hidden fields can drop their cell from
// the row entirely — see parseItem for how cells are matched by content instead of position.
import { resolveDAMUrl } from '@/utils/env.js';
import type { EffectName } from './effects/types';
import type { HeroDestinationItem, HeroDestinationVideoConfig } from './types';

const DEFAULT_INTERVAL_SECONDS = 3;
const DEFAULT_EFFECT: EffectName = 'fade';
const BOOLEAN_TEXTS = ['true', 'false', 'yes', 'no'];

export interface CarouselConfig {
  autoplay: boolean;
  loop: boolean;
  intervalSeconds: number;
  transitionEffect: string;
  simulateTouch: boolean;
}

function cellText(cell?: Element | null): string {
  return cell?.textContent?.trim() ?? '';
}

function cellVideoUrl(cell?: Element | null): string {
  const href = cell?.querySelector('a')?.getAttribute('href') ?? '';
  return href ? resolveDAMUrl(href) : '';
}

function parseBoolean(cell: Element | null | undefined, fallback: boolean): boolean {
  const text = cellText(cell).toLowerCase();
  if (text === 'true' || text === 'yes') return true;
  if (text === 'false' || text === 'no') return false;
  return fallback;
}

export function parseCarouselConfig(configRows: HTMLElement[]): CarouselConfig {
  const autoplay = parseBoolean(configRows[0]?.children[0], true);
  const rawInterval = Number.parseFloat(cellText(configRows[1]?.children[0]));
  const intervalSeconds = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : DEFAULT_INTERVAL_SECONDS;
  const loop = parseBoolean(configRows[2]?.children[0], true);
  const transitionEffect = cellText(configRows[3]?.children[0]).toLowerCase() || DEFAULT_EFFECT;
  const simulateTouch = parseBoolean(configRows[4]?.children[0], true);
  return { autoplay, loop, intervalSeconds, transitionEffect, simulateTouch };
}

export function parseItems(itemRows: HTMLElement[]): HeroDestinationItem[] {
  return itemRows.map((row) => parseItem([...row.children] as HTMLElement[], row));
}

// Model: mediaType, image, imageMobile, imageAlt, video, videoMobile, heading. mediaType and
// heading are never conditionally hidden, so they're always the first/last cell — but a hidden
// field's cell can be dropped from the authored row entirely (observed in real delivery HTML,
// not just the editor), shifting every position after it. So instead of trusting fixed offsets,
// cells are identified by what they actually contain: a <picture> means an image cell, an <a
// href> means a video-link cell, anything else is the alt text. mediaType wins when both image
// and video data are present (e.g. an author switched mediaType but left stale image refs behind).
// Content authored before mediaType existed (image [+ imageAlt] + heading, 2-3 cells) has no
// mediaType cell and is parsed the same way as a plain image item.
// Never returns null: a row with no resolvable media (e.g. a just-added, still-empty item) still
// needs to render so it stays visible and selectable in Universal Editor.
function parseItem(cells: HTMLElement[], row: HTMLElement): HeroDestinationItem {
  const headingCell = cells[cells.length - 1];
  const heading = cellText(headingCell);

  // showOverlay sits right before heading; legacy rows without it default to showing the overlay.
  const overlayCandidate = cells.length > 2 ? cells[cells.length - 2] : undefined;
  const overlayCell = BOOLEAN_TEXTS.includes(cellText(overlayCandidate).toLowerCase()) ? overlayCandidate : undefined;
  const showOverlay = parseBoolean(overlayCell, true);

  const mediaType = cellText(cells[0]).toLowerCase();
  const otherCells = cells.slice(0, -1).filter((cell) => cell !== overlayCell);
  const pictureCells = otherCells.filter((cell) => cell.querySelector('picture'));
  const videoCells = otherCells.filter((cell) => cellVideoUrl(cell));

  const isVideo =
    mediaType === 'video' || (mediaType !== 'image' && videoCells.length > 0 && pictureCells.length === 0);

  if (isVideo) {
    const desktopVideoUrl = cellVideoUrl(videoCells[0]);
    if (desktopVideoUrl) {
      const mobileVideoUrl = cellVideoUrl(videoCells[1]) || desktopVideoUrl;
      return { mediaType: 'video', desktopVideoUrl, mobileVideoUrl, heading, showOverlay, sourceRow: row };
    }
  } else {
    const desktopPicture = pictureCells[0]?.querySelector('picture');
    if (desktopPicture) {
      const mobilePicture = pictureCells[1]?.querySelector('picture') ?? null;
      const altCell = otherCells.find((cell) => cell !== cells[0] && !pictureCells.includes(cell));
      return {
        mediaType: 'image',
        desktopPicture,
        mobilePicture,
        imageAlt: cellText(altCell),
        heading,
        showOverlay,
        sourceRow: row,
      };
    }
  }

  return { mediaType: 'empty', heading, showOverlay, sourceRow: row };
}

export const DEFAULT_HEADING_DELAY_MS = 1500;
/** 9 rows when introImageAlt collapses into the img alt; 10 when it renders as its own row. */
const VIDEO_ROWS_WITH_ALT = 10;

// Video variant rows (single cell each): 0=introImage, 1=introImageMobile, 2=video, 3=videoMobile,
// 4=poster, 5=loop, 6=showOverlay, 7=heading, 8=headingDelay. Slots are positional but each one is
// content-checked (picture / link), so a stray value in the wrong slot is ignored.
export function parseVideoHero(rows: HTMLElement[]): HeroDestinationVideoConfig {
  const cells = rows.map((row) => (row.children[0] as HTMLElement | undefined) ?? null);
  const hasAltRow = rows.length >= VIDEO_ROWS_WITH_ALT;
  const at = (slot: number): HTMLElement | null => cells[slot > 0 && hasAltRow ? slot + 1 : slot] ?? null;
  const pictureAt = (slot: number): HTMLPictureElement | null => at(slot)?.querySelector('picture') ?? null;

  const introPicture = pictureAt(0);
  const altText = hasAltRow ? cellText(cells[1]) : '';
  if (introPicture && altText) introPicture.querySelector('img')?.setAttribute('alt', altText);

  const desktopVideoUrl = cellVideoUrl(at(2));
  const rawDelay = Number.parseInt(cellText(at(8)), 10);

  return {
    introPicture,
    introPictureMobile: pictureAt(1),
    desktopVideoUrl,
    mobileVideoUrl: cellVideoUrl(at(3)) || desktopVideoUrl,
    posterPicture: pictureAt(4),
    loop: parseBoolean(at(5), true),
    showOverlay: parseBoolean(at(6), true),
    heading: cellText(at(7)),
    headingCell: at(7),
    headingDelayMs: Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay : DEFAULT_HEADING_DELAY_MS,
  };
}
