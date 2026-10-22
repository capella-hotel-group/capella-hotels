import { toIso } from './dates';
import type { Selection } from './types';

/** Query parameter names are placeholders until the booking engine contract is confirmed. */
export function buildBookingUrl(base: string, selection: Selection): string | null {
  let url: URL;
  try {
    url = new URL(base, window.location.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const { location, arrival, departure, adults, children } = selection;
  if (location) url.searchParams.set('property', location.code);
  if (arrival) url.searchParams.set('arrive', toIso(arrival));
  if (departure) url.searchParams.set('depart', toIso(departure));
  url.searchParams.set('adults', String(adults));
  url.searchParams.set('children', String(children));
  return url.toString();
}
