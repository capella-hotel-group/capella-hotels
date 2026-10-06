import { CarouselController } from './carousel-controller';

let controller: CarouselController;
let slides: HTMLElement[];
function setup(animated = false, reduced = false, count = 3): void {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: reduced, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const block = document.createElement('div');
  block.className = 'experience-tiles';
  block.tabIndex = 0;
  slides = Array.from({ length: count }, () => {
    const slide = document.createElement('li');
    slide.innerHTML =
      '<div class="experience-tiles-item"><div class="experience-tiles-overlay"><a href="#cta">CTA</a></div></div>'.repeat(2);
    if (animated)
      slide.querySelectorAll<HTMLElement>('.experience-tiles-item, .experience-tiles-overlay').forEach((el) => {
        el.style.transitionProperty = 'transform';
        el.style.transitionDuration = el.classList.contains('experience-tiles-overlay') ? '1.5s' : '1.2s';
        el.style.transitionDelay = '0s';
      });
    block.append(slide);
    return slide;
  });
  document.body.append(block);
  controller = new CarouselController(slides);
  controller.init();
}
function end(el: Element, type = 'transitionend'): void {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: 'transform' });
  el.dispatchEvent(event);
}
it('leaves the slide already showing untouched so a running entrance is not cut short', () => {
  setup();
  const track = slides[0]!.parentElement!;
  const observer = new MutationObserver(() => {});
  observer.observe(track, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-hidden', 'inert'] });

  controller.select(0);
  expect(observer.takeRecords()).toHaveLength(0);

  controller.select(1);
  expect(observer.takeRecords().length).toBeGreaterThan(0);
  expect(controller.index).toBe(1);
  observer.disconnect();
});
afterEach(() => {
  controller?.destroy();
  document.body.replaceChildren();
  document.body.className = '';
  jest.useRealTimers();
});
beforeEach(() => jest.useFakeTimers());

it('stops at either edge without looping and never advances by time alone', () => {
  setup();
  expect(controller.count).toBe(3);
  expect(controller.requestStep(-1)).toBe('edge');
  expect(controller.requestStep(1)).toBe('changed');
  expect(controller.index).toBe(1);
  expect(slides[0].hasAttribute('inert')).toBe(true);
  expect(controller.requestStep(1)).toBe('changed');
  expect(controller.requestStep(1)).toBe('edge');
  jest.advanceTimersByTime(60000);
  expect(controller.index).toBe(2);
});
it('waits for panels AND incoming text and discards input while busy', () => {
  setup(true);
  controller.requestStep(1);
  expect(controller.requestStep(1)).toBe('busy');
  slides[0].querySelectorAll('.experience-tiles-item').forEach((el) => end(el));
  slides[1].querySelectorAll('.experience-tiles-item').forEach((el) => end(el));
  expect(controller.isBusy).toBe(true);
  slides[1].querySelectorAll('.experience-tiles-overlay').forEach((el) => end(el));
  expect(controller.isBusy).toBe(false);
  expect(controller.index).toBe(1);
});
it('checks busy before the last-slide edge and uses the computed fallback', () => {
  setup(true, false, 2);
  controller.requestStep(1);
  expect(controller.requestStep(1)).toBe('busy');
  jest.advanceTimersByTime(1549);
  expect(controller.isBusy).toBe(true);
  jest.advanceTimersByTime(1);
  expect(controller.requestStep(1)).toBe('edge');
});
it('selection interrupts a transition without stale callbacks or queued navigation', () => {
  setup(true);
  controller.requestStep(1);
  controller.select(2);
  expect(controller.index).toBe(2);
  expect(controller.isBusy).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  slides[1].querySelectorAll('.experience-tiles-item').forEach((el) => end(el));
  controller.select(99);
  expect(controller.index).toBe(2);
});
it('settles cancelled transitions and resize without playing discarded requests', () => {
  setup(true);
  controller.requestStep(1);
  end(slides[1].firstElementChild!, 'transitioncancel');
  expect(controller.isBusy).toBe(false);
  controller.requestStep(1);
  controller.beginResize();
  expect(controller.requestStep(-1)).toBe('busy');
  controller.endResize();
  expect(controller.index).toBe(2);
  expect(controller.isBusy).toBe(false);
});
it('moves focus out of the outgoing slide before making it inert', () => {
  setup();
  slides[0].querySelector('a')!.focus();
  controller.requestStep(1);
  expect(document.activeElement).toBe(slides[0].parentElement);
});
it('disables animation for reduced motion and cleans up on destroy', () => {
  setup(true, true);
  controller.requestStep(1);
  expect(controller.isBusy).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  controller.destroy();
  expect(controller.requestStep(1)).toBe('busy');
  expect(controller.index).toBe(1);
});
it('leaves every slide accessible in the editor', () => {
  document.body.classList.add('adobe-ue-edit');
  setup();
  controller.select(2);
  slides.forEach((slide) => {
    expect(slide.hasAttribute('inert')).toBe(false);
    expect(slide.hasAttribute('aria-hidden')).toBe(false);
  });
});
