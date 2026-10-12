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
