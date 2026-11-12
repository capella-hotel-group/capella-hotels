import decorate from './experience-events-grid';
import type { EventCard } from './schedule';
import { loadCSS } from '@/app/aem.js';

jest.mock('@/app/aem.js', () => ({ loadCSS: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/scripts.js', () => ({ moveInstrumentation: jest.fn() }));
jest.mock('@/utils/env.js', () => ({
  getPublishBaseUrl: () => 'https://publish.example.com',
  resolveDAMUrl: (path: string) => (path.startsWith('http') ? path : `https://publish.example.com${path}`),
}));

const fetchMock = jest.fn();
const originalFetch = global.fetch;
const card = (index: number, values: Partial<EventCard> = {}): EventCard => ({
  _path: `/content/dam/experiences/${index}`,
  cardHeadline: `Experience ${String(index).padStart(2, '0')}`,
  cardBackgroundPhoto: { _path: '/content/dam/image.jpg' },
  cardBackgroundPhotoAltText: 'Experience image',
  associatedFilterTags: ['capella-hotels:experience/culture'],
  schedulefrequencyLabel: 'Daily, from 5pm',
  durationType: '90 minutes',
  pricingType: 'complimentary',
  scheduleType: 'daily',
  availabilityStartDate: '2026-11-01T17:00:00+08:00',
  scheduleTimeZone: 'Asia/Singapore',
  cardClickActionBehavior: 'page ',
  directDestinationUrl: { _path: '/content/capella-hotels/global' },
  ...values,
});

function response(cards: (EventCard | null)[]) {
  return { ok: true, json: async () => ({ data: { filterGridCardDetailsList: { items: cards } } }) };
}

function block(instrumented = false, identityRows = 2): HTMLElement {
  const root = document.createElement('div');
  root.className = 'experience-events-grid';
  const values = [
    'events',
    'experience-events-grid',
    'Experiences',
    '<p>EXPLORE</p><p>CAPELLA EXPERIENCES</p>',
    '<a href="/content/dam/experiences.html">Experiences</a>',
    'Select event dates',
    'All Experiences',
    '<hr><p>capella-hotels:experience/culture</p><p>Culture</p><hr><p>capella-hotels:experience/nature</p><p>Nature</p><hr>',
    '8',
    'REVEAL MORE',
  ];
  values.slice(2 - identityRows).forEach((value) => {
    const row = document.createElement('div');
    row.innerHTML = `<div>${value}</div>`;
    root.append(row);
  });
  if (instrumented) {
    const categories = root.querySelector('hr')!.parentElement!;
    categories.setAttribute('data-aue-prop', 'categorySettings');
    categories.querySelector('p')!.setAttribute('data-aue-prop', 'categoryTag');
    categories.querySelectorAll('p')[1]!.setAttribute('data-aue-prop', 'label');
  }
  document.body.append(root);
  return root;
}

const click = (root: Element, id: string) =>
  root.querySelector<HTMLButtonElement>(`[data-testid="experience-events-grid-${id}"]`)!.click();
const shown = (root: Element) => root.querySelectorAll('.experience-events-grid-item');
const names = (root: Element) =>
  [...root.querySelectorAll('.experience-events-grid-card-title')].map((node) => node.textContent);

function setRange(root: Element, from: string, to: string) {
  click(root, 'date-toggle');
  root.querySelector<HTMLInputElement>('[type="date"]')!.value = from;
  root.querySelector<HTMLInputElement>('.experience-events-grid-date-to')!.value = to;
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-11T08:00:00Z'));
  document.documentElement.lang = 'en';
  document.body.replaceChildren();
  global.fetch = fetchMock;
  fetchMock.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('Experience Events Grid', () => {
  it.each([true, false].flatMap((instrumented) => [0, 1, 2].map((identity) => [instrumented, identity] as const)))(
    'parses category multifields with instrumentation %s and %s identity rows',
    async (instrumented, identity) => {
      fetchMock.mockResolvedValueOnce(response([card(1)]));
      const root = block(instrumented, identity);
      const label = root.querySelector('hr')!.parentElement!.querySelectorAll('p')[1]!;
      await decorate(root);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://publish.example.com/graphql/execute.json/capella-hotels/Experience-events-grid;path=/content/dam/experiences',
        expect.any(Object),
      );
      expect(root.querySelectorAll('.experience-events-grid-category')).toHaveLength(3);
      expect(root.contains(label)).toBe(true);
      expect(shown(root)).toHaveLength(1);
      expect(root.getAttribute('aria-busy')).toBe('false');
    },
  );

  it('appends four cards without rebuilding existing cards and hides Reveal More at the end', async () => {
    fetchMock.mockResolvedValueOnce(response(Array.from({ length: 14 }, (_, index) => card(index))));
    const root = block();
    await decorate(root);
    expect(shown(root)).toHaveLength(8);
    const first = shown(root)[0];
    click(root, 'reveal-more');
    expect(shown(root)).toHaveLength(12);
    expect(shown(root)[0]).toBe(first);
    expect(document.activeElement).toBe(shown(root)[8]?.firstElementChild);
    click(root, 'reveal-more');
    expect(shown(root)).toHaveLength(14);
    expect(root.querySelector<HTMLButtonElement>('.experience-events-grid-reveal-more')!.hidden).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('filters before prioritising and resets the count on category changes', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        ...Array.from({ length: 12 }, (_, index) => card(index)),
        card(99, { pushToTop: true, associatedFilterTags: ['capella-hotels:experience/nature'] }),
      ]),
    );
    const root = block();
    await decorate(root);
    expect(names(root)[0]).toBe('Experience 99');
    click(root, 'reveal-more');
    const culture = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (node) => node.textContent === 'Culture',
    )!;
    culture.click();
    expect(shown(root)).toHaveLength(8);
    expect(names(root)).not.toContain('Experience 99');
    expect(culture.getAttribute('aria-pressed')).toBe('true');
    root.querySelector<HTMLButtonElement>('.experience-events-grid-category')!.click();
    expect(names(root)[0]).toBe('Experience 99');
  });

  it('keeps the result order stable while revealing cards across an occurrence time', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        card(0, { scheduleType: 'fixed-date', availabilityStartDate: '2026-11-11T16:01:00+08:00' }),
        ...Array.from({ length: 11 }, (_, index) => card(index + 1)),
      ]),
    );
    const root = block();
    await decorate(root);
    const first = shown(root)[0];
    jest.setSystemTime(new Date('2026-11-11T08:02:00Z'));
    click(root, 'reveal-more');
    expect(shown(root)).toHaveLength(12);
    expect(shown(root)[0]).toBe(first);
    expect(new Set(names(root)).size).toBe(12);
    root.querySelector<HTMLButtonElement>('.experience-events-grid-category')!.click();
    expect(names(root)).not.toContain('Experience 00');
  });

  it('applies inclusive date ranges, excludes unscheduled entries, and clears both filters independently', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        card(1, { scheduleType: 'fixed-date', availabilityStartDate: '2026-11-12T09:00:00+08:00' }),
        card(2, { scheduleType: null, availabilityStartDate: null }),
        card(3, { scheduleType: 'fixed-date', availabilityStartDate: '2026-11-13T09:00:00+08:00' }),
      ]),
    );
    const root = block();
    const placeholder = root.children[5]!.firstElementChild!;
    placeholder.setAttribute('data-aue-prop', 'dateFilterPlaceholder');
    await decorate(root);
    expect(shown(root)).toHaveLength(3);
    setRange(root, '2026-11-12', '2026-11-12');
    expect(names(root)).toEqual(['Experience 01']);
    expect(placeholder.isConnected).toBe(true);
    expect(placeholder.hasAttribute('hidden')).toBe(true);
    click(root, 'date-toggle');
    click(root, 'date-clear');
    expect(shown(root)).toHaveLength(3);
    expect(placeholder.hasAttribute('hidden')).toBe(false);
  });

  it('validates empty or reversed dates without changing the existing results', async () => {
    fetchMock.mockResolvedValueOnce(response([card(1)]));
    const root = block();
    await decorate(root);
    setRange(root, '', '');
    expect(root.querySelector<HTMLElement>('.experience-events-grid-date-error')!.hidden).toBe(false);
    expect(shown(root)).toHaveLength(1);
    root.querySelector<HTMLInputElement>('.experience-events-grid-date-from')!.value = '2026-11-14';
    root.querySelector<HTMLInputElement>('.experience-events-grid-date-to')!.value = '2026-11-12';
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(shown(root)).toHaveLength(1);
  });

  it('preserves instrumented multifield labels and disables entries without a tag', async () => {
    fetchMock.mockResolvedValueOnce(response([card(1)]));
    const root = block(true);
    const categories = root.querySelector('[data-aue-prop="categorySettings"]')!;
    categories.insertAdjacentHTML('beforeend', '<p>Draft category</p><hr>');
    const label = categories.querySelector('[data-aue-prop="label"]')!;
    await decorate(root);
    expect(root.contains(label)).toBe(true);
    expect([...root.querySelectorAll('button')].find((item) => item.textContent === 'Draft category')!.disabled).toBe(
      true,
    );
    label.closest('.experience-events-grid-category-item')!.dispatchEvent(new CustomEvent('aue:ui-select'));
    expect(label.closest('button')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('reads previously saved Category Settings multifield entries', async () => {
    fetchMock.mockResolvedValueOnce(response([card(1)]));
    const root = block();
    root.querySelector('hr')!.parentElement!.innerHTML =
      '<hr><p>capella-hotels:experience/culture</p><p>Culture</p><hr>';
    await decorate(root);
    expect(root.querySelectorAll('.experience-events-grid-category')).toHaveLength(2);
    expect(shown(root)).toHaveLength(1);
  });

  it('maps internal destinations, preserves external destinations and renders available metadata only', async () => {
    fetchMock.mockResolvedValueOnce(
      response([
        card(1),
        card(2, {
          durationType: null,
          pricingType: null,
          schedulefrequencyLabel: null,
          directDestinationUrlType: 'external',
          directDestinationExternalUrl: 'https://example.com',
          openInNewTab: true,
        }),
      ]),
    );
    const root = block();
    await decorate(root);
    const links = root.querySelectorAll<HTMLAnchorElement>('.experience-events-grid-card-link');
    expect(links[0]?.getAttribute('href')).toBe('/global');
    expect(links[1]?.href).toBe('https://example.com/');
    expect(links[1]?.rel).toBe('noopener noreferrer');
    expect(links[1]?.querySelector('.experience-events-grid-metadata')).toBeNull();
    expect(root.querySelector('img')?.src).toBe('https://publish.example.com/content/dam/image.jpg');
    expect(root.querySelector('.experience-events-grid-duration')?.textContent).toBe('90 minutes');
    expect(root.querySelector('.experience-events-grid-price')?.textContent).toBe('Complimentary');
  });

  it.each(['square', 'wide'])(
    'opens the Events Grid %s popup without a CTA or dots for a single slide',
    async (variant) => {
      fetchMock.mockResolvedValueOnce(
        response([
          card(1, {
            cardLocationTag: ['capella-hotels:destination/singapore'],
            cardClickActionBehavior: 'popup',
            modalDetails: {
              modalImageAspectRatioVariant: variant,
              modalFeatureImageAsset: { _path: '/feature.jpg' },
              carouselImages: variant === 'square' ? [{ _path: '/extra.jpg' }] : [],
              modalDescription: { html: '<p>Details</p>' },
              modalCtaLabel: '',
            },
          }),
        ]),
      );
      const root = block();
      await decorate(root);
      click(root, 'open-modal');
      await Promise.resolve();
      await Promise.resolve();
      expect(loadCSS).toHaveBeenCalled();
      const modal = document.querySelector('.filters-grid-modal:not([hidden])')!;
      expect(modal.querySelector('.filters-grid-modal-panel')?.getAttribute('data-variant')).toBe(variant);
      expect(modal.querySelector('.filters-grid-modal-cta')).toBeNull();
      expect(
        modal.querySelector('.filters-grid-modal-body')?.classList.contains('filters-grid-modal-body-no-category'),
      ).toBe(false);
      expect(modal.querySelector('.filters-grid-modal-category')?.textContent).toBe('Singapore');
      expect(modal.querySelector('.filters-grid-modal-eyebrow')?.textContent).toBe('Singapore');
      expect(modal.querySelectorAll('.filters-grid-modal-pagination button')).toHaveLength(0);
      modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect((modal as HTMLElement).hidden).toBe(true);
      [...root.querySelectorAll<HTMLButtonElement>('.experience-events-grid-category')]
        .find((node) => node.textContent === 'Culture')!
        .click();
      click(root, 'open-modal');
      await Promise.resolve();
      expect(modal.querySelector('.filters-grid-modal-category')?.textContent).toBe('Singapore');
      expect(modal.querySelector('.filters-grid-modal-body-no-category')).toBeNull();
    },
  );

  it('reports invalid schedules without silently treating them as By Arrangement', async () => {
    fetchMock.mockResolvedValueOnce(response([null, card(1, { scheduleTimeZone: 'Invalid/Zone' }), card(2)]));
    const root = block();
    await decorate(root);
    expect(names(root)).toEqual(['Experience 02']);
    expect(root.querySelector<HTMLElement>('.experience-events-grid-warning')!.hidden).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it.each([
    { ok: false, status: 500 },
    { ok: true, json: async () => ({ errors: [{ message: 'Query missing' }] }) },
    { ok: true, json: async () => ({ data: {} }) },
  ])('shows a real error for failed or malformed responses', async (value) => {
    fetchMock.mockResolvedValueOnce(value);
    const root = block();
    await decorate(root);
    expect(root.querySelector('.experience-events-grid-status')?.textContent).toContain('could not be loaded');
    expect(console.error).toHaveBeenCalled();
    expect(shown(root)).toHaveLength(0);
  });

  it('shows the empty state and hides Reveal More', async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    const root = block();
    await decorate(root);
    expect(root.querySelector('.experience-events-grid-status')?.textContent).toBe('No matching experiences.');
    expect(root.querySelector<HTMLButtonElement>('.experience-events-grid-reveal-more')!.hidden).toBe(true);
  });
});
jest.mock('@/utils/tag-title.js', () => ({ setTagTitle: jest.fn() }));
