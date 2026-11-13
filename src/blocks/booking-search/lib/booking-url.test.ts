import { buildBookingUrl, toSynxisLocale } from './booking-url';
import type { Selection } from './types';

const BASE = 'https://be.synxis.com/';
const STAY_QUERY = 'arrive=2026-07-30&depart=2026-07-31&adult=2&child=0';

describe('buildBookingUrl', () => {
  const stay: Selection = {
    arrival: new Date(2026, 6, 30),
    departure: new Date(2026, 6, 31),
    adults: 2,
    children: 0,
  };
  const singapore = { ...stay, location: { label: 'Singapore', code: '75985' } };

  it('does not build a booking URL before both dates are selected', () => {
    const selection: Selection = { adults: 2, children: 0, arrival: new Date(2026, 6, 30) };

    expect(buildBookingUrl(BASE, selection)).toBeNull();
  });

  it('does not build a booking URL when the visible location has not been selected', () => {
    expect(buildBookingUrl(BASE, stay, { requireLocation: true, hotelId: '77645' })).toBeNull();
  });

  it('sends the selected location Hotel ID ahead of the block-level Hotel ID', () => {
    expect(buildBookingUrl(BASE, singapore, { requireLocation: true, hotelId: '77645', locale: 'en-US' })).toBe(
      `${BASE}?chain=21430&hotel=75985&${STAY_QUERY}&locale=en-US`,
    );
  });

  it('falls back to the block-level Hotel ID when the location field is hidden', () => {
    expect(buildBookingUrl(BASE, stay, { hotelId: '77645', locale: 'en-US' })).toBe(
      `${BASE}?chain=21430&hotel=77645&${STAY_QUERY}&locale=en-US`,
    );
  });

  it('omits the hotel when neither a location nor a block-level Hotel ID is set', () => {
    expect(buildBookingUrl(BASE, stay, { locale: 'en-US' })).toBe(`${BASE}?chain=21430&${STAY_QUERY}&locale=en-US`);
  });

  it('defaults the locale to en-US', () => {
    expect(buildBookingUrl(BASE, stay)).toBe(`${BASE}?chain=21430&${STAY_QUERY}&locale=en-US`);
  });

  it('keeps query parameters authored on the booking engine URL', () => {
    expect(buildBookingUrl(`${BASE}?currency=SGD`, stay)).toBe(
      `${BASE}?currency=SGD&chain=21430&${STAY_QUERY}&locale=en-US`,
    );
  });
});

describe('toSynxisLocale', () => {
  it.each([
    ['en', 'en-US'],
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    ['ja', 'ja-JP'],
    ['ar', 'ar-SA'],
    ['fr', 'en-US'],
  ])('maps page language %s to %s', (lang, locale) => {
    expect(toSynxisLocale(lang)).toBe(locale);
  });
});
