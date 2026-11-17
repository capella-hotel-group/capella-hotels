import { buildCalendar } from './calendar';
import type { Selection } from './types';

const selection = (): Selection => ({ adults: 2, children: 0 });

describe('events grid calendar', () => {
  it('uses the block prefix and a month-only title by default', () => {
    const calendar = buildCalendar('en', selection(), jest.fn());
    calendar.sync();

    expect(calendar.root.className).toBe('experience-events-grid-calendar');
    expect(calendar.root.querySelector('.experience-events-grid-calendar-header')).not.toBeNull();
    expect(calendar.root.querySelector('.experience-events-grid-calendar-weekdays')).toBeNull();
    expect(
      calendar.root.querySelectorAll('.experience-events-grid-calendar-grid .experience-events-grid-weekday'),
    ).toHaveLength(7);
    expect(calendar.root.querySelector('.experience-events-grid-day')).not.toBeNull();
    expect(calendar.root.querySelector('.experience-events-grid-calendar-day')).toBeNull();
    expect(calendar.root.querySelector('.experience-events-grid-calendar-title')?.textContent).not.toMatch(/\d{4}/);
  });

  it('supports a separate weekday row and year heading for Experience Events Grid', () => {
    const calendar = buildCalendar('en', selection(), jest.fn(), {
      classPrefix: 'experience-events-grid',
      allowPastDates: true,
      allowSameDayRange: true,
      separateWeekdays: true,
      showYear: true,
    });
    calendar.sync();

    expect(calendar.root.className).toBe('experience-events-grid-calendar');
    expect(
      calendar.root.querySelectorAll('.experience-events-grid-calendar-weekdays .experience-events-grid-weekday'),
    ).toHaveLength(7);
    expect(
      calendar.root.querySelector('.experience-events-grid-calendar-grid .experience-events-grid-calendar-day'),
    ).not.toBeNull();
    expect(calendar.root.querySelector('.experience-events-grid-calendar-title')?.textContent).toMatch(/\d{4}/);
    expect(calendar.root.querySelector<HTMLButtonElement>('.experience-events-grid-calendar-prev')?.disabled).toBe(
      false,
    );
  });
});
