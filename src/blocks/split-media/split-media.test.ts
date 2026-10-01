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
  it('ignores legacy settings and renders no navigation or automatic changes', () => {
    const element = block(['id', 'qa', 'true', '6', 'true', 'true']);
    decorate(element);
    jest.advanceTimersByTime(60000);
    expect(active(element)).toBe(0);
    expect(element.id).toBe('id');
    expect(element.dataset.testId).toBe('qa');
    expect(element.dataset.testid).toBe('split-media');
    expect(element.querySelector('button')).toBeNull();
    expect(element.hasAttribute('aria-keyshortcuts')).toBe(false);
  });
  it('uses vertical keys only at the root, leaves boundary/default interaction intact', () => {
    const element = block();
    decorate(element);
    const key = (name: string, target: Element = element) => {
      const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };
    expect(key('ArrowUp').defaultPrevented).toBe(false);
    expect(key('ArrowDown').defaultPrevented).toBe(true);
    expect(active(element)).toBe(1);
    key('ArrowDown', element.querySelector('a')!);
    expect(active(element)).toBe(1);
    key('ArrowDown');
    expect(active(element)).toBe(2);
    expect(key('ArrowDown').defaultPrevented).toBe(false);
    expect(key(' ').defaultPrevented).toBe(false);
    expect(key('Tab').defaultPrevented).toBe(false);
  });
  it('retains instrumented config and cleans up when UE replaces the track', async () => {
    const element = block(['false']);
    const field = element.firstElementChild!.firstElementChild!;
    field.setAttribute('data-aue-prop', 'autoplay');
    decorate(element);
    expect(element.contains(field)).toBe(true);
    element.querySelector('.split-media-track')!.remove();
    await Promise.resolve();
    window.dispatchEvent(new Event('resize'));
    expect(jest.getTimerCount()).toBe(0);
  });
  it('keeps single slides free of carousel interaction', () => {
    const element = block([], 1);
    decorate(element);
    expect(element.querySelector('button')).toBeNull();
    expect(element.hasAttribute('tabindex')).toBe(false);
    expect(element.querySelector('.split-media-track')!.classList.contains('split-media-track--scroll')).toBe(false);
  });
  it('claims the vertical touch axis only where it owns page scrolling', () => {
    const owned = block();
    decorate(owned);
    expect(owned.querySelector('.split-media-track')!.classList.contains('split-media-track--scroll')).toBe(true);

    document.body.classList.add('adobe-ue-edit');
    const edited = block();
    decorate(edited);
    expect(edited.querySelector('.split-media-track')!.classList.contains('split-media-track--scroll')).toBe(false);
    document.body.classList.remove('adobe-ue-edit');
  });
  it('lets the keyboard reach copy that overflows its panel', () => {
    const element = block();
    decorate(element);
    const [overflowing, fitting] = [...element.querySelectorAll<HTMLElement>('.split-media-overlay')];
    Object.defineProperties(overflowing!, { scrollHeight: { value: 600 }, clientHeight: { value: 200 } });
    Object.defineProperties(fitting!, { scrollHeight: { value: 200 }, clientHeight: { value: 200 } });

    window.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(150);

    expect(overflowing!.tabIndex).toBe(0);
    expect(overflowing!.getAttribute('role')).toBe('group');
    expect(overflowing!.classList.contains('split-media-overlay--scrollable')).toBe(true);
    expect(fitting!.hasAttribute('tabindex')).toBe(false);
    // a non-overflowing overlay must not become a scroll container, or it blocks page scroll chaining
    expect(fitting!.classList.contains('split-media-overlay--scrollable')).toBe(false);
  });
  it('makes empty authored slides selectable and every UE slide accessible', () => {
    document.body.classList.add('adobe-ue-edit');
    const element = block();
    element.lastElementChild!.replaceChildren();
    decorate(element);
    expect(element.querySelectorAll('.split-media-slide')).toHaveLength(3);
    expect(element.querySelector('[inert]')).toBeNull();
    expect(element.querySelector('.split-media-placeholder')).not.toBeNull();
    document.body.classList.remove('adobe-ue-edit');
  });
  it('renders a published richtext description emitted as a second paragraph', () => {
    const element = block([], 1);
    const content = element.querySelector<HTMLElement>('[data-aue-model="split-media-slide"] > div:nth-child(4)')!;
    content.innerHTML = '<p>Nature guide</p><p>Discover the island with Ketut.</p>';

    decorate(element);

    expect(element.querySelector('.split-media-item--right .split-media-headline')?.textContent).toBe('Nature guide');
    expect(element.querySelector('.split-media-description')?.textContent).toBe('Discover the island with Ketut.');
  });

  it('preserves every published richtext node after the headline', () => {
    const element = block([], 1);
    const content = element.querySelector<HTMLElement>('[data-aue-model] > div:nth-child(4)')!;
    content.innerHTML =
      '<p>Title</p><p>First</p><p>Second <a href="#details">link</a></p><ul><li>List</li></ul><div><p>Wrapped</p></div>';
    const nodes = [...content.children].slice(1);
    decorate(element);
    const description = element.querySelector('.split-media-description')!;
    nodes.forEach((node) => expect(description.contains(node)).toBe(true));
    expect(description.textContent).toBe('FirstSecond linkListWrapped');
  });

  it('moves the instrumented description intact and keeps an empty description editable', () => {
    const element = block([], 1);
    const content = element.querySelector<HTMLElement>('[data-aue-model] > div:nth-child(4)')!;
    content.innerHTML =
      '<p data-aue-prop="rightContent_headline">Title</p><div data-aue-prop="rightContent_description"></div>';
    const description = content.lastElementChild!;
    decorate(element);
    expect(element.querySelector('.split-media-description')).toBe(description);
    expect(description.closest('.split-media-hidden')).toBeNull();
  });
});
