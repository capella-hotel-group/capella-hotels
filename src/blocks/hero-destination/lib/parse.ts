// src/blocks/hero-destination/lib/parse.ts
// Rows (authored): config rows have a single cell (0=autoplay, 1=autoplayInterval, 2=loop,
// 3=transitionEffect, 4=simulateTouch); item rows carry mediaType, image, imageMobile, imageAlt,
// video, videoMobile, showOverlay, heading fields, but conditionally-hidden fields can drop their cell from
// the row entirely — see parseItem for how cells are matched by content instead of position.
import { resolveDAMUrl } from '@/utils/env.js';
import type { EffectName } from './effects/types';
import type { HeroDestinationIntro, HeroDestinationItem } from './types';

const DEFAULT_INTERVAL_SECONDS = 3;
const DEFAULT_EFFECT: EffectName = 'fade';
const BOOLEAN_TEXTS = ['true', 'false', 'yes', 'no'];
const CONFIG_ROW_COUNT = 5;

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
        imageAlt: cellText(altCell) || desktopPicture.querySelector('img')?.getAttribute('alt') || '',
        heading,
        showOverlay,
        sourceRow: row,
      };
    }
  }

  return { mediaType: 'empty', heading, showOverlay, sourceRow: row };
}

export interface SplitBlockRowsResult {
  introRows: HTMLElement[];
  configRows: HTMLElement[];
}

export function splitBlockRows(rows: HTMLElement[]): SplitBlockRowsResult {
  // Config rows consist of exactly 5 rows. Everything before them is intro.
  // Short legacy config (< 5 rows) are treated as config (not intro) to preserve position.
  const configStartIndex = rows.length >= CONFIG_ROW_COUNT ? rows.length - CONFIG_ROW_COUNT : 0;
  return {
    introRows: rows.slice(0, configStartIndex),
    configRows: rows.slice(configStartIndex),
  };
}

export function parseIntro(introRows: HTMLElement[]): HeroDestinationIntro | null {
  if (introRows.length === 0) return null;

  interface PictureInfo {
    element: HTMLPictureElement;
    rowIndex: number;
  }

  const picturesByRow: PictureInfo[] = [];
  let altText = '';

  // Find all pictures and track which row they came from, also find any alt text
  for (let rowIdx = 0; rowIdx < introRows.length; rowIdx++) {
    const row = introRows[rowIdx];
    if (!row) continue;
    const cells = [...row.children] as HTMLElement[];
    for (const cell of cells) {
      const picture = cell.querySelector('picture') as HTMLPictureElement;
      if (picture) {
        picturesByRow.push({ element: picture, rowIndex: rowIdx });
      } else {
        const text = cellText(cell);
        if (text) {
          altText = text;
        }
      }
    }
  }

  // If no pictures at all, return null
  if (picturesByRow.length === 0) return null;

  // Create new picture elements with the alt text applied
  const createPictureWithAlt = (picture: HTMLPictureElement): HTMLPictureElement => {
    const newPicture = picture.cloneNode(true) as HTMLPictureElement;
    const img = newPicture.querySelector('img');
    if (img && altText) {
      img.setAttribute('alt', altText);
    }
    return newPicture;
  };

  // Assign pictures based on row index:
  // - Picture in row 0 is desktop
  // - Picture in row 1+ (second or later) is mobile
  // - If only one picture in row 0, it's desktop
  // - If only one picture in row 1+, it's mobile-only (desktop is null)
  const firstPic = picturesByRow[0];
  const secondPic = picturesByRow[1];

  if (!firstPic) return null;

  return {
    desktop: firstPic.rowIndex === 0 ? createPictureWithAlt(firstPic.element) : null,
    mobile:
      secondPic?.element || (firstPic.rowIndex > 0 ? firstPic.element : undefined)
        ? createPictureWithAlt(secondPic?.element || firstPic.element)
        : null,
  };
}
