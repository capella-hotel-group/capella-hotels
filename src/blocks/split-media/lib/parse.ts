// src/blocks/split-media/lib/parse.ts
// Rows (authored): 0=id, 1=dataTestId, 2=autoplay, 3=autoplayInterval, 4..n=slides. Each slide
// row authors both panels together as 5 fixed-position cells — leftMedia, leftContent,
// rightMedia, rightContent, rightCtas — one row = one complete slide, so there is no cross-row
// pairing to get wrong. See lib/types.ts for why each field's grouping prefix stops before the
// second underscore segment.
import type { SplitMediaSlide } from './types';

export const ITEM_MODEL = 'split-media-slide';

const DEFAULT_INTERVAL_SECONDS = 6;

export interface CarouselConfig {
  autoplay: boolean;
  intervalSeconds: number;
}

function cellText(cell?: Element | null): string {
  return cell?.textContent?.trim() ?? '';
}

function parseBoolean(cell: Element | null | undefined, fallback: boolean): boolean {
  const text = cellText(cell).toLowerCase();
  if (text === 'true' || text === 'yes') return true;
  if (text === 'false' || text === 'no') return false;
  return fallback;
}

export function parseCarouselConfig(configRows: HTMLElement[]): CarouselConfig {
  const autoplay = parseBoolean(configRows[0]?.children[0], false);
  const rawInterval = Number.parseFloat(cellText(configRows[1]?.children[0]));
  const intervalSeconds = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : DEFAULT_INTERVAL_SECONDS;
  return { autoplay, intervalSeconds };
}

// in the editor every slide row carries the item model; outside it we fall back to a media check
export function isItemRow(row: HTMLElement): boolean {
  if (row.dataset.aueModel) return row.dataset.aueModel === ITEM_MODEL;
  return !!row.querySelector('picture, img');
}

export function parseSlides(itemRows: HTMLElement[]): SplitMediaSlide[] {
  return itemRows.map((row) => {
    const [leftMedia, leftContent, rightMedia, rightContent, rightCtas] = [...row.children] as HTMLElement[];
    return {
      left: { mediaCell: leftMedia, contentCell: leftContent },
      right: { mediaCell: rightMedia, contentCell: rightContent, ctaCell: rightCtas },
      sourceRow: row,
    };
  });
}
