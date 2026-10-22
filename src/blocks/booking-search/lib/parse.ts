import { applyBlockIdentity } from '@/utils/block-identity';
import { BLOCK } from './types';
import type { BookingConfig, Location } from './types';

/** Authored rows after the two identity rows — must match the order in `_booking-search.json`. */
const ROW = {
  locationLabel: 0,
  locations: 1,
  datesLabel: 2,
  guestSingularLabel: 3,
  guestPluralLabel: 4,
  adultsLabel: 5,
  childrenLabel: 6,
  checkRatesLabel: 7,
  bookingUrl: 8,
  checkRatesOpenInNewTab: 9,
  doneLabel: 10,
} as const;
const CONTENT_ROWS = Object.keys(ROW).length;

const cellText = (row?: HTMLElement): string => row?.textContent?.trim() || '';

/** A textarea field publishes one paragraph per line, or a single text node with line breaks. */
export function parseLocations(row?: HTMLElement): Location[] {
  if (!row) return [];
  const paragraphs = [...row.querySelectorAll('p')].map((p) => p.textContent || '');
  const lines = paragraphs.length ? paragraphs : (row.textContent || '').split('\n');

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = '', code = ''] = line.split('|').map((part) => part.trim());
      return { label, code: code || label };
    });
}

/** Reads the authored rows and hides them, keeping them in the DOM so the editor tree stays intact. */
export function parseConfig(block: HTMLElement): BookingConfig {
  const rows = [...block.querySelectorAll<HTMLElement>(':scope > div')];
  const contentRows = applyBlockIdentity(block, rows, { contentRows: CONTENT_ROWS, hiddenClass: `${BLOCK}-source` });
  contentRows.forEach((row) => row.classList.add(`${BLOCK}-source`));

  const text = (index: number, fallback: string): string => cellText(contentRows[index]) || fallback;

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
    locations: parseLocations(contentRows[ROW.locations]),
    bookingUrl: cellText(contentRows[ROW.bookingUrl]),
    openInNewTab: cellText(contentRows[ROW.checkRatesOpenInNewTab]).toLowerCase() === 'true',
  };
}
