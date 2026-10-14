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

// Mirrors the markup the pipeline actually delivers: rich text arrives unwrapped
// with soft breaks, and a CTA group emits its label, link and flag as siblings.
const COPY_ROWS = [
  '<div><div>the-architect</div></div>',
  '<div><div>architect-qa</div></div>',
  '<div><div>THE RESORT</div></div>',
  '<div><div>RED EARTH,<br>GREEN CANOPY</div></div>',
  '<div><div>Outside, 30 acres of lush landscapes.</div></div>',
  '<div><div><p>Book your stay</p><p><a href="/book">/book</a></p><p>false</p></div></div>',
  '<div><div><p>Learn more</p><p><a href="/story">/story</a></p><p>true</p></div></div>',
].join('');

function imageRow(index: number, overlay: 'true' | 'false', model = false, legacyThumbnail = ''): string {
  const attribute = model ? ' data-aue-model="hotel-architect-image"' : '';
  const thumbnailCell = legacyThumbnail
    ? `<div><picture><img src="${legacyThumbnail}" alt="Legacy thumb ${index}"></picture></div>`
    : '';
  return `<div${attribute}><div><picture><img src="img${index}.jpg" alt="Image ${index}"></picture></div>${thumbnailCell}<div>${overlay}</div></div>`;
}

