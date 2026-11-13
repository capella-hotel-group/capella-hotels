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
  locale: 'locale',
} as const;

const DEFAULT_LOCALE = 'en-US';

/** SynXis locales for the languages this site is authored in; SynXis expects `aa-AA`. */
const SYNXIS_LOCALE: Record<string, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ar: 'ar-SA',
};

export function toSynxisLocale(lang: string): string {
  if (/^[a-z]{2}-[A-Z]{2}$/.test(lang)) return lang;
  return SYNXIS_LOCALE[lang.split('-')[0] ?? ''] ?? DEFAULT_LOCALE;
}

export interface BookingUrlOptions {
  /** The location selector is visible, so a picked location is mandatory. */
  requireLocation?: boolean;
  /** Block-level Hotel ID, used when no location is picked. */
  hotelId?: string;
  locale?: string;
}

export function buildBookingUrl(
  base: string,
  selection: Selection,
  { requireLocation = false, hotelId = '', locale = DEFAULT_LOCALE }: BookingUrlOptions = {},
): string | null {
  const { location, arrival, departure, adults, children } = selection;
  if (!arrival || !departure || (requireLocation && !location)) return null;

  let url: URL;
  try {
    url = new URL(base, window.location.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const hotel = location?.code || hotelId;
  url.searchParams.set(PARAM.chain, CHAIN_ID);
  if (hotel) url.searchParams.set(PARAM.hotel, hotel);
  url.searchParams.set(PARAM.arrive, toIso(arrival));
  url.searchParams.set(PARAM.depart, toIso(departure));
  url.searchParams.set(PARAM.adult, String(adults));
  url.searchParams.set(PARAM.child, String(children));
  url.searchParams.set(PARAM.locale, locale);
  return url.toString();
}
