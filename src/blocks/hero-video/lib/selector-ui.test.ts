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

describe('hero-video item navigation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (initialTop) Object.defineProperty(window, 'top', initialTop);
  });

  it('opens the active item link in a safe new tab when requested', () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    const list = document.createElement('ul');
    const viewport = document.createElement('div');
    const ui = new SelectorUI(list, viewport);
    ui.setIntroComplete(true);
    ui.renderItems([createItem(true)], 0);

    list.querySelector('button')?.click();

    expect(open).toHaveBeenCalledWith('/destination', '_blank', 'noopener,noreferrer');
  });

  it('leaves item clicks to Universal Editor selection', () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    Object.defineProperty(window, 'top', { configurable: true, value: {} });
    const list = document.createElement('ul');
    const viewport = document.createElement('div');
    const ui = new SelectorUI(list, viewport);
    ui.setIntroComplete(true);
    ui.renderItems([createItem(true)], 0);

    list.querySelector('button')?.click();

    expect(open).not.toHaveBeenCalled();
  });
});
