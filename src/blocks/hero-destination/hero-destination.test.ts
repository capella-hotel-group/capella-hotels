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

  it('pauses on mouse hover and resumes on leave', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);

    block.dispatchEvent(pointer('pointerenter', 'mouse'));
    jest.advanceTimersByTime(20_000);
    expect(activeIndex(block)).toBe(0);

    block.dispatchEvent(pointer('pointerleave', 'mouse'));
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(1);
  });

  it('ignores touch pointers so a tap cannot freeze autoplay', () => {
    const block = buildBlock(['true', '5'], 3);
    decorate(block);

    block.dispatchEvent(pointer('pointerenter', 'touch'));
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

    toggle.click();
    expect(toggle.getAttribute('aria-label')).toBe('Play slideshow');
    expect(toggle.dataset.state).toBe('paused');
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();

    block.dispatchEvent(pointer('pointerenter', 'mouse'));
    block.dispatchEvent(pointer('pointerleave', 'mouse'));
    jest.advanceTimersByTime(20_000);
    expect(activeIndex(block)).toBe(0);

    toggle.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    toggle.click();
    expect(toggle.getAttribute('aria-label')).toBe('Pause slideshow');
    jest.advanceTimersByTime(5000);
    expect(activeIndex(block)).toBe(1);
  });
});
