import { CarouselController } from './carousel-controller';
import { registerScrollController, SNAP_DISTANCE } from './scroll-controller';

let cleanups: (() => void)[];
let y = 0;
function setup(top = 0, count = 3) {
  const block = document.createElement('div');
  block.className = 'experience-tiles';
  block.innerHTML =
    '<ul class="experience-tiles-track">' +
    '<li><div class="experience-tiles-overlay"><p>Copy</p></div></li>'.repeat(count) +
    '</ul>';
  document.body.append(block);
  block.getBoundingClientRect = () => ({
    top: top - y,
    bottom: top - y + 800,
    height: 800,
    width: 1000,
    left: 0,
    right: 1000,
    x: 0,
    y: top - y,
    toJSON() {},
  });
  const controller = new CarouselController([...block.querySelectorAll('li')]);
  controller.init();
  const binding = registerScrollController(block, controller);
  cleanups.push(() => {
    binding.cleanup();
    controller.destroy();
  });
  return { block, controller, binding };
}
function wheel(deltaY: number, target: Element = document.body, options: WheelEventInit = {}) {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  if (!event.defaultPrevented) y += deltaY;
  return event;
}
function fresh() {
  jest.advanceTimersByTime(201);
}
function touch(target: Element, type: string, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = type === 'touchend' ? [] : [{ identifier: 0, clientX: 100, clientY }];
  Object.defineProperties(event, {
    touches: { value: list },
    changedTouches: { value: [{ identifier: 0, clientX: 100, clientY }] },
  });
  target.dispatchEvent(event);
  return event;
}
/** One finger travelling `distance` px upwards (positive) or downwards, in `steps` even moves. */
function swipe(target: Element, distance: number, steps = 4, gap = 16) {
  let position = 400;
  touch(target, 'touchstart', position);
  for (let index = 0; index < steps; index += 1) {
    jest.advanceTimersByTime(gap);
    position -= distance / steps;
    touch(target, 'touchmove', position);
  }
  touch(target, 'touchend', position);
}
function settled() {
  jest.advanceTimersByTime(600);
}
beforeEach(() => {
  jest.useFakeTimers();
  cleanups = [];
  y = 0;
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
  window.scrollTo = jest.fn((options) => {
    y = (options as ScrollToOptions).top ?? y;
  });
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
});
afterEach(() => {
  cleanups.reverse().forEach((clean) => clean());
  document.body.replaceChildren();
  document.body.className = '';
  jest.useRealTimers();
});

