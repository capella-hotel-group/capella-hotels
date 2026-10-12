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

function picture(src: string, alt = ''): string {
  return `<picture><img src="${src}" alt="${alt}"></picture>`;
}

function mediaGroup(index: number, options: { thumbnail?: boolean; video?: boolean; overlay?: boolean } = {}): string {
  const thumbnail = options.thumbnail ? `<p>${picture(`thumb${index}.jpg`, `Thumb ${index}`)}</p>` : '';
  const asset = options.video
    ? `<p><a href="/content/dam/video${index}.mp4">/content/dam/video${index}.mp4</a></p><p>Video ${index}</p>`
    : `<p>${picture(`media${index}.jpg`, `Media ${index}`)}</p>`;
  return `<div><div>${thumbnail}<p>${options.video ? 'video' : 'image'}</p>${asset}<p>${options.overlay ? 'true' : 'false'}</p></div></div>`;
}

function legacyItem(index: number): string {
  return `<div data-aue-resource="urn:item-${index}" data-aue-model="destination-introduction-image"><div>${picture(`legacy-thumb${index}.jpg`, `Legacy thumb ${index}`)}</div><div>image</div><div>${picture(`legacy${index}.jpg`, `Legacy ${index}`)}</div><div>false</div></div>`;
}

function build(rows: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'destination-introduction';
  block.innerHTML = rows;
  document.body.append(block);
  return block;
}

const REAL_SLIDES = '.destination-introduction-slide:not(.destination-introduction-slide-clone)';

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

  it('renders the three grouped media fields in order', () => {
    const block = build(
      COPY_ROWS +
        mediaGroup(1, { thumbnail: true, overlay: true }) +
        mediaGroup(2, { thumbnail: true, video: true }) +
        mediaGroup(3),
    );

    decorate(block);

    expect(block.id).toBe('destination-intro');
    expect(block.querySelector('.destination-introduction-cta')).toBeNull();
    const slides = block.querySelectorAll<HTMLElement>(REAL_SLIDES);
    expect(slides).toHaveLength(3);
    expect(slides[0]!.querySelector('img')?.getAttribute('src')).toBe('media1.jpg');
    expect(slides[0]!.classList.contains('has-dark-overlay')).toBe(true);
    expect(slides[1]!.querySelector('video source')?.getAttribute('src')).toBe('/content/dam/video2.mp4');
    expect(slides[1]!.querySelector('video')?.getAttribute('poster')).toBe('thumb2.jpg');
    expect(slides[1]!.querySelector('video')?.getAttribute('aria-label')).toBe('Video 2');
    expect(slides[2]!.querySelector('img')?.getAttribute('src')).toBe('media3.jpg');
    expect(
      [...block.querySelectorAll('.destination-introduction-thumb')].map((thumb) => thumb.getAttribute('aria-label')),
    ).toEqual(['Thumb 1', 'Thumb 2', 'Media 3']);
  });

  it('keeps copy aligned when later media groups have not emitted rows', () => {
    const block = build(COPY_ROWS + mediaGroup(1));

    decorate(block);

    expect(block.querySelector('.destination-introduction-eyebrow')?.textContent).toBe('THE DESTINATION');
    expect(block.querySelector('.destination-introduction-body')?.textContent).toBe('Body copy');
    expect(block.querySelectorAll(REAL_SLIDES)).toHaveLength(1);
  });

  it('ignores a retired footer CTA in previously published markup', () => {
    const block = build(COPY_ROWS + RETIRED_CTA_ROW + legacyItem(1));

    decorate(block);

    expect(block.id).toBe('destination-intro');
    expect(block.querySelector('.destination-introduction-eyebrow')?.textContent).toBe('THE DESTINATION');
    expect(block.querySelector('.destination-introduction-body')?.textContent).toBe('Body copy');
    expect(block.querySelector('a[href="/discover"]')).toBeNull();
  });

  it('keeps rendering retired media items until the block is re-authored', () => {
    const block = build(COPY_ROWS + legacyItem(1) + legacyItem(2) + legacyItem(3) + legacyItem(4));

    decorate(block);

    const slides = block.querySelectorAll<HTMLElement>(REAL_SLIDES);
    expect(slides).toHaveLength(3);
    expect(slides[0]!.dataset.aueResource).toBe('urn:item-1');
    expect([...block.querySelectorAll(`${REAL_SLIDES} img`)].map((img) => img.getAttribute('src'))).toEqual([
      'legacy1.jpg',
      'legacy2.jpg',
      'legacy3.jpg',
    ]);
  });

  it('adds inert clones around the slides for a continuous mobile loop', () => {
    const block = build(COPY_ROWS + mediaGroup(1) + mediaGroup(2) + mediaGroup(3));

    decorate(block);

    const clones = [...block.querySelectorAll<HTMLElement>('.destination-introduction-slide-clone')];
    expect(block.querySelectorAll('.destination-introduction-slide')).toHaveLength(9);
    expect(clones).toHaveLength(6);
    expect(clones.every((clone) => clone.getAttribute('aria-hidden') === 'true' && clone.inert)).toBe(true);
    expect(clones.some((clone) => clone.matches('[data-aue-resource], .is-selected'))).toBe(false);
  });

  it('moves through clones and settles on the matching real slide', () => {
    jest.useFakeTimers();
    const block = build(COPY_ROWS + mediaGroup(1) + mediaGroup(2) + mediaGroup(3));
    decorate(block);

    const track = block.querySelector<HTMLElement>('.destination-introduction-track')!;
    const items = [...track.children] as HTMLElement[];
    let scrollLeft = 900;
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 2700 });
    Object.defineProperty(track, 'scrollLeft', { configurable: true, get: () => scrollLeft });
    items.forEach((item, index) => Object.defineProperty(item, 'offsetLeft', { value: index * 300 }));
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
    const block = build(COPY_ROWS + mediaGroup(1) + mediaGroup(2) + mediaGroup(3));

    decorate(block);

    expect(block.querySelector('.destination-introduction-slide-clone')).toBeNull();
    document.body.classList.remove('adobe-ue-edit');
  });

  it('lets desktop thumbnails select a slide', () => {
    const block = build(COPY_ROWS + mediaGroup(1) + mediaGroup(2) + mediaGroup(3));
    decorate(block);

    block.querySelector<HTMLElement>('.destination-introduction-thumb[data-index="2"]')!.click();

    expect(selectedSlide(block)).toBe(2);
  });
});
