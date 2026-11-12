import { createExperienceModal } from '@/components/experience-modal.js';
import { applyBlockIdentity } from '@/utils/block-identity.js';
import { getPublishBaseUrl, resolveDAMUrl } from '@/utils/env.js';
import { cardMatchesFilter, resolvePickerPath } from '@/blocks/filters-grid/filters-grid.js';
import { normalizeChoice, resolveCardHref } from '@/utils/experience-url.js';
import { matchingEvents, prepareEvent, type DateRange, type EventCard, type ScheduledEvent } from './schedule';

const PREFIX = 'experience-events-grid';
const QUERY = '/graphql/execute.json/capella-hotels/Experience-events-grid';
const text = (element?: Element | null) => element?.textContent?.trim() || '';
const isArabic = () => document.documentElement.lang.toLowerCase().startsWith('ar');
const copy = () =>
  isArabic()
    ? {
        from: 'من',
        to: 'إلى',
        apply: 'تطبيق',
        clear: 'مسح',
        categories: 'فئات التجارب',
        loading: 'جارٍ تحميل التجارب…',
        empty: 'لا توجد تجارب مطابقة.',
        failed: 'تعذر تحميل التجارب. يرجى المحاولة مرة أخرى لاحقاً.',
        invalidRange: 'اختر تاريخ البداية والنهاية، بحيث لا تسبق النهاية البداية.',
        invalidSchedule: 'تعذر عرض بعض التجارب بسبب إعدادات الجدول.',
        complimentary: 'مجانية',
        chargeable: 'برسوم',
        count: 'عدد التجارب المعروضة',
      }
    : {
        from: 'From',
        to: 'To',
        apply: 'Apply',
        clear: 'Clear',
        categories: 'Experience categories',
        loading: 'Loading experiences…',
        empty: 'No matching experiences.',
        failed: 'Experiences could not be loaded. Please try again later.',
        invalidRange: 'Choose both dates, with From on or before To.',
        invalidSchedule: 'Some experiences could not be displayed. Check their schedule configuration.',
        complimentary: 'Complimentary',
        chargeable: 'Chargeable',
        count: 'Experiences shown',
      };

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  name: string,
  value?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = `${PREFIX}-${name}`;
  if (value) node.textContent = value;
  return node;
}

function button(name: string, value: string): HTMLButtonElement {
  const node = element('button', name, value);
  node.type = 'button';
  node.dataset.testid = `${PREFIX}-${name}`;
  return node;
}

function readTag(field: Element): string {
  const tags = field.querySelectorAll('li');
  const values = tags.length
    ? [...tags].map((tag) => text(tag))
    : [field.querySelector('a')?.getAttribute('href') || text(field)];
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length > 1) throw new Error('Select only one tag per Category Tab.');
  const value = unique[0] || '';
  if (value && !/^(?:capella-hotels:|\/content\/cq:tags\/capella-hotels\/)/.test(value)) {
    throw new Error('Select a category tag under Capella Hotels.');
  }
  return value;
}

function categoryFromRow(row: HTMLElement, index: number) {
  const cells = [...row.children];
  const tagField =
    row.querySelector('[data-aue-prop="categoryTag"]') ||
    cells.find((cell) => cell.querySelector('ul, ol, a[href*="/content/cq:tags/"]')) ||
    cells[0];
  const labelField = row.querySelector('[data-aue-prop="label"]') || cells.find((cell) => cell !== tagField);
  const tag = tagField ? readTag(tagField) : '';
  row.dataset.aueLabel = text(labelField) || `Category Tab ${index + 1}`;
  return { row, tagField, labelField, tag };
}