it('clamps entry without skipping the first slide, then requires a new gesture', () => {
  const { controller } = setup(100);
  expect(wheel(150).defaultPrevented).toBe(true);
  wheel(80);
  expect(controller.index).toBe(0);
  settled();
  expect(y).toBe(100);
  fresh();
  wheel(40);
  expect(controller.index).toBe(1);
});
it('accumulates small deltas and consumes inertia including direction changes', () => {
  const { controller } = setup();
  wheel(20);
  expect(controller.index).toBe(0);
  wheel(20);
  expect(controller.index).toBe(1);
  for (const delta of [80, 40, 20, -80]) {
    jest.advanceTimersByTime(100);
    wheel(delta);
  }
  expect(controller.index).toBe(1);
  fresh();
  wheel(-40);
  expect(controller.index).toBe(0);
});
it('resets accumulation on direction reversal before the threshold', () => {
  const { controller } = setup();
  controller.select(1);
  wheel(30);
  wheel(-20);
  expect(controller.index).toBe(1);
  wheel(-20);
  expect(controller.index).toBe(0);
});
it('releases only on a fresh outward gesture at the last slide', () => {
  const { controller } = setup(0, 2);
  wheel(40);
  expect(controller.index).toBe(1);
  expect(wheel(80).defaultPrevented).toBe(true);
  fresh();
  expect(wheel(40).defaultPrevented).toBe(false);
  expect(y).toBe(40);
  expect(wheel(20).defaultPrevented).toBe(false);
});
it('enters from below at the last slide and navigates back on the next gesture', () => {
  y = 100;
  const { controller } = setup();
  wheel(-120);
  settled();
  expect(y).toBe(0);
  expect(controller.index).toBe(2);
  fresh();
  wheel(-40);
  expect(controller.index).toBe(1);
});
it('keeps your place when you come back up to a block you had already started', () => {
  const { controller } = setup(500);
  y = 500;
  wheel(40);
  expect(controller.index).toBe(1);
  // the page drifts past the block, then the reader turns around and scrolls back up to it
  y = 620;
  fresh();
  wheel(-40);
  settled();
  expect(y).toBe(500);
  expect(controller.index).toBe(1);
});
it('restarts the story whenever the block is entered travelling downwards', () => {
  const { controller } = setup(500);
  y = 500;
  wheel(40);
  expect(controller.index).toBe(1);
  y = 350;
  fresh();
  wheel(40);
  settled();
  expect(y).toBe(500);
  expect(controller.index).toBe(0);
});
it('settles onto the alignment point with an animation instead of jumping', () => {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const { controller } = setup(100);
  expect(wheel(120).defaultPrevented).toBe(true);
  expect(y).toBe(0);
  jest.advanceTimersByTime(150);
  expect(y).toBeGreaterThan(0);
  expect(y).toBeLessThan(100);
  settled();
  expect(y).toBe(100);
  expect(controller.index).toBe(0);
});
it('captures the block on approach even with small trackpad deltas', () => {
  const { controller } = setup(150);
  expect(wheel(8).defaultPrevented).toBe(true);
  settled();
  expect(y).toBe(150);
  expect(controller.index).toBe(0);
});
it('snaps as soon as the block reaches the snap band', () => {
  const top = Math.round(window.innerHeight * SNAP_DISTANCE) - 10;
  const { controller } = setup(top);
  expect(wheel(8).defaultPrevented).toBe(true);
  settled();
  expect(y).toBe(top);
  expect(controller.index).toBe(0);
});
it('leaves the page alone while the block is still outside the snap band', () => {
  const { controller } = setup(Math.round(window.innerHeight * SNAP_DISTANCE) + 10);
  expect(wheel(8).defaultPrevented).toBe(false);
  expect(controller.index).toBe(0);
  expect(y).toBe(8);
});
it('finishes the alignment even when animation frames never arrive', () => {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const frame = window.requestAnimationFrame;
  const cancel = window.cancelAnimationFrame;
  // a background tab freezes frames: the fallback timer has to land the block anyway
  window.requestAnimationFrame = jest.fn(() => 1) as unknown as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = jest.fn();
  try {
    const { controller } = setup(100);
    expect(wheel(120).defaultPrevented).toBe(true);
    expect(y).toBe(0);
    jest.advanceTimersByTime(5000);
    expect(y).toBe(100);
    expect(controller.index).toBe(0);
  } finally {
    window.requestAnimationFrame = frame;
    window.cancelAnimationFrame = cancel;
  }
});
it('ignores a block it has already scrolled past', () => {
  y = 400;
  const { controller } = setup();
  expect(wheel(8).defaultPrevented).toBe(false);
  expect(y).toBe(408);
  expect(controller.index).toBe(0);
});
it('stays out of the way until the block is within the approach band', () => {
  const { controller } = setup(400);
  expect(wheel(8).defaultPrevented).toBe(false);
  expect(y).toBe(8);
  expect(controller.index).toBe(0);
});
it('enters once per burst when alignment never settles', () => {
  window.scrollTo = jest.fn();
  const { controller } = setup(100);
  const select = jest.spyOn(controller, 'select');
  expect(wheel(120).defaultPrevented).toBe(true);
  expect(wheel(120).defaultPrevented).toBe(true);
  expect(select).toHaveBeenCalledTimes(1);
  expect(controller.index).toBe(0);
  settled();
  wheel(120);
  expect(select).toHaveBeenCalledTimes(2);
});
it('re-settles instead of releasing when the browser keeps scrolling mid-burst', () => {
  const { controller } = setup(60);
  expect(wheel(120).defaultPrevented).toBe(true);
  // Chrome keeps animating its fling after preventDefault, dragging the block off the alignment point.
  y += 200;
  expect(wheel(120).defaultPrevented).toBe(true);
  settled();
  expect(y).toBe(60);
  expect(controller.index).toBe(0);
  fresh();
  wheel(60);
  expect(controller.index).toBe(1);
});
it('consumes wheel input until an animated transition and the burst both finish', () => {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const computed = window.getComputedStyle;
  window.getComputedStyle = jest.fn().mockReturnValue({
    transitionProperty: 'transform',
    transitionDuration: '1200ms',
    transitionDelay: '0ms',
  }) as unknown as typeof window.getComputedStyle;
  const { controller } = setup();

  wheel(60);
  expect(controller.index).toBe(1);
  expect(controller.isBusy).toBe(true);
  fresh();
  expect(wheel(60).defaultPrevented).toBe(true);
  expect(controller.index).toBe(1);

  jest.advanceTimersByTime(1250);
  expect(controller.isBusy).toBe(false);
  fresh();
  wheel(60);
  expect(controller.index).toBe(2);
  window.getComputedStyle = computed;
});
it('keeps a copy gesture in the copy after reaching the bottom', () => {
  const { block, controller } = setup();
  const copy = block.querySelector<HTMLElement>('.experience-tiles-overlay')!;
  Object.defineProperties(copy, { scrollHeight: { value: 600 }, clientHeight: { value: 200 } });
  copy.scrollTop = 380;
  wheel(80, copy);
  expect(copy.scrollTop).toBe(400);
  wheel(80, copy);
  expect(controller.index).toBe(0);
  expect(y).toBe(0);
  fresh();
  wheel(40, copy);
  expect(controller.index).toBe(1);
});
it('carries the page itself when a touch swipe has nowhere left to go in the block', () => {
  const { block, controller } = setup(0, 2);
  controller.select(1);
  // the track suppresses native panning, so the last slide must hand the page scroll to JS, not drop it
  swipe(block, 120);
  expect(y).toBe(120);
  expect(controller.index).toBe(1);
});
it('snaps the next block into place from the release momentum', () => {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const { block, controller } = setup(0, 2);
  const next = setup(900);
  controller.select(1);
  swipe(block, 700);
  expect(y).toBe(700);
  settled();
  expect(y).toBe(900);
  expect(next.controller.index).toBe(0);
});
it('releases a modal immediately instead of scrolling the page under it', () => {
  const { block } = setup(0, 2);
  const dialog = document.createElement('dialog');
  dialog.open = true;
  document.body.append(dialog);
  swipe(block, 120);
  expect(y).toBe(0);
  dialog.remove();
});
it('does not capture horizontal input, zoom, prevented events, single slides or editor', () => {
  const { block, controller } = setup();
  expect(wheel(10, block, { deltaX: 100 }).defaultPrevented).toBe(false);
  expect(wheel(40, block, { ctrlKey: true }).defaultPrevented).toBe(false);
  expect(controller.index).toBe(0);
  cleanups.reverse().forEach((clean) => clean());
  cleanups = [];
  document.body.replaceChildren();
  y = 0;
  setup(0, 1);
  expect(wheel(40).defaultPrevented).toBe(false);
  document.body.className = 'adobe-ue-edit';
  y = 0;
  setup();
  expect(wheel(40).defaultPrevented).toBe(false);
});
it('drops ownership after external scrolling and lets another instance acquire it', () => {
  const first = setup();
  const second = setup(1000);
  wheel(40);
  y = 950;
  window.dispatchEvent(new Event('scroll'));
  fresh();
  wheel(80);
  expect(y).toBe(1000);
  expect(second.controller.index).toBe(0);
  fresh();
  wheel(40);
  expect(second.controller.index).toBe(1);
  expect(first.controller.index).toBe(1);
});
it('does not release while animation is busy or retain a request for later', () => {
  const { controller } = setup(0, 2);
  controller.beginResize();
  wheel(80);
  fresh();
  wheel(80);
  expect(controller.index).toBe(0);
  controller.endResize();
  wheel(80);
  expect(controller.index).toBe(0);
  fresh();
  wheel(40);
  expect(controller.index).toBe(1);
});
it('releases when a modal opens and cleans all listeners when unregistered', () => {
  const { controller } = setup();
  wheel(40);
  const dialog = document.createElement('dialog');
  dialog.open = true;
  document.body.append(dialog);
  fresh();
  expect(wheel(40).defaultPrevented).toBe(false);
  expect(controller.index).toBe(1);
  cleanups.forEach((clean) => clean());
  cleanups = [];
  dialog.remove();
  y = 0;
  fresh();
  expect(wheel(40).defaultPrevented).toBe(false);
});
