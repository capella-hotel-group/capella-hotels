jest.mock('@/app/scripts.js', () => ({ moveInstrumentation: () => {} }));

import { SelectorUI } from './selector-ui';
import type { HeroVideoItem } from './types';

const initialTop = Object.getOwnPropertyDescriptor(window, 'top');

function createItem(openInNewTab: boolean): HeroVideoItem {
  return {
    label: 'Ubud',
    videoUrl: '',
    posterUrl: '',
    link: '/destination',
    openInNewTab,
    focalDesktop: 'center',
    focalMobile: 'center',
    sourceRow: document.createElement('div'),
  };
}

function createUI(item: HeroVideoItem): { ui: SelectorUI; list: HTMLUListElement } {
  const list = document.createElement('ul');
  const ui = new SelectorUI(list, document.createElement('div'));
  ui.setIntroComplete(true);
  ui.renderItems([item], 0);
  // jsdom has no Element.animate
  jest.spyOn(ui, 'activateItem').mockImplementation(() => {});
  return { ui, list };
}

describe('hero-video item button', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (initialTop) Object.defineProperty(window, 'top', initialTop);
  });

  it('never navigates, even when clicking the active item', () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    const { list } = createUI(createItem(true));

    list.querySelector('button')?.click();

    expect(open).not.toHaveBeenCalled();
  });

  it('emits selection when clicked', () => {
    const { ui, list } = createUI(createItem(false));
    const onSelect = jest.fn();
    ui.onSelect(onSelect);

    list.querySelector('button')?.click();

    expect(onSelect).toHaveBeenCalledWith(0, 'pointer');
  });

  it('renders looping clones hidden from assistive tech, keeping originals in the middle cycle', () => {
    const list = document.createElement('ul');
    const ui = new SelectorUI(list, document.createElement('div'));
    ui.renderItems([createItem(false), createItem(false), createItem(false)], 1);

    const lis = [...list.children] as HTMLElement[];
    const originals = lis.filter((li) => li.getAttribute('aria-hidden') !== 'true');
    expect(lis).toHaveLength(21);
    expect(originals).toHaveLength(3);
    expect(originals.map((li) => li.dataset.slot)).toEqual(['9', '10', '11']);
    expect(originals[1]?.getAttribute('aria-selected')).toBe('true');
    lis
      .filter((li) => li.getAttribute('aria-hidden') === 'true')
      .forEach((li) => {
        expect(li.hasAttribute('role')).toBe(false);
        expect(li.querySelector('button')?.tabIndex).toBe(-1);
      });
  });

  it('selects only after the scroll settles, not on programmatic moves', () => {
    jest.useFakeTimers();
    const list = document.createElement('ul');
    const viewport = document.createElement('div');
    viewport.append(list);
    const ui = new SelectorUI(list, viewport);
    ui.renderItems([createItem(false), createItem(false), createItem(false)], 0);
    ui.setIntroComplete(true);
    const onSelect = jest.fn();
    ui.onSelect(onSelect);

    ui.activateItem(2, true);
    jest.advanceTimersByTime(1000);
    expect(onSelect).not.toHaveBeenCalled();
    expect(list.querySelector('[data-slot="11"]')?.getAttribute('aria-selected')).toBe('true');

    list.querySelector<HTMLButtonElement>('[data-slot="10"] button')?.click();
    expect(onSelect).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(1, 'pointer');
    jest.useRealTimers();
  });

  it('leaves item clicks to Universal Editor selection', () => {
    Object.defineProperty(window, 'top', { configurable: true, value: {} });
    const { ui, list } = createUI(createItem(false));
    const onSelect = jest.fn();
    ui.onSelect(onSelect);

    list.querySelector('button')?.click();

    expect(onSelect).not.toHaveBeenCalled();
  });
});
