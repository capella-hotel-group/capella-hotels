import { matchingEvents, prepareEvent, isCalendarDate, type EventCard, type DateRange } from './schedule';

const NOW = new Date('2026-11-11T08:00:00Z');
const card = (values: Partial<EventCard> = {}): EventCard => ({
  cardHeadline: 'Experience',
  scheduleType: 'daily',
  availabilityStartDate: '2026-11-01T09:00:00+08:00',
  scheduleTimeZone: 'Asia/Singapore',
  ...values,
});
const range = (from = '2026-11-12', to = from): DateRange => ({ from, to });
const matches = (cards: EventCard[], dates?: DateRange) =>
  matchingEvents(cards.map(prepareEvent), dates, NOW).map((value) => value.cardHeadline);

describe('experience occurrence matching', () => {
  it('uses the time zone, rather than the UTC date of the stored timestamp', () => {
    const event = card({
      scheduleType: 'fixed-date',
      availabilityStartDate: '2026-11-11T17:00:00Z',
    });
    expect(matches([event], range('2026-11-11'))).toEqual([]);
    expect(matches([event], range('2026-11-12'))).toEqual(['Experience']);
  });

  it('includes both ends of a selected date range', () => {
    const cards = ['2026-11-12', '2026-11-15', '2026-11-16'].map((date) =>
      card({ cardHeadline: date, scheduleType: 'fixed-date', availabilityStartDate: `${date}T09:00:00+08:00` }),
    );
    expect(matches(cards, range('2026-11-12', '2026-11-15'))).toEqual(['2026-11-12', '2026-11-15']);
  });

  it('matches continuous fixed-date events that started before the range', () => {
    expect(
      matches(
        [
          card({
            scheduleType: 'fixed-date',
            availabilityEndDate: '2026-11-13T10:00:00+08:00',
          }),
        ],
        range(),
      ),
    ).toEqual(['Experience']);
  });

  it('omits expired fixed and recurring experiences without a selected range', () => {
    expect(
      matches([
        card({ scheduleType: 'fixed-date' }),
        card({ availabilityEndDate: '2026-11-10T09:00:00+08:00' }),
        card({ scheduleType: 'by-arrangement', availabilityEndDate: '2026-11-10T09:00:00+08:00' }),
      ]),
    ).toEqual([]);
  });

  it('can match past occurrences when the visitor explicitly selects past dates', () => {
    expect(matches([card({ scheduleType: 'fixed-date' })], range('2026-11-01'))).toEqual(['Experience']);
  });

  it('sorts by next occurrence rather than original recurrence start date', () => {
    expect(
      matches([
        card({ cardHeadline: 'Daily morning' }),
        card({
          cardHeadline: 'Today evening',
          scheduleType: 'fixed-date',
          availabilityStartDate: '2026-11-11T18:00:00+08:00',
        }),
      ]),
    ).toEqual(['Today evening', 'Daily morning']);
  });

  it('keeps a fixed event active across a repeated daylight-saving hour', () => {
    const event = prepareEvent(
      card({
        scheduleType: 'fixed-date',
        scheduleTimeZone: 'Australia/Sydney',
        availabilityStartDate: '2026-04-05T02:50:00+11:00',
        availabilityEndDate: '2026-04-05T02:30:00+10:00',
      }),
    );
    expect(matchingEvents([event], undefined, new Date('2026-04-05T02:55:00+11:00'))).toHaveLength(1);
    expect(matchingEvents([event], undefined, new Date('2026-04-05T02:31:00+10:00'))).toHaveLength(0);
  });

  it('does not repeat a daily occurrence in the second daylight-saving hour', () => {
    const events = [
      card({
        cardHeadline: 'Next morning',
        scheduleTimeZone: 'Australia/Sydney',
        availabilityStartDate: '2026-04-04T02:30:00+11:00',
      }),
      card({
        cardHeadline: 'Later today',
        scheduleTimeZone: 'Australia/Sydney',
        availabilityStartDate: '2026-04-04T03:00:00+11:00',
      }),
    ].map(prepareEvent);
    expect(
      matchingEvents(events, undefined, new Date('2026-04-05T02:15:00+10:00')).map((value) => value.cardHeadline),
    ).toEqual(['Later today', 'Next morning']);
  });

  it('uses dates then times then title, after matching featured priority', () => {
    const cards = [
      card({ cardHeadline: 'Zulu' }),
      card({ cardHeadline: 'Alpha' }),
      card({ cardHeadline: 'Earlier', availabilityStartDate: '2026-11-01T08:00:00+08:00' }),
      card({ cardHeadline: 'Featured later', pushToTop: true, availabilityStartDate: '2026-11-13T10:00:00+08:00' }),
      card({ cardHeadline: 'Featured sooner', pushToTop: true }),
      card({
        cardHeadline: 'Featured outside range',
        pushToTop: true,
        availabilityStartDate: '2026-12-01T09:00:00+08:00',
      }),
    ];
    expect(matches(cards, range('2026-11-12', '2026-11-14'))).toEqual([
      'Featured sooner',
      'Featured later',
      'Earlier',
      'Alpha',
      'Zulu',
    ]);
  });

  it('ignores stale weekday/week values for Daily', () => {
    expect(matches([card({ weekdays: ['monday'], weekOfMonth: 'second' })], range())).toEqual(['Experience']);
  });

  it('matches weekly schedules only on selected weekdays', () => {
    const event = card({ scheduleType: 'weekly', weekdays: ['monday', 'thursday'] });
    expect(matches([event], range('2026-11-12'))).toEqual(['Experience']);
    expect(matches([event], range('2026-11-13'))).toEqual([]);
  });

  it.each([
    ['first', '2026-11-01'],
    ['second', '2026-11-08'],
    ['third', '2026-11-15'],
    ['fourth', '2026-11-22'],
    ['last', '2026-11-29'],
  ])('matches the %s Sunday of the month', (weekOfMonth, date) => {
    const event = card({ scheduleType: 'monthly-weekday', weekdays: ['sunday'], weekOfMonth });
    expect(matches([event], range(date))).toEqual(['Experience']);
    expect(matches([event], range('2026-11-02'))).toEqual([]);
  });

  it('finds the next monthly occurrence across year boundaries', () => {
    const event = card({ scheduleType: 'monthly-weekday', weekdays: ['sunday'], weekOfMonth: 'first' });
    expect(matches([event], range('2026-12-07', '2027-01-04'))).toEqual(['Experience']);
    expect(matches([event], range('2026-12-07', '2027-01-02'))).toEqual([]);
  });

  it('respects start/end times on the final recurring date', () => {
    const event = card({ availabilityEndDate: '2026-11-12T08:59:00+08:00' });
    expect(matches([event], range())).toEqual([]);
  });

  it('includes By Arrangement on overlapping dates, ignoring its boundary times', () => {
    const event = card({ scheduleType: 'by-arrangement', availabilityEndDate: '2026-11-11T00:00:00+08:00' });
    expect(matches([event])).toEqual(['Experience']);
    expect(matches([event], range('2026-11-11'))).toEqual(['Experience']);
    expect(matches([event], range('2026-11-12'))).toEqual([]);
  });

  it('keeps undated entries only without a date filter and sorts them after dated matches', () => {
    const undated: EventCard = { cardHeadline: 'Undated' };
    const arrangement = card({ cardHeadline: 'Arrangement', scheduleType: 'by-arrangement' });
    expect(matches([undated, arrangement, card()])).toEqual(['Experience', 'Arrangement', 'Undated']);
    expect(matches([undated, arrangement], range())).toEqual(['Arrangement']);
  });

  it('keeps recurrence at the same local time across daylight saving', () => {
    const event = card({
      scheduleTimeZone: 'Australia/Sydney',
      availabilityStartDate: '2026-09-01T09:00:00+10:00',
    });
    const later = card({
      cardHeadline: 'Later',
      scheduleTimeZone: 'Australia/Sydney',
      scheduleType: 'fixed-date',
      availabilityStartDate: '2026-10-04T09:30:00+11:00',
    });
    expect(matches([later, event], range('2026-10-04'))).toEqual(['Experience', 'Later']);
  });

  it('skips a nonexistent local start time during a daylight-saving jump', () => {
    const event = card({
      scheduleTimeZone: 'Australia/Sydney',
      availabilityStartDate: '2026-09-01T02:30:00+10:00',
    });
    expect(matches([event], range('2026-10-04'))).toEqual([]);
    expect(matches([event], range('2026-10-05'))).toEqual(['Experience']);
  });

  it.each([
    { scheduleType: 'unknown' },
    { scheduleTimeZone: 'Invalid/Zone' },
    { scheduleTimeZone: null },
    { availabilityStartDate: null },
    { availabilityEndDate: '2026-01-01T00:00:00Z' },
    { availabilityStartDate: '2026-02-30T09:00:00Z' },
    { availabilityStartDate: '2026-11-11' },
    { scheduleType: 'weekly', weekdays: [] },
    { scheduleType: 'weekly', weekdays: ['noday'] },
    { scheduleType: 'monthly-weekday', weekdays: ['sunday', 'monday'], weekOfMonth: 'last' },
    { scheduleType: 'monthly-weekday', weekdays: ['sunday'] },
    { scheduleType: null },
  ])('rejects invalid authored schedule %j', (values) => {
    expect(() => prepareEvent(card(values))).toThrow();
  });

  it.each([range('2026-11-12', '2026-11-01'), range('2026-02-30'), range('')])(
    'rejects invalid date ranges %j',
    (value) => {
      expect(() => matchingEvents([], value, NOW)).toThrow();
    },
  );

  it('validates leap dates', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
  });
});
