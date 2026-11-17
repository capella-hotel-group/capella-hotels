import { addDays, fromIso, sameDay, startOfDay, toIso } from './dates';
import { el } from './dom';
import { BLOCK } from './types';
import type { Selection } from './types';

export interface Calendar {
  root: HTMLElement;
  /** Re-renders from the current selection; call whenever the panel opens. */
  sync: () => void;
  focusDay: () => void;
}

export interface CalendarOptions {
  classPrefix?: string;
  dayClassName?: string;
  allowPastDates?: boolean;
  allowSameDayRange?: boolean;
  separateWeekdays?: boolean;
  showYear?: boolean;
}

export function buildCalendar(
  lang: string,
  selection: Selection,
  onChange: () => void,
  options: CalendarOptions = {},
): Calendar {
  const className = (name: string) => `${options.classPrefix || BLOCK}-${name}`;
  const dayClass = options.dayClassName || (options.classPrefix ? className('calendar-day') : className('day'));
  const makeElement = <K extends keyof HTMLElementTagNameMap>(tag: K, name: string, text?: string) =>
    el(tag, className(name), text);
  const allowPastDates = options.allowPastDates ?? false;
  const allowSameDayRange = options.allowSameDayRange ?? false;
  const monthFormat = new Intl.DateTimeFormat(lang, { month: 'long' });
  const monthYearFormat = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' });
  const weekdayFormat = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const dayLabelFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'full' });

  const today = startOfDay(new Date());
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let viewStart = firstMonth;

  const root = makeElement('div', 'calendar');
  root.setAttribute('role', 'group');

  const prev = makeElement('button', 'calendar-prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous month');
  prev.dataset.testid = `${options.classPrefix || BLOCK}-calendar-previous`;
  const next = makeElement('button', 'calendar-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next month');
  next.dataset.testid = `${options.classPrefix || BLOCK}-calendar-next`;
  const title = makeElement('div', 'calendar-title');
  const header = makeElement('div', 'calendar-header');
  header.append(prev, title, next);

  const weekdaysRow = options.separateWeekdays ? makeElement('div', 'calendar-weekdays') : undefined;
  const daysGrid = makeElement('div', 'calendar-grid');
  const calendarBody = weekdaysRow ? makeElement('div', 'calendar-body') : undefined;
  root.append(header);
  if (calendarBody && weekdaysRow) {
    calendarBody.append(weekdaysRow, daysGrid);
    root.append(calendarBody);
  } else {
    root.append(daysGrid);
  }

  // 2021-01-04 is a Monday, so the grid is Monday-first.
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const weekday = makeElement('span', 'weekday', weekdayFormat.format(new Date(2021, 0, 4 + i)).slice(0, 2));
    weekday.setAttribute('aria-hidden', 'true');
    return weekday;
  });
  if (weekdaysRow) weekdaysRow.append(...weekdays);
  else daysGrid.append(...weekdays);

  function renderDay(date: Date, month: number): HTMLButtonElement {
    const outside = date.getMonth() !== month;
    const button = el('button', dayClass, String(date.getDate()));
    button.type = 'button';
    button.dataset.date = toIso(date);
    button.setAttribute('aria-label', dayLabelFormat.format(date));
    button.disabled = outside || (!allowPastDates && date < today);
    button.tabIndex = -1;

    const { arrival, departure } = selection;
    const isStart = sameDay(date, arrival);
    const isEnd = sameDay(date, departure);
    const inRange = !!arrival && !!departure && date > arrival && date < departure;
    button.classList.toggle('is-outside', outside);
    button.classList.toggle('is-start', isStart);
    button.classList.toggle('is-end', isEnd);
    button.classList.toggle('is-in-range', inRange && !outside);
    button.setAttribute('aria-pressed', String(!outside && (isStart || isEnd)));
    return button;
  }

  function render(focusIso?: string): void {
    const year = viewStart.getFullYear();
    const month = viewStart.getMonth();
    title.textContent = (options.showYear ? monthYearFormat : monthFormat).format(viewStart);
    root.setAttribute('aria-label', monthYearFormat.format(viewStart));
    prev.disabled = !allowPastDates && viewStart <= firstMonth;

    // Pad to whole weeks with the neighbouring months' days.
    const offset = (viewStart.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const days = Array.from({ length: cells }, (_, i) => renderDay(new Date(year, month, 1 - offset + i), month));

    daysGrid.replaceChildren(...(weekdaysRow ? days : [...weekdays, ...days]));

    const enabled = days.filter((button) => !button.disabled);
    const target =
      enabled.find((button) => button.dataset.date === focusIso) ??
      enabled.find((button) => button.classList.contains('is-start')) ??
      enabled[0];
    if (target) target.tabIndex = 0;
    if (focusIso) target?.focus();
  }

  const shiftView = (delta: number): void => {
    viewStart = new Date(viewStart.getFullYear(), viewStart.getMonth() + delta, 1);
    render();
  };
  prev.addEventListener('click', () => shiftView(-1));
  next.addEventListener('click', () => shiftView(1));

  daysGrid.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(`.${dayClass}`);
    if (!button?.dataset.date) return;
    const date = fromIso(button.dataset.date);

    if (
      !selection.arrival ||
      !!selection.departure ||
      date < selection.arrival ||
      (sameDay(date, selection.arrival) && !allowSameDayRange)
    ) {
      selection.arrival = date;
      selection.departure = undefined;
    } else {
      selection.departure = date;
    }
    render(toIso(date));
    onChange();
  });

  daysGrid.addEventListener('keydown', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(`.${dayClass}`);
    if (!button?.dataset.date) return;
    const rtl = document.documentElement.dir === 'rtl';
    const steps: Record<string, number> = {
      ArrowLeft: rtl ? 1 : -1,
      ArrowRight: rtl ? -1 : 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();

    const target = addDays(fromIso(button.dataset.date), step);
    if (!allowPastDates && target < today) return;

    viewStart = new Date(target.getFullYear(), target.getMonth(), 1);
    render(toIso(target));
  });

  return {
    root,
    sync: () => {
      if (selection.arrival) {
        viewStart = new Date(selection.arrival.getFullYear(), selection.arrival.getMonth(), 1);
      }
      render();
    },
    focusDay: () => daysGrid.querySelector<HTMLButtonElement>(`.${dayClass}[tabindex="0"]`)?.focus(),
  };
}
