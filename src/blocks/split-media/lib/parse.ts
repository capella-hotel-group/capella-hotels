// src/blocks/split-media/lib/parse.ts
// Rows (authored): 0=id, 1=dataTestId, 2=autoplay, 3=autoplayInterval, 4..n=panels. Panels pair
// up sequentially two-at-a-time into slides (even index = left/hero, odd index = right/detail) —
// deliberately a flat block>row>cell model (not a nested item-of-items), since the framework's
// own wrapTextNodes() only understands exactly two levels and would otherwise squash a nested
// panel's own field cells into a single paragraph.
import type { SplitMediaPanel, SplitMediaSlide } from './types';

export const ITEM_MODEL = 'split-media-item';

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

// in the editor every panel row carries the item model; outside it we fall back to a media check
export function isItemRow(row: HTMLElement): boolean {
  if (row.dataset.aueModel) return row.dataset.aueModel === ITEM_MODEL;
  return !!row.querySelector('picture, img');
}

function parsePanel(row?: HTMLElement): SplitMediaPanel {
  if (!row) return {};
  const [mediaCell, contentCell, ctaCell] = [...row.children] as HTMLElement[];
  return { mediaCell, contentCell, ctaCell, sourceRow: row };
}

// A freshly added, still-odd trailing panel has no right-hand partner yet while an author fills
// it in — never drop it, render it with an empty placeholder partner so it stays visible and
// selectable in the editor.
export function parseSlides(itemRows: HTMLElement[]): SplitMediaSlide[] {
  const slides: SplitMediaSlide[] = [];
  for (let index = 0; index < itemRows.length; index += 2) {
    slides.push({ left: parsePanel(itemRows[index]), right: parsePanel(itemRows[index + 1]) });
  }
  return slides;
}
