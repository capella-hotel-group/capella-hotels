import { buildBookingUrl } from './booking-url';
import type { Selection } from './types';

describe('buildBookingUrl', () => {
  const stay: Selection = {
    arrival: new Date(2026, 6, 30),
    departure: new Date(2026, 6, 31),
    adults: 2,
    children: 0,
  };

  it('does not build a booking URL before both dates are selected', () => {
    const selection: Selection = { adults: 2, children: 0, arrival: new Date(2026, 6, 30) };

    expect(buildBookingUrl('https://booking.example/reservations', selection)).toBeNull();
  });

  it('does not build a booking URL when the visible location has not been selected', () => {
    expect(buildBookingUrl('https://booking.example/reservations', stay, true)).toBeNull();
  });

  it('builds a SynXis URL with the fixed chain and no hotel when the location field is hidden', () => {
    expect(buildBookingUrl('https://be.synxis.com/', stay)).toBe(
      'https://be.synxis.com/?chain=21430&arrive=2026-07-30&depart=2026-07-31&adult=2&child=0',
    );
  });

  it('sends the selected location Hotel ID as the hotel parameter', () => {
    const selection = { ...stay, location: { label: 'Singapore', code: '75985' } };

    expect(buildBookingUrl('https://be.synxis.com/', selection, true)).toBe(
      'https://be.synxis.com/?chain=21430&hotel=75985&arrive=2026-07-30&depart=2026-07-31&adult=2&child=0',
    );
  });

  it('keeps query parameters authored on the booking engine URL', () => {
    expect(buildBookingUrl('https://be.synxis.com/?currency=SGD', stay)).toBe(
      'https://be.synxis.com/?currency=SGD&chain=21430&arrive=2026-07-30&depart=2026-07-31&adult=2&child=0',
    );
  });
});
