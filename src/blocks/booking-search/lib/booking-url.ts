import { toIso } from './dates';
import type { Selection } from './types';

const CHAIN_ID = '21430';

/** SynXis booking engine query parameters. */
const PARAM = {
  chain: 'chain',
  hotel: 'hotel',
  arrive: 'arrive',
  depart: 'depart',
  adult: 'adult',
  child: 'child',
} as const;

// Pending SynXis date-format confirmation (MM/DD/YYYY + locale vs. dateformat param).
const formatDate = (date: Date): string => toIso(date);

export function buildBookingUrl(base: string, selection: Selection, requireLocation = false): string | null {
  const { location, arrival, departure, adults, children } = selection;
  if (!arrival || !departure || (requireLocation && !location)) return null;

  let url: URL;
  try {
    url = new URL(base, window.location.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  url.searchParams.set(PARAM.chain, CHAIN_ID);
  if (location) url.searchParams.set(PARAM.hotel, location.code);
  url.searchParams.set(PARAM.arrive, formatDate(arrival));
  url.searchParams.set(PARAM.depart, formatDate(departure));
  url.searchParams.set(PARAM.adult, String(adults));
  url.searchParams.set(PARAM.child, String(children));
  return url.toString();
}
