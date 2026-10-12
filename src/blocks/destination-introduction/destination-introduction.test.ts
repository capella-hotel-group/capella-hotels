import decorate from './destination-introduction';

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
jest.mock('@/utils/env', () => ({ resolveDAMUrl: (url: string) => url }));

const COPY_ROWS = [
  '<div><div>destination-intro</div></div>',
  '<div><div>destination-intro-qa</div></div>',
  '<div><div>THE DESTINATION</div></div>',
  '<div><div><p>TITLE</p></div></div>',
  '<div><div><p>Body copy</p></div></div>',
].join('');
const RETIRED_CTA_ROW = '<div><div><p>Discover</p><p><a href="/discover">/discover</a></p><p>false</p></div></div>';
const REAL_SLIDES = '.destination-introduction-slide:not(.destination-introduction-slide-clone)';

function picture(src: string, alt = ''): string {
  return `<picture><img src="${src}" alt="${alt}"></picture>`;
}

function mediaItem(index: number, options: { editor?: boolean; video?: boolean; overlay?: boolean } = {}): string {
  const attributes = options.editor
    ? ` data-aue-resource="urn:item-${index}" data-aue-model="destination-introduction-image" data-aue-type="component"`
    : '';
  const media = options.video
    ? `<a href="/content/dam/video${index}.mp4">/content/dam/video${index}.mp4</a><p>Video ${index}</p>`
    : picture(`media${index}.jpg`, `Media ${index}`);
  return `<div${attributes}><div>${picture(`thumb${index}.jpg`, `Thumb ${index}`)}</div><div>${options.video ? 'video' : 'image'}</div><div>${media}</div><div>${options.overlay ? 'true' : 'false'}</div></div>`;
}

function items(count: number, editor = false): string {
  return Array.from({ length: count }, (_value, index) => mediaItem(index + 1, { editor })).join('');
}

function build(rows: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'destination-introduction';
  block.innerHTML = rows;
  document.body.append(block);
  return block;
}

function realSlideImages(block: HTMLElement): (string | null)[] {
  return [...block.querySelectorAll(`${REAL_SLIDES} img`)].map((img) => img.getAttribute('src'));
}

function selectedSlide(block: HTMLElement): number {
  return [...block.querySelectorAll(REAL_SLIDES)].findIndex((slide) => slide.classList.contains('is-selected'));
}

describe('destination-introduction', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: jest.fn() });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: jest.fn(() => Promise.resolve()),
    });
    Object.defineProperty(window, 'IntersectionObserver', {
      configurable: true,
      value: class {
        observe(): void {}
        disconnect(): void {}
      },
    });
  });

  afterEach(() => {
    document.body.textContent = '';
  });

  it('renders image, video and overlay items', () => {
    const block = build(COPY_ROWS + mediaItem(1, { overlay: true }) + mediaItem(2, { video: true }) + mediaItem(3));

    decorate(block);

    expect(block.id).toBe('destination-intro');
    const slides = block.querySelectorAll<HTMLElement>(REAL_SLIDES);
    expect(slides).toHaveLength(3);
    expect(slides[0]!.classList.contains('has-dark-overlay')).toBe(true);
    expect(slides[1]!.querySelector('video source')?.getAttribute('src')).toBe('/content/dam/video2.mp4');
    expect(slides[1]!.querySelector('video')?.getAttribute('poster')).toBe('thumb2.jpg');
    expect(slides[1]!.querySelector('video')?.getAttribute('aria-label')).toBe('Video 2');
  });

  it.each([
    ['published content', false],
    ['editor content', true],
  ])('renders only the first three items from %s', (_label, editor) => {
    const block = build(COPY_ROWS + items(5, editor));

    decorate(block);

    expect(realSlideImages(block)).toEqual(['media1.jpg', 'media2.jpg', 'media3.jpg']);
    expect(
      [...block.querySelectorAll('.destination-introduction-thumb')].map((thumb) => thumb.getAttribute('aria-label')),
    ).toEqual(['Thumb 1', 'Thumb 2', 'Thumb 3']);
    expect(block.querySelector('.destination-introduction-overflow')).toBeNull();
    expect(block.textContent).not.toContain('Media 4');
    if (editor) {
      expect([...block.querySelectorAll<HTMLElement>(REAL_SLIDES)].map((slide) => slide.dataset.aueResource)).toEqual([
        'urn:item-1',
        'urn:item-2',
        'urn:item-3',
      ]);
    }
  });

  it('ignores a retired footer CTA in previously published markup', () => {
    const block = build(COPY_ROWS + RETIRED_CTA_ROW + items(1));

    decorate(block);

    expect(block.id).toBe('destination-intro');
    expect(block.querySelector('.destination-introduction-eyebrow')?.textContent).toBe('THE DESTINATION');
    expect(block.querySelector('.destination-introduction-body')?.textContent).toBe('Body copy');
    expect(block.querySelector('a[href="/discover"]')).toBeNull();
  });

  it('adds inert clones around the first three items for a continuous mobile loop', () => {
    const block = build(COPY_ROWS + items(5));

    decorate(block);

    const clones = [...block.querySelectorAll<HTMLElement>('.destination-introduction-slide-clone')];
    expect(block.querySelectorAll('.destination-introduction-slide')).toHaveLength(9);
    expect(clones).toHaveLength(6);
    expect(clones.every((clone) => clone.getAttribute('aria-hidden') === 'true' && clone.inert)).toBe(true);
    expect(clones.map((clone) => clone.querySelector('img')?.getAttribute('src'))).toEqual([
      'media1.jpg',
      'media2.jpg',
      'media3.jpg',
      'media1.jpg',
      'media2.jpg',
      'media3.jpg',
    ]);
  });

  it('moves through clones and settles on the matching real slide', () => {
    jest.useFakeTimers();
    const block = build(COPY_ROWS + items(3));
    decorate(block);

    const track = block.querySelector<HTMLElement>('.destination-introduction-track')!;
    const trackItems = [...track.children] as HTMLElement[];
    let scrollLeft = 900;
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 2700 });
    Object.defineProperty(track, 'scrollLeft', { configurable: true, get: () => scrollLeft });
    trackItems.forEach((item, index) => Object.defineProperty(item, 'offsetLeft', { value: index * 300 }));
    const scrollTo = jest.fn(({ left }: ScrollToOptions) => {
      scrollLeft = Number(left);
    });
    track.scrollTo = scrollTo as typeof track.scrollTo;
    const settle = (): void => {
      track.dispatchEvent(new Event('scroll'));
      jest.runOnlyPendingTimers();
    };

    block.querySelector<HTMLElement>('.destination-introduction-nav-prev')!.click();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 600, behavior: 'smooth' });
    settle();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1500, behavior: 'instant' });
    expect(selectedSlide(block)).toBe(2);

    block.querySelector<HTMLElement>('.destination-introduction-nav-next')!.click();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1800, behavior: 'smooth' });
    settle();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: 'instant' });
    expect(selectedSlide(block)).toBe(0);
    jest.useRealTimers();
  });

  it('keeps only authored slides in the editor', () => {
    document.body.classList.add('adobe-ue-edit');
    const block = build(COPY_ROWS + items(3, true));

    decorate(block);

    expect(block.querySelector('.destination-introduction-slide-clone')).toBeNull();
    document.body.classList.remove('adobe-ue-edit');
  });

  it('lets desktop thumbnails select a slide', () => {
    const block = build(COPY_ROWS + items(3));
    decorate(block);

    block.querySelector<HTMLElement>('.destination-introduction-thumb[data-index="2"]')!.click();

    expect(selectedSlide(block)).toBe(2);
  });
});
