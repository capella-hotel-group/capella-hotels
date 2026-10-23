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

export function buildCalendar(lang: string, selection: Selection, onChange: () => void): Calendar {
  const monthFormat = new Intl.DateTimeFormat(lang, { month: 'long' });
  const monthYearFormat = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' });
  const weekdayFormat = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const dayLabelFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'full' });

  const today = startOfDay(new Date());
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let viewStart = firstMonth;

  const root = el('div', `${BLOCK}-calendar`);
  root.setAttribute('role', 'group');

  const prev = el('button', `${BLOCK}-calendar-prev`);
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous month');
  prev.dataset.testid = `${BLOCK}-calendar-previous`;
  const next = el('button', `${BLOCK}-calendar-next`);
  next.type = 'button';
  next.setAttribute('aria-label', 'Next month');
  next.dataset.testid = `${BLOCK}-calendar-next`;
  const title = el('div', `${BLOCK}-calendar-title`);
  const header = el('div', `${BLOCK}-calendar-header`);
  header.append(prev, title, next);

  const grid = el('div', `${BLOCK}-calendar-grid`);
  root.append(header, grid);

  // 2021-01-04 is a Monday, so the grid is Monday-first.
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const weekday = el('span', `${BLOCK}-weekday`, weekdayFormat.format(new Date(2021, 0, 4 + i)).slice(0, 2));
    weekday.setAttribute('aria-hidden', 'true');
    return weekday;
  });

  function renderDay(date: Date, month: number): HTMLButtonElement {
    const outside = date.getMonth() !== month;
    const button = el('button', `${BLOCK}-day`, String(date.getDate()));
    button.type = 'button';
    button.dataset.date = toIso(date);
    button.setAttribute('aria-label', dayLabelFormat.format(date));
    button.disabled = outside || date < today;
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
    title.textContent = monthFormat.format(viewStart);
    root.setAttribute('aria-label', monthYearFormat.format(viewStart));
    prev.disabled = viewStart <= firstMonth;

    // Pad to whole weeks with the neighbouring months' days.
    const offset = (viewStart.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const days = Array.from({ length: cells }, (_, i) => renderDay(new Date(year, month, 1 - offset + i), month));

    grid.replaceChildren(...weekdays, ...days);

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

  grid.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(`.${BLOCK}-day`);
    if (!button?.dataset.date) return;
    const date = fromIso(button.dataset.date);

    if (!selection.arrival || !!selection.departure || date <= selection.arrival) {
      selection.arrival = date;
      selection.departure = undefined;
    } else {
      selection.departure = date;
    }
    render(toIso(date));
    onChange();
  });

  grid.addEventListener('keydown', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(`.${BLOCK}-day`);
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
    if (target < today) return;

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
    focusDay: () => grid.querySelector<HTMLButtonElement>(`.${BLOCK}-day[tabindex="0"]`)?.focus(),
  };
}
