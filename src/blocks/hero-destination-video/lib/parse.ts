// src/blocks/hero-destination-video/lib/parse.ts
import { resolveDAMUrl } from '@/utils/env.js';
import type { HeroDestinationVideoConfig } from './types';

export const DEFAULT_HEADING_DELAY_MS = 1500;
/** 9 rows when introImageAlt collapses into the img alt; 10 when it renders as its own row. */
const VIDEO_ROWS_WITH_ALT = 10;

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

// Rows (single cell each): 0=introImage, 1=introImageMobile, 2=video, 3=videoMobile,
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
    introPictureCell: at(0),
    introImageAltCell: hasAltRow ? (cells[1] ?? null) : null,
    introPictureMobile: pictureAt(1),
    introPictureMobileCell: at(1),
    desktopVideoUrl,
    desktopVideoCell: at(2),
    mobileVideoUrl: cellVideoUrl(at(3)) || desktopVideoUrl,
    mobileVideoCell: at(3),
    posterPicture: pictureAt(4),
    posterCell: at(4),
    loop: parseBoolean(at(5), true),
    loopCell: at(5),
    showOverlay: parseBoolean(at(6), false),
    showOverlayCell: at(6),
    heading: cellText(at(7)),
    headingCell: at(7),
    headingDelayMs: Number.isFinite(rawDelay) && rawDelay >= 0 ? rawDelay : DEFAULT_HEADING_DELAY_MS,
    headingDelayCell: at(8),
  };
}
