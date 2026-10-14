import decorate from './hotel-architect';

jest.mock(
  '@/app/scripts',
  () => ({
    moveInstrumentation: (source: HTMLElement, target: HTMLElement | null) => {
      [...source.attributes]
        .filter(({ name }) => name.startsWith('data-aue-'))
        .forEach(({ name, value }) => {
          target?.setAttribute(name, value);
          source.removeAttribute(name);
        });
    },
  }),
  { virtual: true },
);

const IDENTITY_ROWS = '<div><div>the-architect</div></div><div><div>architect-qa</div></div>';

interface RitualOptions {
  images?: number;
  thumbnails?: number;
  model?: boolean;
  eyebrow?: string | null;
  secondary?: boolean;
}

function multifield(prefix: string, count: number, instrumented: boolean): string {
  const items = Array.from({ length: count }, (_value, index) => {
    const attribute = instrumented ? ` data-aue-resource="urn:${prefix}/item${index}"` : '';
    return `<li${attribute}><picture><img src="${prefix}-${index + 1}.jpg" alt="${prefix} ${index + 1}"></picture></li>`;
  }).join('');
  return count ? `<ul>${items}</ul>` : '';
}

// Mirrors the delivered ritual item: both multifields render as lists, each CTA
// collapses its label, link and flag into one grouped cell.
function ritualRow(
  label: string,
  { images = 2, thumbnails = 3, model = false, eyebrow = 'RITUAL', secondary = true }: RitualOptions = {},
): string {
  const attribute = model ? ` data-aue-model="hotel-architect-ritual" data-aue-resource="urn:${label}"` : '';
  const cells = [
    `<div>${label}</div>`,
    eyebrow === null ? '' : `<div>${eyebrow}</div>`,
    `<div>${label.toUpperCase()},<br>SECOND LINE</div>`,
    `<div>About ${label}.</div>`,
    `<div>${multifield(`${label}-thumb`, thumbnails, model)}</div>`,
    '<div><p>Enquire</p><p><a href="/enquire">/enquire</a></p><p>false</p></div>',
    secondary ? '<div><p>Details</p><p><a href="/details">/details</a></p><p>true</p></div>' : '<div>false</div>',
    `<div>${multifield(label, images, model)}</div>`,
  ];
  return `<div${attribute}>${cells.join('')}</div>`;
}

function cardRow(model = false, name = 'Andre Fu'): string {
  const attribute = model ? ' data-aue-model="hotel-architect-card"' : '';
  const nameCell = name ? `<div>${name}</div>` : '';
  return `<div${attribute}><div><picture><img src="fu.jpg" alt="Andre Fu"></picture></div>${nameCell}<div>The architect in his own words</div><div><p>Discover</p><p><a href="/architect">/architect</a></p><p>false</p></div></div>`;
}

function build(rows: string): HTMLElement {
  const element = document.createElement('div');
  element.className = 'hotel-architect';
  element.innerHTML = rows;
  document.body.append(element);
  return element;
}

const visibleRitual = (block: HTMLElement): HTMLElement | undefined =>
  [...block.querySelectorAll<HTMLElement>('.hotel-architect-ritual')].find((ritual) => !ritual.hidden);

beforeAll(() => {
  window.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = jest.fn();
});

afterEach(() => {
  document.body.textContent = '';
});

