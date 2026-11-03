const mockMoveInstrumentation = jest.fn((from: Element, to: Element | null) => {
  if (!to) return;
  [...from.attributes]
    .filter(({ name }) => name.startsWith('data-aue-') || name.startsWith('data-richtext-'))
    .forEach(({ name, value }) => {
      to.setAttribute(name, value);
      from.removeAttribute(name);
    });
});
jest.mock('@/app/scripts.js', () => ({
  moveInstrumentation: (...args: [Element, Element | null]) => mockMoveInstrumentation(...args),
}));
jest.mock('@/utils/env.js', () => ({ resolveDAMUrl: (url: string) => url }));

type Decorate = (block: HTMLElement) => void;

const pic = (src: string, alt = ''): string => `<picture><img src="${src}" alt="${alt}"></picture>`;
const link = (href: string): string => `<a href="${href}">${href}</a>`;
const CELLS = [pic('/intro.jpg', 'Tea'), '', link('/v.mp4'), '', pic('/poster.jpg'), 'true', 'true', 'Kyoto', '1500'];

describe('hero-destination video variant', () => {
  let decorate: Decorate;
  let reducedMotion: boolean;
  let mobileViewport: boolean;
  let breakpointListeners: Array<() => void>;

  beforeEach(async () => {
    jest.useFakeTimers();
    reducedMotion = false;
    mobileViewport = false;
    breakpointListeners = [];
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      get matches() {
        return query.includes('reduced-motion') ? reducedMotion : query.includes('max-width') && mobileViewport;
      },
      addEventListener: (_type: string, listener: () => void) => {
        if (query.includes('max-width')) breakpointListeners.push(listener);
      },
      removeEventListener: jest.fn(),
    }));
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = jest.fn();
    HTMLMediaElement.prototype.load = jest.fn();
    jest.resetModules();
    ({ default: decorate } = await import('../hero-destination'));
  });

  afterEach(() => {
    jest.useRealTimers();
    document.documentElement.className = '';
    delete document.body.dataset.heroIntro;
    delete (navigator as unknown as { connection?: unknown }).connection;
  });

  function build(cells = CELLS, { firstSection = true, properties = [] as string[] } = {}): HTMLElement {
    const lead = firstSection ? '' : '<div class="section"></div>';
    document.body.innerHTML = `<main>${lead}<div class="section"><div class="hero-destination video"></div></div></main>`;
    const block = document.querySelector('.hero-destination') as HTMLElement;
    cells.forEach((html, index) => {
      const row = document.createElement('div');
      row.innerHTML = `<div>${html}</div>`;
      if (properties[index]) {
        const cell = row.firstElementChild as HTMLElement;
        cell.setAttribute('data-aue-prop', properties[index]);
        cell.setAttribute('data-aue-label', properties[index]);
      }
      block.append(row);
    });
    return block;
  }
  const video = (block: HTMLElement) => block.querySelector('video') as HTMLVideoElement;
  const introImg = (block: HTMLElement) => block.querySelector('.hero-destination-video-intro img') as HTMLImageElement;
  const revealed = (block: HTMLElement) =>
    block.querySelector('.hero-destination-video-heading')!.classList.contains('is-revealed');

  it('renders the frame, video, intro and heading in the intro state', () => {
    const block = build();
    decorate(block);
    expect(block.getAttribute('data-testid')).toBe('hero-destination-video');
    expect(block.dataset.state).toBe('intro');
    expect(block.querySelector('.hero-destination-video-frame video')).not.toBeNull();
    expect(block.querySelector('.hero-destination-video-frame .hero-destination-video-intro')).not.toBeNull();
    expect(block.querySelector('h1')?.textContent).toBe('Kyoto');
    expect(block.querySelector('.hero-destination-track')).toBeNull();
    expect(document.body.dataset.heroIntro).toBe('intro');
  });

  it('keeps the heading an h2 outside the first section', () => {
    const block = build(CELLS, { firstSection: false });
    decorate(block);
    expect(block.querySelector('h2')?.textContent).toBe('Kyoto');
    expect(block.querySelector('h1')).toBeNull();
  });

  it('preserves instrumentation for every video-variant property', () => {
    const cells = [
      pic('/intro.jpg', 'Tea'),
      'Tea ceremony',
      pic('/intro-mobile.jpg'),
      link('/video.mp4'),
      link('/video-mobile.mp4'),
      pic('/poster.jpg'),
      'true',
      'true',
      'Kyoto',
      '1500',
    ];
    const properties = [
      'introImage',
      'introImageAlt',
      'introImageMobile',
      'video',
      'videoMobile',
      'poster',
      'loop',
      'showOverlay',
      'heading',
      'headingDelay',
    ];
    const block = build(cells, { properties });
    decorate(block);

    expect(block.getAttribute('data-testid')).toBe('hero-destination-video');
    expect(block.querySelector('.hero-destination-video-intro picture')?.getAttribute('data-aue-prop')).toBe(
      'introImage',
    );
    expect(block.querySelector('.hero-destination-video-intro img')?.getAttribute('data-aue-prop')).toBe(
      'introImageAlt',
    );
    expect(block.querySelector('.hero-destination-video-intro[data-aue-prop="introImageMobile"]')).not.toBeNull();
    expect(video(block).getAttribute('data-aue-prop')).toBe('video');
    expect(video(block).querySelector('source')?.getAttribute('data-aue-prop')).toBe('videoMobile');
    expect(video(block).querySelector('picture[data-aue-prop="poster"]')).not.toBeNull();
    expect(block.querySelector('[data-aue-prop="loop"]')).not.toBeNull();
    expect(block.getAttribute('data-aue-prop')).toBe('showOverlay');
    expect(block.querySelector('.hero-destination-video-heading')?.getAttribute('data-aue-prop')).toBe('heading');
    expect(block.querySelector('[data-aue-prop="headingDelay"]')).not.toBeNull();
  });

  it('waits for the newly selected source before late-crossfading', async () => {
    const cells = [...CELLS];
    cells[3] = link('/video-mobile.mp4');
    const block = build(cells);
    decorate(block);
    video(block).dispatchEvent(new Event('canplay'));
    mobileViewport = true;
    breakpointListeners.forEach((listener) => listener());
    introImg(block).dispatchEvent(new Event('load'));

    await jest.advanceTimersByTimeAsync(500);
    expect(block.classList.contains('is-crossfading')).toBe(false);
    expect(block.classList.contains('is-late-crossfade')).toBe(false);

    video(block).dispatchEvent(new Event('canplay'));
    await jest.advanceTimersByTimeAsync(0);
    expect(block.classList.contains('is-late-crossfade')).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('runs intro → crossfade → expanded → heading when the video is ready early', async () => {
    const block = build();
    decorate(block);
    video(block).dispatchEvent(new Event('canplay'));
    introImg(block).dispatchEvent(new Event('load'));

    await jest.advanceTimersByTimeAsync(500);
    expect(block.dataset.state).toBe('expanding');
    expect(block.classList.contains('is-crossfading')).toBe(true);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(225);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    video(block).dispatchEvent(new Event('playing'));

    await jest.advanceTimersByTimeAsync(675);
    expect(block.dataset.state).toBe('expanded');
    expect(document.body.dataset.heroIntro).toBe('done');

    await jest.advanceTimersByTimeAsync(824);
    expect(revealed(block)).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(revealed(block)).toBe(true);
  });

  it('resumes a changed source after playback without replaying the intro transition', async () => {
    const cells = [...CELLS];
    cells[3] = link('/video-mobile.mp4');
    const block = build(cells);
    decorate(block);
    video(block).dispatchEvent(new Event('canplay'));
    introImg(block).dispatchEvent(new Event('load'));
    await jest.advanceTimersByTimeAsync(500 + 225);
    video(block).dispatchEvent(new Event('playing'));
    await jest.advanceTimersByTimeAsync(675 + 1500);
    expect(block.dataset.state).toBe('expanded');
    expect(revealed(block)).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    mobileViewport = true;
    breakpointListeners.forEach((listener) => listener());

    expect(video(block).querySelector('source')?.getAttribute('src')).toBe('/video-mobile.mp4');
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    expect(block.dataset.state).toBe('expanded');
    expect(revealed(block)).toBe(true);
    expect(block.classList.contains('is-late-crossfade')).toBe(false);
  });

  it('starts expanding after 3s even if the intro image never loads', async () => {
    const block = build();
    decorate(block);
    await jest.advanceTimersByTimeAsync(2999);
    expect(block.dataset.state).toBe('intro');
    await jest.advanceTimersByTimeAsync(1);
    expect(block.dataset.state).toBe('expanding');
  });

  it('late-crossfades when the video becomes ready after expansion starts', async () => {
    const block = build();
    decorate(block);
    introImg(block).dispatchEvent(new Event('load'));
    await jest.advanceTimersByTimeAsync(1400);
    expect(block.classList.contains('is-crossfading')).toBe(false);
    video(block).dispatchEvent(new Event('canplay'));
    await jest.advanceTimersByTimeAsync(0);
    expect(block.classList.contains('is-late-crossfade')).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it('keeps the image and reveals the heading at expanded + delay when the video errors', async () => {
    const block = build();
    decorate(block);
    introImg(block).dispatchEvent(new Event('load'));
    video(block).dispatchEvent(new Event('error'));
    await jest.advanceTimersByTimeAsync(2899);
    expect(revealed(block)).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(revealed(block)).toBe(true);
    expect(block.classList.contains('is-crossfading')).toBe(false);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it('renders the final state without video under reduced motion when an intro image exists', () => {
    reducedMotion = true;
    const block = build();
    decorate(block);
    expect(block.dataset.state).toBe('expanded');
    expect(block.classList.contains('is-static')).toBe(true);
    expect(block.querySelector('video')).toBeNull();
    expect(revealed(block)).toBe(true);
    expect(document.body.dataset.heroIntro).toBeUndefined();
  });

  it('shows the paused video with its poster under reduced motion when no intro image exists', () => {
    reducedMotion = true;
    const cells = [...CELLS];
    cells[0] = '';
    const block = build(cells);
    decorate(block);
    expect(block.classList.contains('is-video-visible')).toBe(true);
    expect(video(block).getAttribute('poster')).toBe('/poster.jpg');
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(revealed(block)).toBe(true);
  });

  it('skips the intro and plays immediately in the Universal Editor', () => {
    document.documentElement.classList.add('adobe-ue-edit');
    const block = build();
    decorate(block);
    expect(block.dataset.state).toBe('expanded');
    expect(block.classList.contains('is-video-visible')).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(revealed(block)).toBe(true);
    expect(document.body.dataset.heroIntro).toBeUndefined();
  });

  it('plays immediately and reveals after playing + delay when there is no intro image', async () => {
    const cells = [...CELLS];
    cells[0] = '';
    const block = build(cells);
    decorate(block);
    expect(block.classList.contains('is-video-visible')).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    video(block).dispatchEvent(new Event('playing'));
    await jest.advanceTimersByTimeAsync(1500);
    expect(revealed(block)).toBe(true);
  });

  it('keeps video field instrumentation in the intro wrapper when Save-Data disables playback', () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    const block = build(CELLS, { properties: ['introImage', '', 'video', '', 'poster'] });
    decorate(block);

    expect(block.querySelector('video')).toBeNull();
    expect(block.querySelector('.hero-destination-video-intro')?.getAttribute('data-aue-prop')).toBe('video');
    expect(block.querySelector('picture[data-aue-prop="poster"]')).not.toBeNull();
    expect(block.getAttribute('data-testid')).toBe('hero-destination-video');
  });

  it('does not load a video when Save-Data is on', async () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    const block = build();
    decorate(block);
    expect(block.querySelector('video')).toBeNull();
    introImg(block).dispatchEvent(new Event('load'));
    await jest.advanceTimersByTimeAsync(1400 + 1500);
    expect(block.dataset.state).toBe('expanded');
    expect(revealed(block)).toBe(true);
  });

  it('leaves the header alone when the hero is not in the first section', () => {
    decorate(build(CELLS, { firstSection: false }));
    expect(document.body.dataset.heroIntro).toBeUndefined();
  });

  it('leaves the header alone when another hero already owns it', () => {
    const block = build();
    document.body.dataset.heroIntro = 'done';
    decorate(block);
    expect(document.body.dataset.heroIntro).toBe('done');
  });

  it('marks the block when the overlay is disabled', () => {
    const cells = [...CELLS];
    cells[6] = 'false';
    const block = build(cells);
    decorate(block);
    expect(block.classList.contains('hero-destination-video--no-overlay')).toBe(true);
  });
});
