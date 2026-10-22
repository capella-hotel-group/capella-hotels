jest.mock('@/utils/env', () => ({ resolveDAMUrl: (url: string) => url }));

import { parseItems } from './parse';

function row(...cells: string[]): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = cells.map((cell) => `<div>${cell}</div>`).join('');
  return el;
}

const PICTURE = '<picture><img src="/poster.jpg" alt=""></picture>';
const VIDEO = '<a href="/clip.mp4">clip</a>';
const LINK = '<a href="/destination">Destination</a>';

describe('hero-video parseItems', () => {
  it('parses the new-tab field without shifting focal points', () => {
    const [item] = parseItems([row('Ubud', VIDEO, PICTURE, LINK, 'true', 'center 30%', 'center')]);

    expect(item).toMatchObject({
      label: 'Ubud',
      videoUrl: '/clip.mp4',
      posterUrl: 'http://localhost/poster.jpg',
      link: '/destination',
      openInNewTab: true,
      focalDesktop: 'center 30%',
      focalMobile: 'center',
    });
  });

  it('defaults old rows without a new-tab field to same-tab navigation', () => {
    const [item] = parseItems([row('Ubud', VIDEO, PICTURE, LINK, 'center 30%', 'center')]);

    expect(item).toMatchObject({
      link: '/destination',
      openInNewTab: false,
      focalDesktop: 'center 30%',
      focalMobile: 'center',
    });
  });

  it('recognizes the field by Universal Editor instrumentation when empty', () => {
    const [item] = parseItems([
      row('Ubud', VIDEO, PICTURE, LINK, '<span data-aue-prop="openInNewTab"></span>', 'center', 'center'),
    ]);

    expect(item).toMatchObject({ openInNewTab: false, focalDesktop: 'center', focalMobile: 'center' });
  });

  it('keeps newly added empty items in the result', () => {
    const [item] = parseItems([row('', '', '', '', 'false', '', '')]);

    expect(item).toMatchObject({
      label: 'New destination',
      videoUrl: '',
      link: null,
      openInNewTab: false,
      focalDesktop: 'center',
      focalMobile: 'center',
    });
  });
});
