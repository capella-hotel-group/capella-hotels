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
      '<div class="experience-tiles-item"><div class="experience-tiles-overlay"><a href="#cta">CTA</a></div></div>'.repeat(
        2,
      );
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
/** Slides that passed through `--settling` (transitions off) between now and the returned call. */
function settledSlides(track: HTMLElement): () => Element[] {
  const observer = new MutationObserver(() => {});
  observer.observe(track, { attributes: true, attributeOldValue: true, subtree: true, attributeFilter: ['class'] });
  return () => {
    const records = observer.takeRecords();
    observer.disconnect();
    return records
      .filter((record) => (record.oldValue ?? '').includes('experience-tiles-slide--settling'))
      .map((record) => record.target as Element);
  };
}
function land(slide: HTMLElement): void {
  slide.querySelectorAll('.experience-tiles-item').forEach((el) => end(el));
}
it('waits only for the panels, then plays the one step queued meanwhile', () => {
  setup(true);
  controller.requestStep(1);
  expect(controller.requestStep(1)).toBe('queued');
  expect(controller.requestStep(1)).toBe('queued');
  land(slides[0]);
  land(slides[1]);
  expect(controller.index).toBe(2);
  expect(controller.isAnimating).toBe(true);
  land(slides[1]);
  land(slides[2]);
  expect(controller.isBusy).toBe(false);
  expect(controller.index).toBe(2);
});
it('lets the incoming copy keep animating after the panels land', () => {
  setup(true);
  controller.requestStep(1);
  const track = slides[0].parentElement!;
  const watch = settledSlides(track);
  land(slides[0]);
  land(slides[1]);
  expect(controller.isBusy).toBe(false);
  expect(watch()).not.toContain(slides[1]);
});
it('marks the travel direction on the track and re-parks the resting slides without animating', () => {
  setup(true);
  const track = slides[0].parentElement!;
  controller.requestStep(1);
  expect(track.dataset.direction).toBe('forward');
  jest.runAllTimers();
  const watch = settledSlides(track);
  controller.requestStep(-1);
  const settled = watch();
  expect(track.dataset.direction).toBe('backward');
  expect(settled).toEqual(expect.arrayContaining([slides[0], slides[2]]));
  expect(settled).not.toContain(slides[1]);
});
it('checks busy before the last-slide edge and uses the computed fallback', () => {
  setup(true, false, 2);
  controller.requestStep(1);
  expect(controller.requestStep(1)).toBe('queued');
  jest.advanceTimersByTime(1249);
  expect(controller.isBusy).toBe(true);
  jest.advanceTimersByTime(1);
  expect(controller.isBusy).toBe(false);
  expect(controller.requestStep(1)).toBe('edge');
});
it('selection interrupts a transition without stale callbacks or queued navigation', () => {
  setup(true);
  controller.requestStep(1);
  expect(controller.requestStep(-1)).toBe('queued');
  controller.select(2);
  expect(controller.index).toBe(2);
  expect(controller.isBusy).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
  land(slides[1]);
  controller.select(99);
  jest.runAllTimers();
  expect(controller.index).toBe(2);
});
it('settles cancelled transitions and resize without playing discarded requests', () => {
  setup(true);
  controller.requestStep(1);
  controller.requestStep(1);
  end(slides[1].firstElementChild!, 'transitioncancel');
  expect(controller.isBusy).toBe(false);
  expect(controller.index).toBe(1);
  controller.requestStep(1);
  controller.requestStep(-1);
  controller.beginResize();
  expect(controller.requestStep(-1)).toBe('busy');
  controller.endResize();
  jest.runAllTimers();
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
it('reports every active change and asks where focus should go', () => {
  window.matchMedia = jest
    .fn()
    .mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  const host = document.createElement('div');
  const target = document.createElement('button');
  const items = [0, 1].map(() => {
    const slide = document.createElement('div');
    slide.innerHTML = '<a href="#x">x</a>';
    host.append(slide);
    return slide;
  });
  host.append(target);
  document.body.append(host);
  const onChange = jest.fn();
  controller = new CarouselController(items, { onChange, focusTarget: () => target });
  controller.init();
  expect(onChange).toHaveBeenLastCalledWith(0);
  items[0]!.querySelector('a')!.focus();
  controller.requestStep(1);
  expect(onChange).toHaveBeenLastCalledWith(1);
  expect(document.activeElement).toBe(target);
});
