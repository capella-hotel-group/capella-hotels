// src/blocks/split-media/lib/parse.ts
// Root fields retain their legacy order; newer navigation flags are appended.
import type { SplitMediaSlide } from './types';

export const ITEM_MODEL = 'split-media-slide';

const DEFAULT_INTERVAL_SECONDS = 6;

export interface CarouselConfig {
  autoplay: boolean;
  showDots: boolean;
  showControls: boolean;
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
  const autoplay = parseBoolean(configRows[0]?.children[0], true);
  // The old conditional interval could disappear; a boolean here starts the toggles.
  const hasInterval = configRows.length !== 3 || !/^(true|false|yes|no)$/i.test(cellText(configRows[1]));
  const rawInterval = Number(hasInterval ? cellText(configRows[1]) : '');
  const intervalSeconds = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : DEFAULT_INTERVAL_SECONDS;
  const toggleOffset = hasInterval ? 2 : 1;
  return {
    autoplay,
    intervalSeconds,
    showDots: parseBoolean(configRows[toggleOffset], true),
    showControls: parseBoolean(configRows[toggleOffset + 1], true),
  };
}

/** Published rows are positional; UE fields can be independently omitted or reordered. */
export function parseBlockConfig(rows: HTMLElement[]): CarouselConfig & { id: string; dataTestId: string } {
  const properties = ['id', 'dataTestId', 'autoplay', 'autoplayInterval', 'showDots', 'showControls'];
  const named = new Map<string, Element>();
  rows.forEach((row) => {
    [row, ...row.querySelectorAll('[data-aue-prop]')].forEach((element) => {
      const property = element.getAttribute('data-aue-prop');
      if (property && properties.includes(property)) named.set(property, element);
    });
  });
  if (named.size) {
    const settings = properties.slice(2).map((property) => {
      const row = document.createElement('div');
      const cell = document.createElement('div');
      cell.textContent = cellText(named.get(property));
      row.append(cell);
      return row;
    });
    return {
      ...parseCarouselConfig(settings),
      id: cellText(named.get('id')),
      dataTestId: cellText(named.get('dataTestId')),
    };
  }
  // Older fixtures can omit both identity rows. Never infer identity by subtracting
  // the new field count from the tail: that shifts legacy autoplay/interval values.
  const hasIdentity = rows.length > 0 && !/^(true|false|yes|no)$/i.test(cellText(rows[0]));
  return {
    ...parseCarouselConfig(rows.slice(hasIdentity ? 2 : 0)),
    id: hasIdentity ? cellText(rows[0]) : '',
    dataTestId: hasIdentity ? cellText(rows[1]) : '',
  };
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
