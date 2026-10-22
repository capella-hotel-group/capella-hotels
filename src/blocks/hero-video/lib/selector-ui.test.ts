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

    expect(onSelect).toHaveBeenCalledWith(0);
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
