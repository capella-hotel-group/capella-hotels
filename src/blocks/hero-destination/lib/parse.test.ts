jest.mock('@/utils/env.js', () => ({ resolveDAMUrl: (url: string) => url }));

import { parseCarouselConfig, parseIntro, parseItems, splitBlockRows } from './parse';

function row(...cells: string[]): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = cells.map((cell) => `<div>${cell}</div>`).join('');
  return el;
}

const PICTURE = '<picture><img src="/a.png" alt=""></picture>';
const VIDEO = '<a href="/clip.mp4">clip</a>';

describe('hero-destination parseItems legacy per-item overlay cell', () => {
  it.each(['true', 'false', 'yes', 'no'])('skips a stale "%s" cell before heading', (value) => {
    const [item] = parseItems([row('image', PICTURE, 'Alt', value, 'Heading')]);
    expect(item).toMatchObject({ imageAlt: 'Alt', heading: 'Heading' });
    expect(item).not.toHaveProperty('showOverlay');
  });

  it('does not treat the stale overlay cell as alt text', () => {
    const [item] = parseItems([row('image', PICTURE, 'false', 'Heading')]);
    expect(item).toMatchObject({ mediaType: 'image', imageAlt: '' });
  });

  it('parses video items with a stale overlay cell', () => {
    const [item] = parseItems([row('video', VIDEO, 'false', 'Heading')]);
    expect(item).toMatchObject({ mediaType: 'video', desktopVideoUrl: '/clip.mp4' });
  });

  it('parses rows without the overlay cell', () => {
    const [image, legacy, video] = parseItems([
      row('image', PICTURE, 'Alt', 'Heading'),
      row(PICTURE, 'Heading'),
      row('video', VIDEO, 'Heading'),
    ]);
    expect(image).toMatchObject({ imageAlt: 'Alt' });
    expect(legacy).toMatchObject({ mediaType: 'image' });
    expect(video).toMatchObject({ mediaType: 'video' });
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
  it('reads all six config rows by position', () => {
    const rows = ['false', '7', 'false', 'cube', 'false', 'false'].map((value) => row(value));
    expect(parseCarouselConfig(rows)).toEqual({
      autoplay: false,
      intervalSeconds: 7,
      loop: false,
      transitionEffect: 'cube',
      simulateTouch: false,
      showOverlay: false,
    });
  });

  it('falls back to defaults for missing or invalid values', () => {
    expect(parseCarouselConfig([row(''), row('abc')])).toEqual({
      autoplay: true,
      intervalSeconds: 3,
      loop: true,
      transitionEffect: 'fade',
      simulateTouch: true,
      showOverlay: true,
    });
  });
});

describe('hero-destination root overlay class', () => {
  it.each([
    ['true', false],
    ['false', true],
  ])('showOverlay "%s" sets no-overlay=%s on the block', async (value, noOverlay) => {
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    window.ResizeObserver = jest.fn().mockReturnValue({ observe: jest.fn(), disconnect: jest.fn() });
    jest.resetModules();
    jest.doMock('@/app/scripts.js', () => ({ moveInstrumentation: () => {} }));
    // media.ts reads matchMedia at module scope.
    const { default: decorateSlider } = await import('./slider-variant');
    const block = document.createElement('div');
    block.className = 'hero-destination';
    block.append(
      ...['true', '3', 'true', 'fade', 'true', value].map((cell) => row(cell)),
      row('image', PICTURE, 'Slide'),
    );
    decorateSlider(block);
    expect(block.classList.contains('hero-destination--no-overlay')).toBe(noOverlay);
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
    for (let i = 0; i < introCount; i++) {
      expect(introRows[i]).toBe(intro[i]);
    }
    expect(introRows).toHaveLength(introCount);
    expect(configRows).toHaveLength(5);
  });

  it('keeps short legacy config lists positional', () => {
    const rows = [row('true'), row('5')];
    expect(splitBlockRows(rows)).toEqual({ introRows: [], configRows: rows });
  });

  it.each([0, 2, 3])('takes a trailing showOverlay row as a sixth config row after %i intro rows', (introCount) => {
    const intro = Array.from({ length: introCount }, () => row(PICTURE));
    const configRows = [...config, 'false'].map((value) => row(value));
    expect(splitBlockRows([...intro, ...configRows])).toEqual({ introRows: intro, configRows });
  });

  it('does not mistake legacy 5-row config for the 6-row layout', () => {
    const intro = [row(PICTURE), row('Alt'), row(PICTURE)];
    const configRows = config.map((value) => row(value));
    expect(splitBlockRows([...intro, ...configRows])).toEqual({ introRows: intro, configRows });
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

  it('respects slots: picture in alt row (row 1) does not displace desktop/mobile', () => {
    const intro = parseIntro([row(''), row(pic('/alt-pic.jpg')), row(pic('/mobile-pic.jpg'))]);
    expect(intro?.desktop).toBeNull();
    expect(intro?.mobile?.querySelector('img')?.getAttribute('src')).toBe('/mobile-pic.jpg');
  });

  it('does not apply mobile row text as alt when alt row is empty', () => {
    const intro = parseIntro([row(pic('/d.jpg')), row(''), row('Text in mobile')]);
    expect(intro?.desktop?.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('stray pictures outside slots do not displace desktop/mobile from slots', () => {
    const intro = parseIntro([
      row(pic('/desktop.jpg')), // row 0 = desktop
      row(pic('/stray-pic.jpg')), // row 1 = alt slot (picture here is ignored)
      row(pic('/another-stray.jpg')), // row 2 = middle stray
      row(pic('/mobile.jpg')), // row 3 = mobile (last row)
    ]);
    expect(intro?.desktop?.querySelector('img')?.getAttribute('src')).toBe('/desktop.jpg');
    expect(intro?.mobile?.querySelector('img')?.getAttribute('src')).toBe('/mobile.jpg');
  });
});
