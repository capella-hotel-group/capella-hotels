// src/blocks/hero-destination/lib/parse.ts
// Rows (authored): config rows have a single cell (0=autoplay, 1=autoplayInterval, 2=loop,
// 3=transitionEffect, 4=simulateTouch); item rows have one cell per item field:
//   0=mediaType, 1=image, 2=imageMobile, 3=imageAlt, 4=video, 5=videoMobile, 6=heading
import { resolveDAMUrl } from '@/utils/env.js';
import type { EffectName } from './effects/types';
import type { HeroDestinationItem } from './types';

const DEFAULT_INTERVAL_SECONDS = 3;
const DEFAULT_EFFECT: EffectName = 'fade';

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

// Looks a cell up by its authored field name (data-aue-prop) rather than position, so parsing
// keeps working if a conditional field renders an empty/absent cell (e.g. imageMobile/videoMobile
// left blank) and shifts positional indices. Falls back to `fallbackIndex` when the attribute is
// missing (e.g. content authored/copied before instrumentation was present).
function cellByProp(cells: HTMLElement[], property: string, fallbackIndex: number): HTMLElement | undefined {
  return (
    cells.find(
      (cell) =>
        cell.getAttribute('data-aue-prop') === property || !!cell.querySelector(`[data-aue-prop="${property}"]`),
    ) ?? cells[fallbackIndex]
  );
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
  return itemRows
    .map((row): HeroDestinationItem | null => parseItem([...row.children] as HTMLElement[], row))
    .filter((item): item is HeroDestinationItem => item !== null);
}

// Current model: mediaType, image, imageMobile, imageAlt, video, videoMobile, heading (7 cells).
// Cells are looked up by data-aue-prop (see cellByProp) since an empty conditional field can
// render an absent/empty cell and shift positional indices — e.g. after switching mediaType or
// leaving the optional mobile fields blank.
// Content authored before the mediaType/mobile fields were added (image [+ imageAlt] + heading,
// 2-3 cells) is parsed as an image item: the last cell is the heading, the first cell containing
// a <picture> is the image, and any other plain-text cell is the alt text.
function parseItem(cells: HTMLElement[], row: HTMLElement): HeroDestinationItem | null {
  if (cells.length >= 7) {
    const mediaTypeCell = cellByProp(cells, 'mediaType', 0);
    const headingCell = cellByProp(cells, 'heading', 6);
    const heading = cellText(headingCell);
    if (!heading) return null;

    if (cellText(mediaTypeCell).toLowerCase() === 'video') {
      const desktopVideoUrl = cellVideoUrl(cellByProp(cells, 'video', 4));
      if (!desktopVideoUrl) return null;
      const mobileVideoUrl = cellVideoUrl(cellByProp(cells, 'videoMobile', 5)) || desktopVideoUrl;
      return { mediaType: 'video', desktopVideoUrl, mobileVideoUrl, heading, sourceRow: row };
    }

    const desktopPicture = cellByProp(cells, 'image', 1)?.querySelector('picture');
    if (!desktopPicture) return null;
    const mobilePicture = cellByProp(cells, 'imageMobile', 2)?.querySelector('picture') ?? null;
    const imageAlt = cellText(cellByProp(cells, 'imageAlt', 3));
    return { mediaType: 'image', desktopPicture, mobilePicture, imageAlt, heading, sourceRow: row };
  }

  const headingCell = cells[cells.length - 1];
  const heading = cellText(headingCell);
  const desktopPicture = cells.find((cell) => cell.querySelector('picture'))?.querySelector('picture');
  if (!heading || !desktopPicture) return null;

  const altCell = cells.find((cell) => cell !== headingCell && !cell.querySelector('picture'));
  return {
    mediaType: 'image',
    desktopPicture,
    mobilePicture: null,
    imageAlt: cellText(altCell),
    heading,
    sourceRow: row,
  };
}