describe('hotel-architect with a single ritual', () => {
  it.each([
    ['published content', false],
    ['editor content', true],
  ])('renders the classic architect layout from %s', (_label, instrumented) => {
    const block = build(IDENTITY_ROWS + ritualRow('Resort', { model: instrumented }) + cardRow(instrumented));

    decorate(block);

    expect(block.id).toBe('the-architect');
    expect(block.dataset.testId).toBe('architect-qa');
    expect(block.querySelector('[role="tablist"]')).toBeNull();
    expect(block.classList.contains('hotel-architect-has-card')).toBe(true);

    const ritual = visibleRitual(block)!;
    expect(ritual.hasAttribute('role')).toBe(false);
    expect(ritual.querySelector('.hotel-architect-eyebrow')?.textContent).toBe('RITUAL');
    expect(ritual.querySelectorAll('.hotel-architect-title > p')).toHaveLength(2);
    expect(ritual.querySelector('.hotel-architect-body')?.textContent).toBe('About Resort.');

    const ctas = ritual.querySelectorAll<HTMLAnchorElement>('.hotel-architect-cta a');
    expect([...ctas].map((cta) => cta.textContent)).toEqual(['Enquire', 'Details']);
    expect(ctas[0]!.target).toBe('');
    expect(ctas[1]!.target).toBe('_blank');
    expect(ritual.querySelectorAll('.hotel-architect-cta-divider')).toHaveLength(1);

    // the copy and the media both live inside the ritual, so the editor nests them under it
    expect(ritual.querySelectorAll('.hotel-architect-slide')).toHaveLength(2);
    expect(ritual.querySelector('.hotel-architect-dot')?.getAttribute('aria-label')).toBe('Resort 1');
    expect(ritual.querySelectorAll('.hotel-architect-thumb')).toHaveLength(3);

    const card = block.querySelector<HTMLElement>('.hotel-architect-cards')!;
    expect(card.hidden).toBe(false);
    expect(card.querySelector('.hotel-architect-card-name')?.textContent).toBe('Andre Fu');
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/architect');
  });

  it('keeps the editor instrumentation of every image on its ritual', () => {
    const block = build(IDENTITY_ROWS + ritualRow('Resort', { model: true }));

    decorate(block);

    const ritual = block.querySelector<HTMLElement>('.hotel-architect-ritual')!;
    expect(ritual.dataset.aueResource).toBe('urn:Resort');
    expect(
      [...ritual.querySelectorAll('.hotel-architect-slide')].map((slide) => slide.getAttribute('data-aue-resource')),
    ).toEqual(['urn:Resort/item0', 'urn:Resort/item1']);
    expect(ritual.querySelector('.hotel-architect-thumb')?.getAttribute('data-aue-resource')).toBe(
      'urn:Resort-thumb/item0',
    );
  });

  it('renders up to three static thumbnails independently of the primary carousel', () => {
    const block = build(IDENTITY_ROWS + ritualRow('Resort', { thumbnails: 4 }));
    decorate(block);

    const thumbs = block.querySelectorAll<HTMLElement>('.hotel-architect-thumb');
    expect(thumbs).toHaveLength(3);
    expect(block.querySelector('.hotel-architect-thumbs button')).toBeNull();
    expect([...block.querySelectorAll('.hotel-architect-thumb img')].map((img) => img.getAttribute('alt'))).toEqual([
      'Resort-thumb 1',
      'Resort-thumb 2',
      'Resort-thumb 3',
    ]);

    thumbs[1]!.click();
    expect(block.querySelector('.hotel-architect-slide.is-selected img')?.getAttribute('alt')).toBe('Resort 1');
  });

  it('steps and wraps through the gallery', () => {
    const block = build(IDENTITY_ROWS + ritualRow('Resort', { images: 3 }));
    decorate(block);

    const selected = (): number =>
      [...block.querySelectorAll('.hotel-architect-slide')].findIndex((slide) =>
        slide.classList.contains('is-selected'),
      );
    const click = (selector: string): void => block.querySelector<HTMLElement>(selector)!.click();

    expect(selected()).toBe(0);
    click('.hotel-architect-nav-next');
    expect(selected()).toBe(1);
    click('.hotel-architect-nav-prev');
    click('.hotel-architect-nav-prev');
    expect(selected()).toBe(2);
    click('.hotel-architect-dot[data-index="0"]');
    expect(selected()).toBe(0);
  });

  it('drops the controls for a single image and the thumbnails when there are none', () => {
    const block = build(IDENTITY_ROWS + ritualRow('Resort', { images: 1, thumbnails: 0, secondary: false }));

    decorate(block);

    expect(block.querySelector('.hotel-architect-nav')).toBeNull();
    expect(block.querySelector('.hotel-architect-dots')).toBeNull();
    expect(block.querySelector('.hotel-architect-thumbs')).toBeNull();
    expect(block.querySelector('.hotel-architect-cta-divider')).toBeNull();
    expect(block.querySelector('.hotel-architect-slide')?.classList.contains('is-selected')).toBe(true);
  });

  it('reads the card by cell content when an empty text field drops its cell', () => {
    const block = build(IDENTITY_ROWS + ritualRow('Resort') + cardRow(false, ''));

    decorate(block);

    const card = block.querySelector('.hotel-architect-card')!;
    expect(card.querySelector('.hotel-architect-card-name')?.textContent).toBe('The architect in his own words');
    expect(card.querySelector('.hotel-architect-card-role')).toBeNull();
    expect(card.querySelector('a')?.textContent).toBe('Discover');
    expect(card.querySelector('.hotel-architect-card-photo img')?.getAttribute('src')).toBe('fu.jpg');
  });

  it('reads a ritual by cell content when the empty eyebrow drops its cell', () => {
    const block = build(IDENTITY_ROWS + ritualRow('Resort', { eyebrow: null }));

    decorate(block);

    const ritual = block.querySelector<HTMLElement>('.hotel-architect-ritual')!;
    expect(ritual.querySelector('.hotel-architect-eyebrow')).toBeNull();
    expect(ritual.querySelector('.hotel-architect-title p')?.textContent).toBe('RESORT,');
    expect(ritual.querySelector('.hotel-architect-body')?.textContent).toBe('About Resort.');
    expect(ritual.querySelectorAll('.hotel-architect-thumb')).toHaveLength(3);
    expect(ritual.querySelectorAll('.hotel-architect-slide')).toHaveLength(2);
    expect([...ritual.querySelectorAll('.hotel-architect-cta a')].map((link) => link.textContent)).toEqual([
      'Enquire',
      'Details',
    ]);
  });
});

