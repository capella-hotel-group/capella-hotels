jest.mock('@/app/scripts.js', () => ({ moveInstrumentation: () => {} }));
jest.mock('@/utils/env.js', () => ({ resolveDAMUrl: (url: string) => url }));

type Decorate = (block: HTMLElement) => void;

/** Config rows (single cell) then item rows: mediaType, media, heading. */
function buildBlock(config: string[], count: number, kind: 'video' | 'image' = 'video'): HTMLElement {
  const media = (index: number): string =>
    kind === 'video'
      ? `<a href="/clip-${index}.mp4">clip</a>`
      : `<picture><img src="/img-${index}.png" alt=""></picture>`;
  const block = document.createElement('div');
  block.className = 'hero-destination';
  block.innerHTML =
    config.map((value) => `<div><div>${value}</div></div>`).join('') +
    Array.from(
      { length: count },
      (_, index) => `<div><div>${kind}</div><div>${media(index)}</div><div>Slide ${index}</div></div>`,
    ).join('');
  document.body.append(block);
  return block;
}

function pointer(type: string, pointerType: string): Event {
  const event = new Event(type, { bubbles: false });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

describe('hero-destination pause mechanism', () => {
  let decorate: Decorate;

  beforeEach(async () => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = jest.fn();
    HTMLMediaElement.prototype.load = jest.fn();
    window.ResizeObserver = jest.fn().mockReturnValue({ observe: jest.fn(), disconnect: jest.fn() });
    // media.ts reads matchMedia at module scope, so the stub has to be in place before import.
    jest.resetModules();
    ({ default: decorate } = await import('./hero-destination'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function activeIndex(block: HTMLElement): number {
    return [...block.querySelectorAll('.hero-destination-slide')].findIndex(
      (slide) => slide.getAttribute('aria-hidden') === 'false',
    );
  }

  it('renders a pause toggle when autoplay is on', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);

    const toggle = block.querySelector<HTMLButtonElement>('.hero-destination-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-label')).toBe('Pause slideshow');
    expect(block.querySelector('.hero-destination-dots')?.contains(toggle!)).toBe(false);
  });

  it('exposes data-testid hooks on the root, dots and toggle', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);

    expect(block.getAttribute('data-testid')).toBe('hero-destination');
    const dots = block.querySelectorAll('.hero-destination-dot');
    expect(dots).toHaveLength(3);
    dots.forEach((dot) => expect(dot.getAttribute('data-testid')).toBe('hero-destination-dot'));
    expect(block.querySelector('.hero-destination-toggle')?.getAttribute('data-testid')).toBe(
      'hero-destination-toggle',
    );
  });

  it('omits the toggle when there is no auto-moving content', () => {
    const block = buildBlock(['false', '5'], 3, 'image');
    decorate(block);

    expect(block.querySelector('.hero-destination-toggle')).toBeNull();
  });

  it('offers a video toggle when autoplay is off but background videos loop', () => {
    const block = buildBlock(['false', '5'], 1);
    decorate(block);

    const toggle = block.querySelector<HTMLButtonElement>('.hero-destination-toggle');
    expect(toggle?.getAttribute('aria-label')).toBe('Pause background video');
    toggle!.click();
    expect(toggle!.getAttribute('aria-label')).toBe('Play background video');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('starts videos paused under reduced motion', () => {
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    const block = buildBlock(['true', '5'], 2);
    decorate(block);

    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(block.querySelector('.hero-destination-toggle')?.getAttribute('aria-label')).toBe('Play background video');
  });

  it('plays only the active slide video and advances when it ends', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);
    const videos = [...block.querySelectorAll('video')];
    const play = HTMLMediaElement.prototype.play as jest.Mock;
    const lastPlayed = (): HTMLVideoElement => play.mock.contexts[play.mock.contexts.length - 1];

    expect(lastPlayed()).toBe(videos[0]);
    expect(videos.map((video) => video.querySelector('source')?.getAttribute('src') ?? null)).toEqual([
      '/clip-0.mp4',
      null,
      null,
    ]);

    const toggle = block.querySelector<HTMLButtonElement>('.hero-destination-toggle')!;
    toggle.click();
    toggle.click();
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(0);
  });

  it('offers to replay a finished non-looping slideshow', () => {
    const block = buildBlock(['true', '5', 'false'], 2, 'image');
    decorate(block);
    const toggle = block.querySelector<HTMLButtonElement>('.hero-destination-toggle')!;

    jest.advanceTimersByTime(10_000);
    expect(activeIndex(block)).toBe(1);
    expect(toggle.getAttribute('aria-label')).toBe('Play slideshow');

    toggle.click();
    expect(activeIndex(block)).toBe(0);
    expect(toggle.getAttribute('aria-label')).toBe('Pause slideshow');
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(1);
  });

  it('keeps a single slide out of tab semantics', () => {
    const block = buildBlock(['true', '5'], 1, 'image');
    decorate(block);
    const slide = block.querySelector('.hero-destination-slide')!;

    expect(slide.hasAttribute('role')).toBe(false);
    expect(slide.hasAttribute('aria-labelledby')).toBe(false);
    expect(slide.hasAttribute('tabindex')).toBe(false);
    expect(block.querySelector('.hero-destination-track')?.hasAttribute('role')).toBe(false);
  });

  it('promotes the first heading to h1 only in the first section of a page without one', () => {
    document.body.innerHTML = '<main><div class="section"></div><div class="section"></div></main>';
    const [first, second] = document.querySelectorAll('.section');
    const lead = buildBlock(['true', '5'], 2, 'image');
    first.append(lead);
    decorate(lead);
    const later = buildBlock(['true', '5'], 2, 'image');
    second.append(later);
    decorate(later);

    expect([...lead.querySelectorAll('.hero-destination-heading')].map((h) => h.tagName)).toEqual(['H1', 'H2']);
    expect([...later.querySelectorAll('.hero-destination-heading')].map((h) => h.tagName)).toEqual(['H2', 'H2']);
  });

  it('pauses on mouse hover over pagination dots and resumes on leave', () => {
    const block = buildBlock(['true', '5'], 3, 'image');
    decorate(block);
    const nav = block.querySelector<HTMLElement>('.hero-destination-dots')!;

    nav.dispatchEvent(pointer('pointerenter', 'mouse'));
    jest.advanceTimersByTime(20_000);
    expect(activeIndex(block)).toBe(0);

    nav.dispatchEvent(pointer('pointerleave', 'mouse'));
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(1);
  });

  it('pauses on mouse hover over text heading and resumes on leave', () => {
    const block = buildBlock(['true', '5'], 3, 'image');
    decorate(block);
    const heading = block.querySelector<HTMLElement>('.hero-destination-heading')!;

    heading.dispatchEvent(pointer('pointerenter', 'mouse'));
    jest.advanceTimersByTime(20_000);
    expect(activeIndex(block)).toBe(0);

    heading.dispatchEvent(pointer('pointerleave', 'mouse'));
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(1);
  });

  it('does not pause when hovering over the video background', () => {
    const block = buildBlock(['true', '5'], 3, 'image');
    decorate(block);

    block.dispatchEvent(pointer('pointerenter', 'mouse'));
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(1);
  });

  it('ignores touch pointers so a tap cannot freeze autoplay', () => {
    const block = buildBlock(['true', '5'], 3, 'image');
    decorate(block);
    const nav = block.querySelector<HTMLElement>('.hero-destination-dots')!;
    const heading = block.querySelector<HTMLElement>('.hero-destination-heading')!;

    nav.dispatchEvent(pointer('pointerenter', 'touch'));
    heading.dispatchEvent(pointer('pointerenter', 'touch'));
    jest.advanceTimersByTime(5000);

    expect(activeIndex(block)).toBe(1);
  });

  it('pauses while a dot has focus and keeps the timer stopped when moving between dots', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);
    const [first, second] = block.querySelectorAll<HTMLButtonElement>('.hero-destination-dot');

    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    jest.advanceTimersByTime(20_000);
    expect(activeIndex(block)).toBe(0);

    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: second }));
    jest.advanceTimersByTime(20_000);
    expect(activeIndex(block)).toBe(0);
  });

  it('toggles slide rotation and video playback, and survives a hover resume', async () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);
    const toggle = block.querySelector<HTMLButtonElement>('.hero-destination-toggle')!;
    const nav = block.querySelector<HTMLElement>('.hero-destination-dots')!;

    toggle.click();
    expect(toggle.getAttribute('aria-label')).toBe('Play slideshow');
    expect(toggle.dataset.state).toBe('paused');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    nav.dispatchEvent(pointer('pointerenter', 'mouse'));
    nav.dispatchEvent(pointer('pointerleave', 'mouse'));
    jest.advanceTimersByTime(20_000);
    expect(activeIndex(block)).toBe(0);

    toggle.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    toggle.click();
    expect(toggle.getAttribute('aria-label')).toBe('Pause slideshow');
    block.querySelector('video')!.dispatchEvent(new Event('ended'));
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1);
    expect(activeIndex(block)).toBe(1);
  });

  it('pairs every dot with its slide panel and names it after the heading', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);
    const dots = [...block.querySelectorAll<HTMLButtonElement>('.hero-destination-dot')];
    const slides = [...block.querySelectorAll<HTMLElement>('.hero-destination-slide')];

    dots.forEach((dot, index) => {
      expect(slides[index].getAttribute('role')).toBe('tabpanel');
      expect(dot.getAttribute('aria-controls')).toBe(slides[index].id);
      expect(slides[index].getAttribute('aria-labelledby')).toBe(dot.id);
      expect(dot.getAttribute('aria-label')).toBe(`Slide ${index}`);
    });

    expect(dots.map((dot) => dot.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(dots.map((dot) => dot.tabIndex)).toEqual([0, -1, -1]);
    expect(slides.map((slide) => slide.getAttribute('tabindex'))).toEqual(['0', null, null]);
  });

  it('moves selection and focus with arrow keys, wrapping at the ends', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);
    const dots = [...block.querySelectorAll<HTMLButtonElement>('.hero-destination-dot')];

    dots[0].focus();
    dots[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(activeIndex(block)).toBe(1);
    expect(document.activeElement).toBe(dots[1]);

    dots[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(activeIndex(block)).toBe(0);

    dots[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(activeIndex(block)).toBe(2);
  });

  it('silences the live region while auto-rotating and reopens it once paused', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);
    const track = block.querySelector('.hero-destination-track')!;
    const nav = block.querySelector<HTMLElement>('.hero-destination-dots')!;

    expect(track.getAttribute('aria-live')).toBe('off');

    nav.dispatchEvent(pointer('pointerenter', 'mouse'));
    expect(track.getAttribute('aria-live')).toBe('polite');

    nav.dispatchEvent(pointer('pointerleave', 'mouse'));
    expect(track.getAttribute('aria-live')).toBe('off');
  });
});

