export const BLOCK = 'booking-search';

export const DEFAULT_ADULTS = 2;

export interface Range {
  min: number;
  max: number;
}

export interface Limits {
  adults: Range;
  children: Range;
}

/** Adults always need at least one; the maximums are authored, these are the fallbacks. */
export const DEFAULT_LIMITS: Limits = { adults: { min: 1, max: 6 }, children: { min: 0, max: 3 } };

export interface Location {
  label: string;
  code: string;
}

export interface Labels {
  location: string;
  dates: string;
  guestSingular: string;
  guestPlural: string;
  adults: string;
  children: string;
  checkRates: string;
  done: string;
}

export interface BookingConfig {
  labels: Labels;
  locations: Location[];
  limits: Limits;
  bookingUrl: string;
  openInNewTab: boolean;
}

export interface Selection {
  location?: Location;
  arrival?: Date;
  departure?: Date;
  adults: number;
  children: number;
}

export type FieldKind = 'location' | 'dates' | 'guests';

export interface Field {
  kind: FieldKind;
  root: HTMLElement;
  trigger: HTMLButtonElement;
  label: HTMLElement;
  panel: HTMLElement;
}
