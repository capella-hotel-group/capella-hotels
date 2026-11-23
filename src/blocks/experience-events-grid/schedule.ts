import type { FilterGridCard } from '@/blocks/filters-grid/filters-grid.js';

export interface EventCard extends FilterGridCard {
  schedulefrequencyLabel?: string | null;
  durationType?: string | null;
  pricingType?: string | null;
  pushToTop?: boolean | null;
  scheduleType?: string | null;
  availabilityStartDate?: string | null;
  availabilityEndDate?: string | null;
  weekdays?: string[] | null;
  weekOfMonth?: string | null;
  scheduleTimeZone?: string | null;
}

export interface DateRange {
  from: string;
  to: string;
}

interface LocalMoment {
  date: string;
  time: string;
}

type ScheduleType = 'fixed-date' | 'daily' | 'weekly' | 'monthly-weekday' | 'by-arrangement' | '';

export interface ScheduledEvent {
  card: EventCard;
  type: ScheduleType;
  zone: string;
  start?: LocalMoment;
  end?: LocalMoment;
  startInstant?: number;
  endInstant?: number;
  days: number[];
  week?: number;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEK_NAMES = ['first', 'second', 'third', 'fourth', 'last'];
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let value = formatters.get(zone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(zone, value);
  }
  return value;
}

function localMoment(date: Date, zone: string): LocalMoment {
  const parts = formatter(zone).formatToParts(date);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === name)!.value;
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}:${part('second')}`,
  };
}

function parseMoment(value: string | null | undefined, zone: string): LocalMoment | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Availability dates must be ISO date-times with a time-zone offset.');
  }
  if (!isCalendarDate(value.slice(0, 10))) throw new Error('Availability contains an invalid calendar date.');
  return localMoment(new Date(value), zone);
}

function momentKey(value: LocalMoment): string {
  return `${value.date}T${value.time}`;
}

export function isCalendarDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function prepareEvent(card: EventCard): ScheduledEvent {
  const type = card.scheduleType?.trim().toLowerCase() || '';
  if (!['', 'fixed-date', 'daily', 'weekly', 'monthly-weekday', 'by-arrangement'].includes(type)) {
    throw new Error(`Unknown Schedule Type "${type}".`);
  }
  if (!type && (card.availabilityStartDate || card.availabilityEndDate)) {
    throw new Error('Choose a Schedule Type for the authored availability dates.');
  }
  const zone = card.scheduleTimeZone?.trim() || '';
  if (type && !zone) throw new Error('Schedule Time Zone is required for scheduled experiences.');
  if (zone) formatter(zone);
  const start = parseMoment(card.availabilityStartDate, zone);
  const end = parseMoment(card.availabilityEndDate, zone);
  const startInstant = start ? Date.parse(card.availabilityStartDate!) : undefined;
  const endInstant = end ? Date.parse(card.availabilityEndDate!) : undefined;
  if (type && type !== 'by-arrangement' && !start) {
    throw new Error('Availability Start Date is required for this schedule.');
  }
  if (startInstant !== undefined && endInstant !== undefined && endInstant < startInstant) {
    throw new Error('Availability End Date must not precede Availability Start Date.');
  }
  const days = (card.weekdays || []).map((day) => DAY_NAMES.indexOf(day.trim().toLowerCase()));
  if (['weekly', 'monthly-weekday'].includes(type) && (!days.length || days.some((day) => day < 0))) {
    throw new Error('Choose valid Weekday(s) for this schedule.');
  }
  const week = WEEK_NAMES.indexOf(card.weekOfMonth?.trim().toLowerCase() || '');
  if (type === 'monthly-weekday' && (days.length !== 1 || week < 0)) {
    throw new Error('Monthly Weekday requires exactly one weekday and a Week of Month.');
  }
  return { card, type: type as ScheduleType, zone, start, end, startInstant, endInstant, days, week };
}

// Recurrence uses wall-clock time in the hotel's zone, not the visitor's zone or a fixed UTC offset.
function occurrenceInstant(date: string, time: string, zone: string): number | undefined {
  const wall = Date.parse(`${date}T${time}Z`);
  const candidates = [-1, 0, 1].flatMap((day) => {
    const reference = wall + day * 86_400_000;
    const observed = localMoment(new Date(reference), zone);
    const offset = Date.parse(`${momentKey(observed)}Z`) - reference;
    const instant = wall - offset;
    const candidate = localMoment(new Date(instant), zone);
    return candidate.date === date && candidate.time === time ? [instant] : [];
  });
  // Skip nonexistent spring-forward times; run once at the earlier instant of a repeated autumn hour.
  return candidates.length ? Math.min(...candidates) : undefined;
}

function nextOccurrence(event: ScheduledEvent, range: DateRange | undefined, now: Date): string | null {
  if (!event.type) return range ? null : '9999-12-31T23:59:59';
  const today = localMoment(now, event.zone);
  const lower = range?.from || today.date;
  const upper = range?.to;
  const { start, end } = event;
  if (end && (end.date < lower || (event.type !== 'by-arrangement' && !range && event.endInstant! < now.getTime())))
    return null;
  if (upper && start && start.date > upper) return null;
  if (event.type === 'by-arrangement') return '9999-12-31T23:59:59';
  if (!start) throw new Error('Missing start date in prepared schedule.');
  if (event.type === 'fixed-date') {
    const last = end || start;
    if (last.date < lower || (!range && (event.endInstant ?? event.startInstant)! < now.getTime())) return null;
    const date = start.date > lower ? start.date : lower;
    return `${date}T${date === start.date ? start.time : '00:00:00'}`;
  }
  const first = start.date > lower ? start.date : lower;
  // A monthly weekday recurs within the next two months; no unbounded date-range scan is needed.
  for (let offset = 0; offset <= 62; offset += 1) {
    const date = addDays(first, offset);
    if ((upper && date > upper) || (end && date > end.date)) return null;
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (event.type !== 'daily' && !event.days.includes(day)) continue;
    if (event.type === 'monthly-weekday') {
      const monthWeek = Math.floor((Number(date.slice(8)) - 1) / 7);
      const isLast = addDays(date, 7).slice(0, 7) !== date.slice(0, 7);
      if (event.week === 4 ? !isLast : monthWeek !== event.week) continue;
    }
    const occurrence = { date, time: start.time };
    const key = momentKey(occurrence);
    const instant = occurrenceInstant(date, start.time, event.zone);
    if (instant === undefined || (!range && instant < now.getTime())) continue;
    if (event.endInstant !== undefined && instant > event.endInstant) continue;
    return key;
  }
  return null;
}

export function matchingEvents(
  events: ScheduledEvent[],
  range?: DateRange,
  now = new Date(),
  locale = 'en',
): EventCard[] {
  if (range && (!isCalendarDate(range.from) || !isCalendarDate(range.to) || range.from > range.to)) {
    throw new Error('Choose a valid date range with From on or before To.');
  }
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return events
    .map((event) => ({ event, occurrence: nextOccurrence(event, range, now) }))
    .filter((match): match is { event: ScheduledEvent; occurrence: string } => match.occurrence !== null)
    .sort(
      (a, b) =>
        Number(b.event.card.pushToTop === true) - Number(a.event.card.pushToTop === true) ||
        a.occurrence.localeCompare(b.occurrence) ||
        collator.compare(a.event.card.cardHeadline || '', b.event.card.cardHeadline || '') ||
        (a.event.card._path || '').localeCompare(b.event.card._path || ''),
    )
    .map(({ event }) => event.card);
}