function readConfig(block: HTMLElement) {
  const rows = [...block.children] as HTMLElement[];
  const itemRows: HTMLElement[] = [];
  const parents = rows;
  const categorySettings = parents.find((row) => row.querySelector('[data-aue-prop="categorySettings"], hr'));
  const parentRows = parents.filter((row) => row !== categorySettings);
  const fields = applyBlockIdentity(block, parentRows, { contentRows: 7, hiddenClass: `${PREFIX}-config` });
  const names = [
    'eyebrow',
    'title',
    'cfRootPath',
    'dateFilterPlaceholder',
    'allExperiencesLabel',
    'initialDisplayCount',
    'revealMoreLabel',
  ];
  const rootIndex = parentRows.findIndex(
    (row) =>
      row.querySelector('[data-aue-prop="cfRootPath"]') ||
      /^(?:https?:\/\/[^/]+)?\/content\/dam(?:\/|$)/.test(row.querySelector('a')?.getAttribute('href') || text(row)),
  );
  const content = rootIndex >= 0 ? parentRows.slice(Math.max(0, rootIndex - 2)) : fields;
  const field = (name: string) => {
    const row =
      parentRows.find((row) => row.querySelector(`[data-aue-prop="${name}"]`)) || content[names.indexOf(name)];
    return row?.querySelector(`[data-aue-prop="${name}"]`) || row?.firstElementChild || undefined;
  };
  parents.forEach((row) => row.classList.add(`${PREFIX}-config`));
  const rootField = field('cfRootPath');
  const root = resolvePickerPath(
    rootField?.querySelector('a')?.getAttribute('href') || text(rootField),
    window.location.origin,
  );
  if (!root || !root.startsWith('/content/dam/'))
    throw new Error('Choose a Content Fragment Root Path under /content/dam/.');
  const count = text(field('initialDisplayCount'));
  const initialCount = count ? Number(count) : 8;
  if (!Number.isSafeInteger(initialCount) || initialCount < 1)
    throw new Error('Initial Display Count must be a positive whole number.');
  if (categorySettings) {
    const cell =
      categorySettings.querySelector('[data-aue-prop="categorySettings"]') || categorySettings.firstElementChild;
    let current: HTMLElement | undefined;
    for (const child of [...(cell?.children || [])]) {
      if (child.tagName === 'HR') {
        current = undefined;
      } else {
        if (!current) {
          current = document.createElement('div');
          const tagCell = document.createElement('div');
          const labelCell = document.createElement('div');
          current.append(tagCell, labelCell);
          itemRows.push(current);
        }
        const isTag =
          child.matches('ul, ol') || /^(?:capella-hotels:|\/content\/cq:tags\/capella-hotels\/)/.test(text(child));
        const target = isTag ? current.children[0] : current.children[1];
        target?.append(child);
      }
    }
  }
  return {
    root,
    initialCount,
    eyebrow: field('eyebrow'),
    title: field('title'),
    placeholder: field('dateFilterPlaceholder'),
    allLabel: field('allExperiencesLabel'),
    revealLabel: field('revealMoreLabel'),
    categories: itemRows.map(categoryFromRow),
  };
}