describe('hero-destination merged intro and media', () => {
  let decorate: Decorate;
  const CONFIG = ['true', '5', 'true', 'fade', 'true'];
  const pic = (src: string): string => `<picture><img src="${src}" alt=""></picture>`;

  function block(introCells: string[], items: string[][]): HTMLElement {
    document.body.innerHTML = '<main><div class="section"><div class="hero-destination"></div></div></main>';
    const el = document.querySelector('.hero-destination') as HTMLElement;
    el.innerHTML =
      [...introCells, ...CONFIG].map((value) => `<div><div>${value}</div></div>`).join('') +
      items.map((cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`).join('');
    return el;
  }
  const videoItem = (n: number): string[] => ['video', `<a href="/v-${n}.mp4">v</a>`, 'true', `Video ${n}`];
  const imageItem = (n: number): string[] => ['image', pic(`/i-${n}.jpg`), 'true', `Image ${n}`];
  const active = (el: HTMLElement): number =>
    [...el.querySelectorAll('.hero-destination-slide')].findIndex((s) => s.getAttribute('aria-hidden') === 'false');

  beforeEach(async () => {
    jest.useFakeTimers();
    document.documentElement.className = '';
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.pause = jest.fn();
    HTMLMediaElement.prototype.load = jest.fn();
    window.ResizeObserver = jest.fn().mockReturnValue({ observe: jest.fn(), disconnect: jest.fn() });
    jest.resetModules();
    ({ default: decorate } = await import('./hero-destination'));
  });

  afterEach(() => {
    jest.useRealTimers();
    document.documentElement.className = '';
    delete document.body.dataset.heroIntro;
  });

  it('wraps the track in a frame and renders the intro', () => {
    const el = block([pic('/intro.jpg'), pic('/intro-m.jpg')], [imageItem(0), imageItem(1)]);
    decorate(el);
    expect(el.querySelector('.hero-destination-frame > .hero-destination-track')).not.toBeNull();
    expect(el.querySelector('.hero-destination-frame > .hero-destination-intro')).not.toBeNull();
    expect(el.dataset.state).toBe('intro');
  });

  it('does not autoplay until the intro has expanded', async () => {
    const el = block([pic('/intro.jpg'), pic('/intro-m.jpg')], [imageItem(0), imageItem(1)]);
    decorate(el);
    await jest.advanceTimersByTimeAsync(4000);
    expect(active(el)).toBe(0);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(el.dataset.state).toBe('expanded');
    expect(active(el)).toBe(1);
  });

  it('skips the intro in Universal Editor', () => {
    document.documentElement.classList.add('adobe-ue-edit');
    const el = block([pic('/intro.jpg'), pic('/intro-m.jpg')], [imageItem(0)]);
    decorate(el);
    expect(el.querySelector('.hero-destination-intro')).toBeNull();
    expect(el.dataset.state).toBeUndefined();
    expect(el.querySelector('.hero-destination-heading')?.classList.contains('is-revealed')).toBe(true);
  });

  it('holds a video slide until the video ends, then times image slides', async () => {
    const el = block([], [videoItem(0), imageItem(1), imageItem(2)]);
    decorate(el);
    const [video] = [...el.querySelectorAll('video')];
    expect(video.loop).toBe(false);
    await jest.advanceTimersByTimeAsync(5000);
    expect(active(el)).toBe(0);
    video.dispatchEvent(new Event('ended'));
    await jest.advanceTimersByTimeAsync(0);
    expect(active(el)).toBe(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(active(el)).toBe(2);
  });

  it('advances on resume when the held video already ended', async () => {
    const el = block([], [videoItem(0), imageItem(1)]);
    decorate(el);
    const video = el.querySelector('video')!;
    const nav = el.querySelector('.hero-destination-dots')!;
    const enter = new Event('pointerenter');
    Object.defineProperty(enter, 'pointerType', { value: 'mouse' });
    nav.dispatchEvent(enter);
    Object.defineProperty(video, 'ended', { configurable: true, value: true });
    video.dispatchEvent(new Event('ended'));
    await jest.advanceTimersByTimeAsync(0);
    expect(active(el)).toBe(0);
    const leave = new Event('pointerleave');
    Object.defineProperty(leave, 'pointerType', { value: 'mouse' });
    nav.dispatchEvent(leave);
    await jest.advanceTimersByTimeAsync(0);
    expect(active(el)).toBe(1);
  });

  it('restarts a revisited video from the beginning', async () => {
    const el = block([], [videoItem(0), imageItem(1)]);
    decorate(el);
    const video = el.querySelector('video')!;
    let time = 4;
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      get: () => time,
      set: (value: number) => {
        time = value;
      },
    });
    video.dispatchEvent(new Event('ended'));
    await jest.advanceTimersByTimeAsync(0);
    expect(active(el)).toBe(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(active(el)).toBe(0);
    expect(time).toBe(0);
  });

  it('loops the video of a single-item block', () => {
    const el = block([], [videoItem(0)]);
    decorate(el);
    expect(el.querySelector('video')?.loop).toBe(true);
  });
});
