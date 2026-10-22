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
  const { labels, locations, bookingUrl, openInNewTab } = parseConfig(block);
  const lang = getPageLang();
  // Figma writes dates day-first ("30 Jul - 31 Jul 2026"), which plain `en` (US) would not.
  const dateLocale = lang === 'en' ? 'en-GB' : lang;
  const shortDate = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short' });
  const fullDate = new Intl.DateTimeFormat(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  const selection: Selection = { adults: DEFAULT_ADULTS, children: 0 };

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
    locationList.mark(location);
    syncSubmit();
  });
  locationField.panel.append(locationList.list);

  const calendar = buildCalendar(lang, selection, () => {
    const { arrival, departure } = selection;
    datesField.label.textContent =
      arrival && departure
        ? `${shortDate.format(arrival)} - ${fullDate.format(departure)}`
        : arrival
          ? shortDate.format(arrival)
          : labels.dates;
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
    buildCounter('adults', labels.adults, selection, updateGuestsLabel),
    buildCounter('children', labels.children, selection, updateGuestsLabel),
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
    if (field === locationField) locationList.mark(selection.location);
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
