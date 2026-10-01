import decorate from './split-media';

jest.mock(
  '@/app/scripts',
  () => ({
    moveInstrumentation: (source: HTMLElement, target: HTMLElement) => {
      [...source.attributes]
        .filter(({ name }) => name.startsWith('data-aue-'))
        .forEach(({ name, value }) => {
          target.setAttribute(name, value);
          source.removeAttribute(name);
        });
    },
  }),
  { virtual: true },
);

function block(config: string[] = [], count = 3): HTMLElement {
  const element = document.createElement('div');
  element.className = 'split-media';
  element.innerHTML =
    config.map((value) => `<div><div>${value}</div></div>`).join('') +
    Array.from(
      { length: count },
      (_, i) =>
        `<div data-aue-model="split-media-slide"><div><img src="left.jpg"></div><div><p>Slide ${i}</p></div><div><img src="right.jpg"></div><div><p>Detail ${i}</p></div><div><a href="#cta">CTA</a></div></div>`,
    ).join('');
  document.body.append(element);
  return element;
}
function active(element: HTMLElement): number {
  return [...element.querySelectorAll('.split-media-slide')].findIndex(
    (slide) => slide.getAttribute('aria-hidden') === 'false',
  );
}
function click(element: HTMLElement, selector: string): void {
  element.querySelector<HTMLElement>(selector)!.click();
}

describe('split-media integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  });
  afterEach(async () => {
    document.body.replaceChildren();
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
  it('autoplays slide-only CMS content and preserves explicit false', () => {
    const cms = block();
    const disabled = block(['id', 'qa', 'false']);
    decorate(cms);
    decorate(disabled);
    jest.advanceTimersByTime(6000);
    expect(active(cms)).toBe(1);
    expect(active(disabled)).toBe(0);
    expect(disabled.id).toBe('id');
    expect(disabled.dataset.testId).toBe('qa');
    expect(disabled.querySelector('.split-media-autoplay')).toBeNull();
  });
  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])('supports independent toggles dots=%s controls=%s', (dots, controls) => {
    const element = block(['', '', 'false', '6', String(dots), String(controls)]);
    decorate(element);
    expect(element.querySelectorAll('.split-media-dot')).toHaveLength(dots ? 3 : 0);
    expect(element.querySelectorAll('.split-media-nav')).toHaveLength(controls ? 2 : 0);
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(active(element)).toBe(1);
    if (dots) {
      click(element, '.split-media-dot:last-child');
      expect(active(element)).toBe(2);
      expect(element.querySelector('.split-media-dot:last-child')!.getAttribute('aria-current')).toBe('true');
    }
    if (controls) {
      click(element, '.split-media-nav-next');
      expect(active(element)).toBe(dots ? 0 : 2);
    }
    expect(element.querySelectorAll('.split-media-slide[inert]')).toHaveLength(2);
  });
  it('keeps Pause independent of hidden controls and does not resume on manual navigation or visibility', () => {
    const element = block(['', '', 'true', '6', 'false', 'false']);
    decorate(element);
    click(element, '.split-media-autoplay');
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(20000);
    expect(active(element)).toBe(1);
    expect(element.querySelector('.split-media-autoplay')!.textContent).toBe('Play');
    click(element, '.split-media-autoplay');
    jest.advanceTimersByTime(6000);
    expect(active(element)).toBe(2);
  });
  it('retains instrumented configuration and cleans up when UE replaces the track', async () => {
    const element = block(['false']);
    const field = element.firstElementChild!.firstElementChild!;
    field.setAttribute('data-aue-prop', 'autoplay');
    decorate(element);
    expect(element.contains(field)).toBe(true);
    expect(field.closest('.split-media-hidden')).not.toBeNull();
    element.querySelector('.split-media-track')!.remove();
    await Promise.resolve();
    window.dispatchEvent(new Event('resize'));
    expect(jest.getTimerCount()).toBe(0);
  });
  it('isolates instances and stops removed blocks without stopping their neighbours', async () => {
    const first = block();
    const second = block();
    decorate(first);
    decorate(second);
    first.remove();
    await Promise.resolve();
    jest.advanceTimersByTime(6000);
    expect(active(first)).toBe(0);
    expect(active(second)).toBe(1);
  });
  it('renders a single slide without autoplay, controls or gesture listeners', () => {
    const element = block([], 1);
    decorate(element);
    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('.split-media-track--swipe')).toBeNull();
    expect(element.hasAttribute('tabindex')).toBe(false);
  });
});
