import { applyBlockIdentity } from '@/utils/block-identity';
import { BLOCK, DEFAULT_LIMITS } from './types';
import type { BookingConfig, Limits, Location } from './types';

const ITEM_MODEL = 'booking-search-location';

/** Field rows after the two identity rows — must match the order in `_booking-search.json`. Location items follow them. */
const ROW = {
  locationLabel: 0,
  datesLabel: 1,
  guestSingularLabel: 2,
  guestPluralLabel: 3,
  adultsLabel: 4,
  childrenLabel: 5,
  checkRatesLabel: 6,
  bookingUrl: 7,
  checkRatesOpenInNewTab: 8,
  doneLabel: 9,
  maxAdults: 10,
  maxChildren: 11,
  showLocation: 12,
} as const;
const CONTENT_ROWS = Object.keys(ROW).length;

/** Upper bound on an authored maximum, so a typo cannot build a huge counter. */
const MAX_ALLOWED = 20;

const cellText = (row?: Element): string => row?.textContent?.trim() || '';

const cellsOf = (row: HTMLElement): HTMLElement[] => [...row.querySelectorAll<HTMLElement>(':scope > div')];

/** Every field emits one cell, so only item rows hold several; the editor's model name wins when present. */
function isLocationRow(row: HTMLElement, editing: boolean): boolean {
  return editing ? row.dataset.aueModel === ITEM_MODEL : cellsOf(row).length > 1;
}

function parseLocation(row: HTMLElement): Location | null {
  const [labelCell, codeCell] = cellsOf(row);
  const label = cellText(labelCell);
  return label ? { label, code: cellText(codeCell) || label } : null;
}

/** Reads the authored rows and hides them, keeping them in the DOM so the editor tree stays intact. */
export function parseConfig(block: HTMLElement): BookingConfig {
  const rows = [...block.querySelectorAll<HTMLElement>(':scope > div')];
  const editing = rows.some((row) => row.dataset.aueModel);
  const locationRows = rows.filter((row) => isLocationRow(row, editing));
  const fieldRows = rows.filter((row) => !locationRows.includes(row));

  const contentRows = applyBlockIdentity(block, fieldRows, {
    contentRows: CONTENT_ROWS,
    hiddenClass: `${BLOCK}-source`,
  });
  [...contentRows, ...locationRows].forEach((row) => row.classList.add(`${BLOCK}-source`));

  const text = (index: number, fallback: string): string => cellText(contentRows[index]) || fallback;

  const maximum = (index: number, min: number, fallback: number): number => {
    const value = Number.parseInt(cellText(contentRows[index]), 10);
    return Number.isFinite(value) ? Math.min(Math.max(value, min), MAX_ALLOWED) : fallback;
  };
  const limits: Limits = {
    adults: {
      min: DEFAULT_LIMITS.adults.min,
      max: maximum(ROW.maxAdults, DEFAULT_LIMITS.adults.min, DEFAULT_LIMITS.adults.max),
    },
    children: {
      min: DEFAULT_LIMITS.children.min,
      max: maximum(ROW.maxChildren, DEFAULT_LIMITS.children.min, DEFAULT_LIMITS.children.max),
    },
  };

  return {
    labels: {
      location: text(ROW.locationLabel, 'LOCATION'),
      dates: text(ROW.datesLabel, 'ARRIVAL/DEPART'),
      guestSingular: text(ROW.guestSingularLabel, 'GUEST'),
      guestPlural: text(ROW.guestPluralLabel, 'GUESTS'),
      adults: text(ROW.adultsLabel, 'Adult'),
      children: text(ROW.childrenLabel, 'Children'),
      checkRates: text(ROW.checkRatesLabel, 'Check rates'),
      done: text(ROW.doneLabel, 'Done'),
    },
    locations: locationRows.map(parseLocation).filter((location): location is Location => !!location),
    limits,
    bookingUrl: cellText(contentRows[ROW.bookingUrl]),
    openInNewTab: cellText(contentRows[ROW.checkRatesOpenInNewTab]).toLowerCase() === 'true',
    // Rows authored before this field existed are empty, so the selector stays visible.
    showLocation: cellText(contentRows[ROW.showLocation]).toLowerCase() !== 'false',
  };
}
