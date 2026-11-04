jest.mock('@/utils/env.js', () => ({ resolveDAMUrl: (url: string) => url }));

import { parseCarouselConfig, parseIntro, parseItems, splitBlockRows } from './parse';

function row(...cells: string[]): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = cells.map((cell) => `<div>${cell}</div>`).join('');
  return el;
}

const PICTURE = '<picture><img src="/a.png" alt=""></picture>';
const VIDEO = '<a href="/clip.mp4">clip</a>';

describe('hero-destination parseItems showOverlay', () => {
  it.each([
    ['true', true],
    ['false', false],
    ['yes', true],
    ['no', false],
  ])('reads "%s" before heading as showOverlay=%s', (value, expected) => {
    const [item] = parseItems([row('image', PICTURE, 'Alt', value, 'Heading')]);
    expect(item.showOverlay).toBe(expected);
    expect(item.heading).toBe('Heading');
  });

  it('does not treat the overlay cell as alt text', () => {
    const [item] = parseItems([row('image', PICTURE, 'false', 'Heading')]);
    expect(item).toMatchObject({ mediaType: 'image', imageAlt: '', showOverlay: false });
  });

  it('keeps alt text when overlay cell is present', () => {
    const [item] = parseItems([row('image', PICTURE, PICTURE, 'Alt text', 'true', 'Heading')]);
    expect(item).toMatchObject({ mediaType: 'image', imageAlt: 'Alt text', showOverlay: true });
  });

  it('parses video items with the overlay cell', () => {
    const [item] = parseItems([row('video', VIDEO, 'false', 'Heading')]);
    expect(item).toMatchObject({ mediaType: 'video', desktopVideoUrl: '/clip.mp4', showOverlay: false });
  });

  it('defaults to true for legacy rows without the overlay cell', () => {
    const [image, legacy, video] = parseItems([
      row('image', PICTURE, 'Alt', 'Heading'),
      row(PICTURE, 'Heading'),
      row('video', VIDEO, 'Heading'),
    ]);
    expect(image).toMatchObject({ imageAlt: 'Alt', showOverlay: true });
    expect(legacy).toMatchObject({ mediaType: 'image', showOverlay: true });
    expect(video).toMatchObject({ mediaType: 'video', showOverlay: true });
  });

  it('defaults to true when the overlay cell is empty', () => {
    const [item] = parseItems([row('image', PICTURE, 'Alt', '', 'Heading')]);
    expect(item).toMatchObject({ imageAlt: 'Alt', showOverlay: true });
  });

  it('keeps empty items selectable and honours the toggle', () => {
    const [item] = parseItems([row('image', '', 'false', 'Heading')]);
    expect(item).toMatchObject({ mediaType: 'empty', showOverlay: false });
  });
});

describe('hero-destination parseItems imageAlt', () => {
  it('falls back to the alt collapsed into the image when there is no alt cell', () => {
    const collapsed = '<picture><img src="/a.png" alt="Collapsed alt"></picture>';
    const [item] = parseItems([row('image', collapsed, 'true', 'Heading')]);
    expect(item).toMatchObject({ mediaType: 'image', imageAlt: 'Collapsed alt' });
  });

  it('prefers an explicit alt cell over the image alt', () => {
    const collapsed = '<picture><img src="/a.png" alt="Collapsed alt"></picture>';
    const [item] = parseItems([row('image', collapsed, 'Cell alt', 'true', 'Heading')]);
    expect(item).toMatchObject({ imageAlt: 'Cell alt' });
  });
});

describe('hero-destination parseCarouselConfig', () => {
  it('reads all five config rows by position', () => {
    const rows = ['false', '7', 'false', 'cube', 'false'].map((value) => row(value));
    expect(parseCarouselConfig(rows)).toEqual({
      autoplay: false,
      intervalSeconds: 7,
      loop: false,
      transitionEffect: 'cube',
      simulateTouch: false,
    });
  });

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseCarouselConfig([row(''), row('abc')])).toEqual({
      autoplay: true,
      intervalSeconds: 3,
      loop: true,
      transitionEffect: 'fade',
      simulateTouch: true,
    });
  });
});

describe('hero-destination buildSlide overlay class', () => {
  it('adds the no-overlay modifier only when showOverlay is false', async () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false, addEventListener: jest.fn() });
    jest.doMock('@/app/scripts.js', () => ({ moveInstrumentation: () => {} }));
    // media.ts reads matchMedia at module scope.
    const { buildSlide } = await import('./dom-builder');
    const [on, off] = parseItems([row('image', PICTURE, 'true', 'On'), row('image', PICTURE, 'false', 'Off')]);
    const media = (item: typeof on) => buildSlide(item, 0, 'hd', 1).querySelector('.hero-destination-media')!;
    expect(media(on).classList.contains('hero-destination-media--no-overlay')).toBe(false);
    expect(media(off).classList.contains('hero-destination-media--no-overlay')).toBe(true);
  });
});

describe('hero-destination splitBlockRows', () => {
  const config = ['true', '3', 'true', 'fade', 'true'];

  it('treats exactly five rows as config only', () => {
    const rows = config.map((value) => row(value));
    expect(splitBlockRows(rows)).toEqual({ introRows: [], configRows: rows });
  });

  it.each([2, 3])('treats %i leading rows as intro rows', (introCount) => {
    const intro = Array.from({ length: introCount }, () => row(PICTURE));
    const rows = [...intro, ...config.map((value) => row(value))];
    const { introRows, configRows } = splitBlockRows(rows);
    expect(introRows).toEqual(intro);
    expect(configRows).toHaveLength(5);
  });

  it('keeps short legacy config lists positional', () => {
    const rows = [row('true'), row('5')];
    expect(splitBlockRows(rows)).toEqual({ introRows: [], configRows: rows });
  });
});

describe('hero-destination parseIntro', () => {
  const pic = (src: string, alt = ''): string => `<picture><img src="${src}" alt="${alt}"></picture>`;

  it('returns null without intro rows', () => {
    expect(parseIntro([])).toBeNull();
  });

  it('returns null when intro rows carry no picture', () => {
    expect(parseIntro([row(''), row(''), row('')])).toBeNull();
  });

  it('reads desktop and mobile when the alt collapsed into the image', () => {
    const intro = parseIntro([row(pic('/d.jpg', 'Tea')), row(pic('/m.jpg'))]);
    expect(intro?.desktop?.querySelector('img')?.getAttribute('src')).toBe('/d.jpg');
    expect(intro?.mobile?.querySelector('img')?.getAttribute('src')).toBe('/m.jpg');
    expect(intro?.desktop?.querySelector('img')?.getAttribute('alt')).toBe('Tea');
  });

  it('applies a separate alt row to both images', () => {
    const intro = parseIntro([row(pic('/d.jpg')), row('Lanterns'), row(pic('/m.jpg'))]);
    expect(intro?.desktop?.querySelector('img')?.getAttribute('alt')).toBe('Lanterns');
    expect(intro?.mobile?.querySelector('img')?.getAttribute('alt')).toBe('Lanterns');
  });

  it('keeps a mobile-only intro', () => {
    const intro = parseIntro([row(''), row(''), row(pic('/m.jpg'))]);
    expect(intro?.desktop).toBeNull();
    expect(intro?.mobile).not.toBeNull();
  });
});
