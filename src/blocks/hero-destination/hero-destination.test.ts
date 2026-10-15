jest.mock('@/app/scripts.js', () => ({ moveInstrumentation: () => {} }));
jest.mock('@/utils/env.js', () => ({ resolveDAMUrl: (url: string) => url }));

type Decorate = (block: HTMLElement) => void;

/** Config rows (single cell) then item rows: mediaType, video link, heading. */
function buildBlock(config: string[], count: number): HTMLElement {
  const block = document.createElement('div');
  block.className = 'hero-destination';
  block.innerHTML =
    config.map((value) => `<div><div>${value}</div></div>`).join('') +
    Array.from(
      { length: count },
      (_, index) =>
        `<div><div>video</div><div><a href="/clip-${index}.mp4">clip</a></div><div>Slide ${index}</div></div>`,
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

  it('omits the toggle when there is no auto-moving content', () => {
    const block = buildBlock(['false', '5'], 3);
    decorate(block);

    expect(block.querySelector('.hero-destination-toggle')).toBeNull();
  });

  it('pauses on mouse hover over pagination dots and resumes on leave', () => {
    const block = buildBlock(['true', '5'], 3);
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
    const block = buildBlock(['true', '5'], 3);
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
    const block = buildBlock(['true', '5'], 3);
    decorate(block);

    block.dispatchEvent(pointer('pointerenter', 'mouse'));
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(1);
  });

  it('ignores touch pointers so a tap cannot freeze autoplay', () => {
    const block = buildBlock(['true', '5'], 3);
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

  it('toggles slide rotation and video playback, and survives a hover resume', () => {
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
    jest.advanceTimersByTime(5000);
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
