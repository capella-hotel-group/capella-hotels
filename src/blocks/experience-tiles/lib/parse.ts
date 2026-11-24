import type { ExperienceTilesSlide } from './types';

export const ITEM_MODEL = 'experience-tiles-slide';

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

const SLIDE_CELL_COUNT = 5;

/** An authored anchor name as a valid, selector-safe element id; empty when nothing usable is left. */
export function toElementId(value: string): string {
  return value
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
}

const hasMedia = (cell: HTMLElement): boolean => !!cell.querySelector('picture, img');

// The CTA cell holds only links and their open-in-new-tab flags; a richtext description may carry
// links too, but always alongside text of its own.
function isCtaCell(cell: HTMLElement): boolean {
  if (!cell.querySelector('a')) return false;
  return [...cell.children].every(
    (child) => child.querySelector('a') || /^(true|false)$/i.test(child.textContent?.trim() ?? ''),
  );
}

/**
 * A full row is mapped by position. A row with dropped cells (empty optional fields are omitted in
 * delivered HTML, and not always the same ones) is mapped by what each cell holds instead.
 */
function panelsOf(cells: HTMLElement[]): Pick<ExperienceTilesSlide, 'left' | 'right'> {
  const [leftMedia, rightMedia] = cells.filter(hasMedia);
  if (cells.length === SLIDE_CELL_COUNT || !leftMedia || !rightMedia) {
    const [lm, lc, rm, rc, rCta] = cells;
    return { left: { mediaCell: lm, contentCell: lc }, right: { mediaCell: rm, contentCell: rc, ctaCell: rCta } };
  }
  const leftIndex = cells.indexOf(leftMedia);
  const rightIndex = cells.indexOf(rightMedia);
  const leftContent = cells.slice(leftIndex + 1, rightIndex)[0];
  const rest = cells.slice(rightIndex + 1);
  const last = rest[rest.length - 1];
  const ctaCell = last && isCtaCell(last) ? rest.pop() : undefined;
  return {
    left: { mediaCell: leftMedia, contentCell: leftContent },
    right: { mediaCell: rightMedia, contentCell: rest[0], ctaCell },
  };
}

export function parseSlides(itemRows: HTMLElement[]): ExperienceTilesSlide[] {
  return itemRows.map((row) => ({ ...panelsOf([...row.children] as HTMLElement[]), sourceRow: row }));
}
