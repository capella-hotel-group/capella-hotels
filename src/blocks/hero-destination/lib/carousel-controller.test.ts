import { CarouselController } from './carousel-controller';
import type { EffectController } from './effects/types';

const effect: EffectController = { init: jest.fn(), render: jest.fn() };

function build(count: number): { track: HTMLElement; slides: HTMLElement[]; dots: HTMLButtonElement[] } {
  const track = document.createElement('ul');
  const slides = Array.from({ length: count }, () => {
    const slide = document.createElement('li');
    slide.append(document.createElement('div'));
    track.append(slide);
    return slide;
  });
  const dots = Array.from({ length: count }, () => document.createElement('button'));
  return { track, slides, dots };
}

function controller({ count = 3, autoplay = true, loop = true } = {}): CarouselController {
  const { track, slides, dots } = build(count);
  return new CarouselController({
    track,
    slides,
    mediaEls: slides.map((slide) => slide.firstElementChild as HTMLElement),
    dots,
    intervalSeconds: 5,
    autoplay,
    loop,
    effect,
  });
}

/** Reads the active index from the last effect render the controller performed. */
function active(): number {
  const calls = (effect.render as jest.Mock).mock.calls;
  return calls[calls.length - 1][2] as number;
}

describe('CarouselController autoplay pausing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('advances on every interval', () => {
    const carousel = controller();
    carousel.init();

    jest.advanceTimersByTime(10_000);

    expect(active()).toBe(2);
  });

  it('stops advancing while paused and resumes afterwards', () => {
    const carousel = controller();
    carousel.init();

    carousel.pause('hover');
    jest.advanceTimersByTime(20_000);
    expect(active()).toBe(0);

    carousel.resume('hover');
    jest.advanceTimersByTime(5000);
    expect(active()).toBe(1);
  });

  it('stays paused until every reason is released', () => {
    const carousel = controller();
    carousel.init();

    carousel.pause('hover');
    carousel.pause('focus');
    carousel.resume('hover');
    jest.advanceTimersByTime(20_000);

    expect(active()).toBe(0);
  });

  it('keeps an explicit user pause across a hover resume', () => {
    const carousel = controller();
    carousel.init();

    carousel.pause('user');
    carousel.pause('hover');
    carousel.resume('hover');
    jest.advanceTimersByTime(20_000);

    expect(carousel.userPaused).toBe(true);
    expect(active()).toBe(0);
  });

  it('does not restart once a non-looping carousel has reached the last slide', () => {
    const carousel = controller({ count: 2, loop: false });
    carousel.init();

    jest.advanceTimersByTime(10_000);
    expect(active()).toBe(1);

    carousel.pause('hover');
    carousel.resume('hover');
    jest.advanceTimersByTime(20_000);

    expect(active()).toBe(1);
  });

  it('restarts the countdown on manual navigation but not while paused', () => {
    const carousel = controller();
    carousel.init();

    carousel.pause('hover');
    carousel.goTo(2);
    jest.advanceTimersByTime(20_000);

    expect(active()).toBe(2);
  });

  it('reports autoplay as disabled for a single slide or reduced motion', () => {
    expect(controller({ count: 1 }).autoplayEnabled).toBe(false);
    expect(controller({ autoplay: false }).autoplayEnabled).toBe(false);

    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    expect(controller().autoplayEnabled).toBe(false);
  });
});