function thumbnailsRow(count: number): string {
  const pictures = Array.from(
    { length: count },
    (_value, index) => `<picture><img src="thumb${index + 1}.jpg" alt="Thumbnail ${index + 1}"></picture>`,
  ).join('');
  return `<div><div>${pictures}</div></div>`;
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

describe('hotel-architect', () => {
  afterEach(() => {
    document.body.textContent = '';
  });

  it.each([
    ['published content', false],
    ['editor content', true],
  ])('renders copy, gallery and architect card from %s', (_label, instrumented) => {
    const block = build(
      COPY_ROWS + imageRow(1, 'true', instrumented) + imageRow(2, 'false', instrumented) + cardRow(instrumented),
    );

    decorate(block);

    expect(block.id).toBe('the-architect');
    expect(block.dataset.testId).toBe('architect-qa');
    expect(block.querySelector('.hotel-architect-eyebrow')?.textContent).toBe('THE RESORT');
    expect(block.querySelectorAll('.hotel-architect-title > p')).toHaveLength(2);
    expect(block.querySelector('.hotel-architect-body')?.textContent).toContain('30 acres');

    const ctas = block.querySelectorAll<HTMLAnchorElement>('.hotel-architect-cta a');
    expect([...ctas].map((cta) => cta.textContent)).toEqual(['Book your stay', 'Learn more']);
    expect(ctas[0]!.target).toBe('');
    expect(ctas[1]!.target).toBe('_blank');
    expect(block.querySelectorAll('.hotel-architect-cta-divider')).toHaveLength(1);

    const slides = block.querySelectorAll('.hotel-architect-slide');
    expect(slides).toHaveLength(2);
    expect(slides[0]!.classList.contains('hotel-architect-slide-no-overlay')).toBe(false);
    expect(slides[1]!.classList.contains('hotel-architect-slide-no-overlay')).toBe(true);
    expect(block.querySelector('.hotel-architect-thumbs')).toBeNull();
    expect(block.querySelector('.hotel-architect-dot')?.getAttribute('aria-label')).toBe('Image 1');

    const card = block.querySelector('.hotel-architect-card');
    expect(card?.querySelector('.hotel-architect-card-name')?.textContent).toBe('Andre Fu');
    expect(card?.querySelector('.hotel-architect-card-role')?.textContent).toBe('The architect in his own words');
    expect(card?.querySelector('a')?.getAttribute('href')).toBe('/architect');
  });

  it('keeps the overlay on when the flag cell is missing', () => {
    const block = build(COPY_ROWS + '<div><div><picture><img src="a.jpg"></picture></div><div></div></div>');

    decorate(block);

    expect(block.querySelector('.hotel-architect-slide-no-overlay')).toBeNull();
  });

  it('reads the card by cell content when an empty text field drops its cell', () => {
    const block = build(COPY_ROWS + imageRow(1, 'true') + cardRow(false, ''));

    decorate(block);

    const card = block.querySelector('.hotel-architect-card')!;
    expect(card.querySelector('.hotel-architect-card-name')?.textContent).toBe('The architect in his own words');
    expect(card.querySelector('.hotel-architect-card-role')).toBeNull();
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/architect');
    expect(card.querySelector('a')?.textContent).toBe('Discover');
    expect(card.querySelector('.hotel-architect-card-photo img')?.getAttribute('src')).toBe('fu.jpg');
  });

  it('renders up to three static thumbnails independently of the primary carousel', () => {
    const block = build(COPY_ROWS + thumbnailsRow(4) + imageRow(1, 'true') + imageRow(2, 'true'));
    decorate(block);

    const thumbs = block.querySelectorAll<HTMLElement>('.hotel-architect-thumb');
    expect(thumbs).toHaveLength(3);
    expect(block.querySelector('.hotel-architect-thumbs button')).toBeNull();
    expect([...block.querySelectorAll('.hotel-architect-thumb img')].map((img) => img.getAttribute('alt'))).toEqual([
      'Thumbnail 1',
      'Thumbnail 2',
      'Thumbnail 3',
    ]);

    thumbs[1]!.click();
    expect(block.querySelector('.hotel-architect-slide.is-selected img')?.getAttribute('src')).toBe('img1.jpg');
  });

  it('renders thumbnails with a single primary image and reads grouped sibling alt text', () => {
    const block = build(
      COPY_ROWS +
        '<div><div><p><picture><img src="thumb.jpg"></picture></p><p>Pool terrace</p></div></div>' +
        imageRow(1, 'true'),
    );

    decorate(block);

    expect(block.querySelector('.hotel-architect-nav')).toBeNull();
    expect(block.querySelector('.hotel-architect-thumb img')?.getAttribute('alt')).toBe('Pool terrace');
  });

  it('keeps copy rows aligned when the thumbnail group is empty', () => {
    const block = build(COPY_ROWS + '<div><div></div></div>' + imageRow(1, 'true'));

    decorate(block);

    expect(block.id).toBe('the-architect');
    expect(block.querySelector('.hotel-architect-eyebrow')?.textContent).toBe('THE RESORT');
    expect([...block.querySelectorAll('.hotel-architect-cta a')].map((cta) => cta.textContent)).toEqual([
      'Book your stay',
      'Learn more',
    ]);
    expect(block.querySelector('.hotel-architect-thumbs')).toBeNull();
  });

  it('ignores retired per-slide thumbnails', () => {
    const block = build(COPY_ROWS + imageRow(1, 'true', false, 'legacy.jpg') + imageRow(2, 'true'));

    decorate(block);

    expect(block.querySelector('.hotel-architect-thumbs')).toBeNull();
    expect(
      [...block.querySelectorAll<HTMLImageElement>('.hotel-architect-slide img')].map((img) => img.getAttribute('src')),
    ).toEqual(['img1.jpg', 'img2.jpg']);
  });

  it('steps and wraps through the gallery', () => {
    const block = build(COPY_ROWS + imageRow(1, 'true') + imageRow(2, 'true') + imageRow(3, 'true'));
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

  it('drops the controls for a single image', () => {
    const block = build(COPY_ROWS + imageRow(1, 'true'));

    decorate(block);

    expect(block.querySelector('.hotel-architect-nav')).toBeNull();
    expect(block.querySelector('.hotel-architect-thumbs')).toBeNull();
    expect(block.querySelector('.hotel-architect-slide')?.classList.contains('is-selected')).toBe(true);
  });

  it('renders an empty editor item so a freshly added one stays selectable', () => {
    const block = build(
      COPY_ROWS + '<div data-aue-model="hotel-architect-image"><div></div><div></div><div>true</div></div>',
    );

    decorate(block);

    expect(block.querySelectorAll('.hotel-architect-slide')).toHaveLength(1);
  });
});

interface RitualOptions {
  images?: number;
  model?: boolean;
  eyebrow?: string | null;
  secondary?: boolean;
}

// Mirrors the delivered ritual item: the primary images multifield renders as a
// list, the thumbnails and each CTA collapse into one grouped cell.
function ritualRow(
  label: string,
  { images = 2, model = false, eyebrow = 'RITUAL', secondary = true }: RitualOptions = {},
) {
  const attribute = model ? ' data-aue-model="hotel-architect-ritual"' : '';
  const media = Array.from(
    { length: images },
    (_value, index) => `<li><picture><img src="${label}-${index + 1}.jpg" alt="${label} ${index + 1}"></picture></li>`,
  ).join('');
  const cells = [
    `<div>${label}</div>`,
    eyebrow === null ? '' : `<div>${eyebrow}</div>`,
    `<div>${label.toUpperCase()}</div>`,
    `<div>About ${label}.</div>`,
    `<div><ul>${media}</ul></div>`,
    `<div><p><picture><img src="${label}-thumb.jpg" alt="${label} thumb"></picture></p></div>`,
    '<div><p>Enquire</p><p><a href="/enquire">/enquire</a></p><p>false</p></div>',
    secondary ? '<div><p>Details</p><p><a href="/details">/details</a></p><p>true</p></div>' : '<div>false</div>',
  ];
  return `<div${attribute}>${cells.join('')}</div>`;
}

describe('hotel-architect rituals', () => {
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

  const visiblePanel = (block: HTMLElement): HTMLElement | undefined =>
    [...block.querySelectorAll<HTMLElement>('.hotel-architect-panel')].find((panel) => !panel.hidden);
  const visibleMedia = (block: HTMLElement): HTMLElement | undefined =>
    [...block.querySelectorAll<HTMLElement>('.hotel-architect-media')].find((media) => !media.hidden);

  it.each([
    ['published content', false],
    ['editor content', true],
  ])('switches every part of the ritual from its tab with %s', (_label, instrumented) => {
    const block = build(
      COPY_ROWS +
        imageRow(1, 'true', instrumented) +
        cardRow(instrumented) +
        ritualRow('Morning', { model: instrumented }) +
        ritualRow('Evening', { model: instrumented, images: 1 }),
    );

    decorate(block);

    expect(block.id).toBe('the-architect');
    expect(block.classList.contains('hotel-architect-rituals')).toBe(true);
    // the tabbed variation drops the architect card and the block-level gallery
    expect(block.querySelector('.hotel-architect-card')).toBeNull();
    expect(block.querySelector('img[src="img1.jpg"]')).toBeNull();

    const tabs = [...block.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Morning', 'Evening']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1]);

    let panel = visiblePanel(block)!;
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0]!.id);
    expect(tabs[0]!.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.querySelector('.hotel-architect-eyebrow')?.textContent).toBe('RITUAL');
    expect(panel.querySelector('.hotel-architect-title')?.textContent).toBe('MORNING');
    expect(panel.querySelector('.hotel-architect-body')?.textContent).toBe('About Morning.');
    expect(panel.querySelector('.hotel-architect-thumb img')?.getAttribute('alt')).toBe('Morning thumb');
    expect([...panel.querySelectorAll('.hotel-architect-cta a')].map((link) => link.textContent)).toEqual([
      'Enquire',
      'Details',
    ]);
    expect(panel.querySelectorAll('.hotel-architect-cta-divider')).toHaveLength(1);

    let media = visibleMedia(block)!;
    expect(media.querySelectorAll('.hotel-architect-slide')).toHaveLength(2);
    expect(media.querySelector('.hotel-architect-slide.is-selected img')?.getAttribute('alt')).toBe('Morning 1');
    expect(media.querySelectorAll('.hotel-architect-nav')).toHaveLength(2);
    expect(media.querySelector('.hotel-architect-dots')).toBeNull();

    tabs[1]!.click();

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true']);
    panel = visiblePanel(block)!;
    expect(panel.querySelector('.hotel-architect-title')?.textContent).toBe('EVENING');
    media = visibleMedia(block)!;
    expect(media.querySelector('.hotel-architect-slide img')?.getAttribute('src')).toBe('Evening-1.jpg');
    // a single primary image is a static photo
    expect(media.querySelector('.hotel-architect-nav')).toBeNull();
    expect(block.querySelectorAll('.hotel-architect-panel:not([hidden])')).toHaveLength(1);
    expect(block.querySelectorAll('.hotel-architect-media:not([hidden])')).toHaveLength(1);
  });

  it('moves between tabs with the arrow, Home and End keys', () => {
    const block = build(COPY_ROWS + ritualRow('One') + ritualRow('Two') + ritualRow('Three'));
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

  it('hides the tab bar for a single ritual', () => {
    const block = build(COPY_ROWS + ritualRow('Morning', { images: 1, secondary: false }));

    decorate(block);

    expect(block.querySelector('[role="tablist"]')).toBeNull();
    const panel = block.querySelector<HTMLElement>('.hotel-architect-panel')!;
    expect(panel.hidden).toBe(false);
    expect(panel.hasAttribute('role')).toBe(false);
    expect(panel.querySelectorAll('.hotel-architect-cta a')).toHaveLength(1);
    expect(panel.querySelector('.hotel-architect-cta-divider')).toBeNull();
    expect(block.querySelector('.hotel-architect-nav')).toBeNull();
  });

  it('reads a ritual by cell content when the empty eyebrow drops its cell', () => {
    const block = build(COPY_ROWS + ritualRow('Morning', { eyebrow: null }));

    decorate(block);

    const panel = block.querySelector<HTMLElement>('.hotel-architect-panel')!;
    expect(panel.querySelector('.hotel-architect-eyebrow')).toBeNull();
    expect(panel.querySelector('.hotel-architect-title')?.textContent).toBe('MORNING');
    expect(panel.querySelector('.hotel-architect-body')?.textContent).toBe('About Morning.');
    expect(block.querySelectorAll('.hotel-architect-slide')).toHaveLength(2);
    expect([...panel.querySelectorAll('.hotel-architect-cta a')].map((link) => link.textContent)).toEqual([
      'Enquire',
      'Details',
    ]);
  });

  it('gives a ritual just added in the editor a placeholder tab', () => {
    const empty = `<div data-aue-model="hotel-architect-ritual">${'<div></div>'.repeat(7)}<div>false</div></div>`;
    const block = build(COPY_ROWS + ritualRow('Morning', { model: true }) + empty);

    decorate(block);

    expect([...block.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual(['Morning', 'Ritual 2']);
  });

  it('reveals the ritual the editor selects', () => {
    const block = build(COPY_ROWS + ritualRow('Morning', { model: true }) + ritualRow('Evening', { model: true }));
    decorate(block);

    const panels = block.querySelectorAll<HTMLElement>('.hotel-architect-panel');
    panels[1]!.dispatchEvent(new Event('aue:ui-select', { bubbles: true }));

    expect(visiblePanel(block)).toBe(panels[1]);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Evening');
  });
});