describe('hotel-architect with ritual tabs', () => {
  it.each([
    ['published content', false],
    ['editor content', true],
  ])('switches every part of the ritual from its tab with %s', (_label, instrumented) => {
    const block = build(
      IDENTITY_ROWS +
        ritualRow('Morning', { model: instrumented }) +
        ritualRow('Evening', { model: instrumented, images: 1 }) +
        cardRow(instrumented),
    );

    decorate(block);

    expect(block.classList.contains('hotel-architect-tabbed')).toBe(true);
    // the tabbed variation has no architect card, but keeps it for the editor
    expect(block.querySelector<HTMLElement>('.hotel-architect-cards')?.hidden).toBe(true);
    expect(block.classList.contains('hotel-architect-has-card')).toBe(false);

    const tabs = [...block.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Morning', 'Evening']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1]);

    let ritual = visibleRitual(block)!;
    expect(ritual.getAttribute('role')).toBe('tabpanel');
    expect(ritual.getAttribute('aria-labelledby')).toBe(tabs[0]!.id);
    expect(tabs[0]!.getAttribute('aria-controls')).toBe(ritual.id);
    expect(ritual.querySelector('.hotel-architect-title p')?.textContent).toBe('MORNING,');
    expect(ritual.querySelectorAll('.hotel-architect-slide')).toHaveLength(2);
    expect(ritual.querySelectorAll('.hotel-architect-nav')).toHaveLength(2);
    // the design shows only the arrows on a ritual's media
    expect(ritual.querySelector('.hotel-architect-dots')).toBeNull();

    tabs[1]!.click();

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    ritual = visibleRitual(block)!;
    expect(ritual.querySelector('.hotel-architect-title p')?.textContent).toBe('EVENING,');
    expect(ritual.querySelector('.hotel-architect-thumb img')?.getAttribute('alt')).toBe('Evening-thumb 1');
    expect(ritual.querySelector('.hotel-architect-slide img')?.getAttribute('alt')).toBe('Evening 1');
    expect(ritual.querySelector('.hotel-architect-nav')).toBeNull();
    expect(block.querySelectorAll('.hotel-architect-ritual:not([hidden])')).toHaveLength(1);
  });

  it('moves between tabs with the arrow, Home and End keys', () => {
    const block = build(IDENTITY_ROWS + ritualRow('One') + ritualRow('Two') + ritualRow('Three'));
    decorate(block);

    const tablist = block.querySelector<HTMLElement>('[role="tablist"]')!;
    const press = (key: string): void => {
      tablist.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    const selected = (): string | null | undefined => block.querySelector('[aria-selected="true"]')?.textContent;

    press('ArrowLeft');
    expect(selected()).toBe('Three');
    expect(document.activeElement?.textContent).toBe('Three');
    press('ArrowRight');
    expect(selected()).toBe('One');
    press('End');
    expect(selected()).toBe('Three');
    press('Home');
    expect(selected()).toBe('One');
  });

  it('gives a ritual just added in the editor a placeholder tab', () => {
    const empty = `<div data-aue-model="hotel-architect-ritual">${'<div></div>'.repeat(5)}<div>false</div><div>false</div><div></div></div>`;
    const block = build(IDENTITY_ROWS + ritualRow('Morning', { model: true }) + empty);

    decorate(block);

    expect([...block.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual(['Morning', 'Ritual 2']);
    expect(block.querySelectorAll('.hotel-architect-ritual')).toHaveLength(2);
  });

  it('reveals the ritual the editor selects', () => {
    const block = build(IDENTITY_ROWS + ritualRow('Morning', { model: true }) + ritualRow('Evening', { model: true }));
    decorate(block);

    const rituals = block.querySelectorAll<HTMLElement>('.hotel-architect-ritual');
    rituals[1]!.querySelector('.hotel-architect-slide')!.dispatchEvent(new Event('aue:ui-select', { bubbles: true }));

    expect(visibleRitual(block)).toBe(rituals[1]);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Evening');
  });
});