function createDateFilter(placeholder: Element | undefined, change: (range?: DateRange) => void) {
  const strings = copy();
  const root = element('div', 'dates');
  const toggle = button('date-toggle', text(placeholder) || 'Select event dates');
  const label = placeholder || element('span', 'date-placeholder', 'Select event dates');
  const selection = document.createElement('span');
  selection.hidden = true;
  toggle.replaceChildren(label, selection);
  toggle.setAttribute('aria-expanded', 'false');
  const panel = element('form', 'date-panel');
  panel.hidden = true;
  const fromLabel = element('label', 'date-label', strings.from);
  const toLabel = element('label', 'date-label', strings.to);
  const from = element('input', 'date-from');
  const to = element('input', 'date-to');
  for (const [input, label] of [
    [from, fromLabel],
    [to, toLabel],
  ] as const) {
    input.type = 'date';
    input.required = true;
    input.dataset.testid = input.className;
    label.append(input);
  }
  const error = element('p', 'date-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const actions = element('div', 'date-actions');
  const apply = button('date-apply', strings.apply);
  apply.type = 'submit';
  const clear = button('date-clear', strings.clear);
  actions.append(apply, clear);
  panel.append(fromLabel, toLabel, error, actions);
  panel.noValidate = true;
  let applied: DateRange | undefined;
  const close = () => {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    if (!panel.hidden) {
      close();
      return;
    }
    from.value = applied?.from || '';
    to.value = applied?.to || '';
    to.min = from.value;
    error.hidden = true;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    from.focus();
  });
  from.addEventListener('change', () => {
    to.min = from.value;
  });
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!from.value || !to.value || from.value > to.value || !from.validity.valid || !to.validity.valid) {
      error.textContent = strings.invalidRange;
      error.hidden = false;
      return;
    }
    applied = { from: from.value, to: to.value };
    const format = (value: string) =>
      new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${value}T00:00:00Z`));
    label.setAttribute('hidden', '');
    selection.textContent = `${format(applied.from)} – ${format(applied.to)}`;
    selection.hidden = false;
    close();
    toggle.focus();
    change(applied);
  });
  clear.addEventListener('click', () => {
    applied = undefined;
    from.value = '';
    to.value = '';
    label.removeAttribute('hidden');
    selection.hidden = true;
    close();
    toggle.focus();
    change();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      close();
      toggle.focus();
    }
  });
  root.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && !root.contains(event.relatedTarget)) close();
  });
  root.append(toggle, panel);
  return root;
}

function createCard(card: EventCard, open: (card: EventCard) => void): HTMLLIElement {
  const item = element('li', 'item');
  const popup = normalizeChoice(card.cardClickActionBehavior) === 'popup' && card.modalDetails;
  const action = popup ? button('open-modal', '') : element('a', 'card-link');
  action.classList.add(`${PREFIX}-card`);
  if (action instanceof HTMLAnchorElement) {
    const href = resolveCardHref(card);
    if (href) action.href = href;
    else action.setAttribute('aria-disabled', 'true');
    if (card.openInNewTab) {
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
    }
    action.dataset.testid = `${PREFIX}-card-link`;
  } else {
    action.setAttribute('aria-haspopup', 'dialog');
    action.addEventListener('click', () => open(card));
  }
  const media = element('div', 'media');
  if (card.CardBackgroundPhotoDarkImageOverlay === false) media.classList.add('no-overlay');
  const imagePath = card.cardBackgroundPhoto?._publishUrl || card.cardBackgroundPhoto?._path;
  if (imagePath) {
    const image = document.createElement('img');
    image.src = resolveDAMUrl(imagePath);
    image.alt = card.cardBackgroundPhotoAltText || '';
    image.loading = 'lazy';
    image.decoding = 'async';
    media.append(image);
  }
  const content = element('div', 'card-content');
  if (card.schedulefrequencyLabel) content.append(element('p', 'schedule', card.schedulefrequencyLabel));
  content.append(element('h3', 'card-title', card.cardHeadline || ''));
  const metadata = element('div', 'metadata');
  if (card.durationType) metadata.append(element('p', 'duration', card.durationType));
  if (card.pricingType) {
    const value = normalizeChoice(card.pricingType);
    if (value !== 'complimentary' && value !== 'chargeable') throw new Error(`Unknown Pricing Type "${value}".`);
    metadata.append(element('p', 'price', copy()[value]));
  }
  if (metadata.children.length) content.append(metadata);
  action.append(media, content);
  item.append(action);
  return item;
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const shell = element('div', 'shell');
  const status = element('p', 'status', copy().loading);
  status.setAttribute('role', 'status');
  block.dataset.testid = PREFIX;
  block.setAttribute('aria-busy', 'true');
  try {
    const config = readConfig(block);
    const heading = element('div', 'heading');
    if (config.eyebrow) {
      config.eyebrow.classList.add(`${PREFIX}-eyebrow`);
      heading.append(config.eyebrow);
    }
    if (config.title) {
      config.title.classList.add(`${PREFIX}-title`);
      config.title.setAttribute('role', 'heading');
      config.title.setAttribute('aria-level', '2');
      heading.append(config.title);
    }
    const list = element('ul', 'list');
    const tabs = element('div', 'tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', copy().categories);
    const all = button('category', text(config.allLabel) || 'All Experiences');
    if (config.allLabel) all.replaceChildren(config.allLabel);
    tabs.append(all);
    let selectedTag = '';
    let range: DateRange | undefined;
    let limit = config.initialCount;
    let events: ScheduledEvent[] = [];
    let filtered: EventCard[] = [];
    let modal: ReturnType<typeof createExperienceModal> | undefined;
    const reveal = button('reveal-more', text(config.revealLabel) || 'REVEAL MORE');
    if (config.revealLabel) reveal.replaceChildren(config.revealLabel);
    reveal.hidden = true;
    const warning = element('p', 'warning');
    warning.setAttribute('role', 'status');
    warning.hidden = true;
    const announce = element('p', 'announcement');
    announce.setAttribute('role', 'status');
    const open = async (card: EventCard) => {
      try {
        if (!block.isConnected) return;
        modal ||= createExperienceModal({
          testIdPrefix: PREFIX,
          rootTestId: `${PREFIX}-modal`,
          imageTestId: `${PREFIX}-modal-image`,
          showModalEyebrow: true,
          showModalCategoryTag: true,
          categoryFromLocation: true,
        });
        const location = (card.cardLocationTag?.[0] || '').split('/').pop()?.replace(/[-_]/g, ' ');
        const eyebrow = location?.replace(/\b\w/g, (letter) => letter.toUpperCase()) || '';
        await modal.open(card, eyebrow, eyebrow, Boolean(eyebrow.trim()));
      } catch (error) {
        console.error('Experience Events Grid: popup could not be opened.', error);
        status.textContent = copy().failed;
        status.hidden = false;
      }
    };
    const buttons = new Map<HTMLButtonElement, { tag: string; label: string }>([[all, { tag: '', label: '' }]]);
    config.categories.forEach(({ row, tagField, labelField, tag }) => {
      const tab = button('category', '');
      if (tagField) tagField.classList.add(`${PREFIX}-config`);
      if (labelField) tab.append(labelField);
      if (!text(tab)) tab.textContent = row.dataset.aueLabel || 'Category Tab';
      row.classList.add(`${PREFIX}-category-item`);
      row.append(tab);
      if (!tag) {
        tab.disabled = true;
        tab.title = 'Choose a Category Tag before publishing.';
      }
      buttons.set(tab, { tag, label: text(tab) });
      tabs.append(row);
      row.addEventListener('aue:ui-select', () => {
        if (!tab.disabled) tab.click();
      });
    });
    const render = (append = false) => {
      if (!append) {
        list.replaceChildren();
        limit = config.initialCount;
        filtered = matchingEvents(
          events.filter(({ card }) => cardMatchesFilter(card, '', selectedTag)),
          range,
          new Date(),
          document.documentElement.lang || 'en',
        );
      }
      const start = list.children.length;
      for (const card of filtered.slice(start, limit)) {
        list.append(
          createCard(card, (value) => {
            void open(value);
          }),
        );
      }
      reveal.hidden = filtered.length <= limit;
      status.textContent = filtered.length ? '' : copy().empty;
      status.hidden = Boolean(filtered.length);
      announce.textContent = `${copy().count}: ${list.children.length} / ${filtered.length}`;
      buttons.forEach((value, tab) =>
        tab.setAttribute(
          'aria-pressed',
          String(tab === all ? !selectedTag : value.tag === selectedTag && Boolean(selectedTag)),
        ),
      );
    };
    buttons.forEach((value, tab) => {
      tab.addEventListener('click', () => {
        selectedTag = value.tag;
        render();
      });
    });
    const dates = createDateFilter(config.placeholder, (value) => {
      range = value;
      render();
    });
    reveal.addEventListener('click', () => {
      limit += 4;
      const firstNewIndex = list.children.length;
      render(true);
      list.children[firstNewIndex]?.querySelector<HTMLElement>('a, button')?.focus({ preventScroll: true });
    });
    shell.append(heading, dates, tabs, warning, status, list, reveal, announce);
    block.append(shell);
    const path = config.root.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${getPublishBaseUrl()}${QUERY};path=${path}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Experience query failed (${response.status}).`);
    const data = await response.json();
    const cards: (EventCard | null)[] | undefined = data?.data?.filterGridCardDetailsList?.items;
    if (data.errors?.length || !Array.isArray(cards)) throw new Error('Experience query returned an invalid response.');
    let invalid = 0;
    events = cards.flatMap((card) => {
      try {
        if (!card) throw new Error('Empty Content Fragment in query results.');
        if (card.pricingType && !['complimentary', 'chargeable'].includes(normalizeChoice(card.pricingType))) {
          throw new Error('Choose Complimentary or Chargeable for Pricing Type.');
        }
        return [prepareEvent(card)];
      } catch (error) {
        invalid += 1;
        console.warn(`Experience Events Grid: invalid CF ${card?._path || card?.cardHeadline || ''}.`, error);
        return [];
      }
    });
    if (invalid) {
      warning.textContent = copy().invalidSchedule;
      warning.hidden = false;
    }
    render();
  } catch (error) {
    console.error('Experience Events Grid:', error);
    status.textContent = copy().failed;
    status.hidden = false;
    if (!shell.isConnected) {
      shell.append(status);
      block.append(shell);
    }
  } finally {
    block.setAttribute('aria-busy', 'false');
  }
}
