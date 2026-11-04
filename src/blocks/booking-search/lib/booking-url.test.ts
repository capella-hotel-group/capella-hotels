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

  it('builds a booking URL without a location when the location field is hidden', () => {
    expect(buildBookingUrl('https://booking.example/reservations', stay)).toBe(
      'https://booking.example/reservations?arrive=2026-07-30&depart=2026-07-31&adults=2&children=0',
    );
  });

  it('includes the selected location in a complete booking URL', () => {
    const selection = { ...stay, location: { label: 'Singapore', code: 'SIN' } };

    expect(buildBookingUrl('https://booking.example/reservations', selection, true)).toBe(
      'https://booking.example/reservations?property=SIN&arrive=2026-07-30&depart=2026-07-31&adults=2&children=0',
    );
  });
});
