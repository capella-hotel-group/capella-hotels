import { getPageLang } from '@/app/scripts';
import { buildBookingUrl } from './lib/booking-url';
import { buildCalendar } from './lib/calendar';
import { el } from './lib/dom';
import { buildField, isOpen } from './lib/field';
import { createFlyouts } from './lib/flyouts';
import { buildCounter } from './lib/guest-counter';
import { buildDoneButton } from './lib/done-button';
import { buildLocationList } from './lib/location-list';
import { parseConfig } from './lib/parse';
import { BLOCK, DEFAULT_ADULTS } from './lib/types';
import type { Field, Selection } from './lib/types';

export default function decorate(block: HTMLElement): void {
  const { labels, locations, limits, bookingUrl, openInNewTab } = parseConfig(block);
  const lang = getPageLang();
  // Figma writes dates day-first ("30 Jul - 31 Jul 2026"), which plain `en` (US) would not.
  const dateLocale = lang === 'en' ? 'en-GB' : lang;
  const shortDate = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' });
  const yearFormat = new Intl.DateTimeFormat(dateLocale, { year: 'numeric' });
  const selection: Selection = { adults: Math.min(DEFAULT_ADULTS, limits.adults.max), children: 0 };

  block.dataset.testid = BLOCK;

  const submit = el('a', `${BLOCK}-submit`, labels.checkRates);
  submit.dataset.testid = `${BLOCK}-submit`;
  if (openInNewTab) {
    submit.target = '_blank';
    submit.rel = 'noopener noreferrer';
  }
  const syncSubmit = (): void => {
    const href = buildBookingUrl(bookingUrl, selection);
    if (href) {
      submit.href = href;
      submit.removeAttribute('aria-disabled');
    } else {
      submit.removeAttribute('href');
      submit.setAttribute('aria-disabled', 'true');
    }
  };

  const locationField = buildField('location', labels.location, labels.location);
  const datesField = buildField('dates', labels.dates, labels.dates);
  const guestsField = buildField('guests', '', labels.guestPlural);
  const fields = [locationField, datesField, guestsField];
  const flyouts = createFlyouts(block, fields);

  const locationList = buildLocationList(locations, labels.location, (location) => {
    selection.location = location;
    locationField.label.textContent = location.label;
    locationField.label.title = location.label;
    locationList.mark(location);
    syncSubmit();
  });
  locationField.panel.append(locationList.list, locationList.scrollbar);

  const calendar = buildCalendar(lang, selection, () => {
    const { arrival, departure } = selection;
    const { label } = datesField;
    if (arrival && departure) {
      // The year is its own node so CSS can drop it where the bar is too narrow.
      const year = el('span', `${BLOCK}-label-year`, ` ${yearFormat.format(departure)}`);
      label.replaceChildren(`${shortDate.format(arrival)} - ${shortDate.format(departure)}`, year);
    } else {
      label.textContent = arrival ? shortDate.format(arrival) : labels.dates;
    }
    label.title = label.textContent ?? '';
    syncSubmit();
  });
  datesField.panel.append(calendar.root);

  const updateGuestsLabel = (): void => {
    const total = selection.adults + selection.children;
    guestsField.label.textContent = `${total} ${total === 1 ? labels.guestSingular : labels.guestPlural}`;
    syncSubmit();
  };
  const counters = el('div', `${BLOCK}-counters`);
  counters.append(
    buildCounter('adults', limits.adults, labels.adults, selection, updateGuestsLabel),
    buildCounter('children', limits.children, labels.children, selection, updateGuestsLabel),
  );
  guestsField.panel.append(counters);

  fields.forEach((field) => {
    field.panel.append(
      buildDoneButton(labels.done, () => {
        flyouts.closeAll();
        field.trigger.focus();
      }),
    );
  });

  const openField = (field: Field): void => {
    flyouts.open(field);
    if (field === datesField) calendar.sync();
    if (field === locationField) {
      locationList.mark(selection.location);
      locationList.updateScrollbar();
    }
  };

  fields.forEach((field) => {
    field.trigger.addEventListener('click', () => {
      if (isOpen(field)) flyouts.closeAll();
      else openField(field);
    });
  });
  locationField.trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    openField(locationField);
    locationList.focusOption(selection.location ? locations.indexOf(selection.location) : 0);
  });
  datesField.trigger.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    openField(datesField);
    calendar.focusDay();
  });

  const divider = (): HTMLElement => {
    const line = el('span', `${BLOCK}-divider`);
    line.setAttribute('aria-hidden', 'true');
    return line;
  };
  const fieldsWrapper = el('div', `${BLOCK}-fields`);
  fieldsWrapper.append(locationField.root, divider(), datesField.root, divider(), guestsField.root);
  const form = el('div', `${BLOCK}-form`);
  form.append(fieldsWrapper, submit);
  block.append(form);

  updateGuestsLabel();
}
