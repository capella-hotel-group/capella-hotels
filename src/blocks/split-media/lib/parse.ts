import type { SplitMediaSlide } from './types';

export const ITEM_MODEL = 'split-media-slide';

/** Ignore retired settings while retaining identity from both legacy and current CMS rows. */
export function parseBlockConfig(rows: HTMLElement[]): { id: string; dataTestId: string } {
  const named = new Map<string, Element>();
  rows.forEach((row) => {
    [row, ...row.querySelectorAll('[data-aue-prop]')].forEach((element) => {
      const property = element.getAttribute('data-aue-prop');
      if (property) named.set(property, element);
    });
  });
  const text = (element?: Element): string => element?.textContent?.trim() ?? '';
  if (named.size) return { id: text(named.get('id')), dataTestId: text(named.get('dataTestId')) };
  // Legacy fixtures without identity start with an autoplay boolean; never use it as an ID.
  if (/^(true|false|yes|no)$/i.test(text(rows[0]))) return { id: '', dataTestId: '' };
  return { id: text(rows[0]), dataTestId: text(rows[1]) };
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
