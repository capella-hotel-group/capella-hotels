import { CarouselController } from './carousel-controller';
import { registerScrollController } from './scroll-controller';

let cleanups: (() => void)[];
let y = 0;
function setup(top = 0, count = 3) {
  const block = document.createElement('div');
  block.className = 'split-media';
  block.innerHTML =
    '<ul class="split-media-track">' +
    '<li><div class="split-media-overlay"><p>Copy</p></div></li>'.repeat(count) +
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
  expect(y).toBe(100);
  wheel(80);
  expect(controller.index).toBe(0);
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
  expect(y).toBe(0);
  expect(controller.index).toBe(2);
  fresh();
  wheel(-40);
  expect(controller.index).toBe(1);
});
it('enters once per burst when alignment never settles', () => {
  const scrollTo = jest.fn();
  window.scrollTo = scrollTo;
  const { controller } = setup(100);
  expect(wheel(120).defaultPrevented).toBe(true);
  expect(wheel(120).defaultPrevented).toBe(true);
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(controller.index).toBe(0);
  fresh();
  wheel(120);
  expect(scrollTo).toHaveBeenCalledTimes(2);
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
  const copy = block.querySelector<HTMLElement>('.split-media-overlay')!;
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
