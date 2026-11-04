jest.mock('@/utils/env.js', () => ({ resolveDAMUrl: (url: string) => url }));

import { DEFAULT_HEADING_DELAY_MS, parseVideoHero } from './parse';

const pic = (src: string, alt = ''): string => `<picture><img src="${src}" alt="${alt}"></picture>`;
const link = (href: string): string => `<a href="${href}">${href}</a>`;

function rows(cells: string[]): HTMLElement[] {
  return cells.map((html) => {
    const row = document.createElement('div');
    row.innerHTML = `<div>${html}</div>`;
    return row;
  });
}

const FULL = [
  pic('/intro.jpg', 'Tea'),
  pic('/intro-m.jpg'),
  link('/v.mp4'),
  link('/v-m.mp4'),
  pic('/poster.jpg'),
  'false',
  'false',
  'Kyoto',
  '800',
];

describe('parseVideoHero', () => {
  it('parses every authored row by position', () => {
    const config = parseVideoHero(rows(FULL));
    expect(config.introPicture?.querySelector('img')?.getAttribute('src')).toBe('/intro.jpg');
    expect(config.introPictureMobile?.querySelector('img')?.getAttribute('src')).toBe('/intro-m.jpg');
    expect(config.desktopVideoUrl).toBe('/v.mp4');
    expect(config.mobileVideoUrl).toBe('/v-m.mp4');
    expect(config.posterPicture?.querySelector('img')?.getAttribute('src')).toBe('/poster.jpg');
    expect(config.loop).toBe(false);
    expect(config.showOverlay).toBe(false);
    expect(config.heading).toBe('Kyoto');
    expect(config.headingCell?.textContent).toBe('Kyoto');
    expect(config.headingDelayMs).toBe(800);
  });

  it('applies defaults when optional rows are empty', () => {
    const config = parseVideoHero(rows(['', '', link('/v.mp4'), '', '', '', '', 'Kyoto', '']));
    expect(config.introPicture).toBeNull();
    expect(config.introPictureMobile).toBeNull();
    expect(config.mobileVideoUrl).toBe('/v.mp4');
    expect(config.posterPicture).toBeNull();
    expect(config.loop).toBe(true);
    expect(config.showOverlay).toBe(false);
    expect(config.headingDelayMs).toBe(DEFAULT_HEADING_DELAY_MS);
  });

  it.each([['abc'], ['-5']])('falls back to the default delay for %s', (raw) => {
    const cells = [...FULL];
    cells[8] = raw;
    expect(parseVideoHero(rows(cells)).headingDelayMs).toBe(DEFAULT_HEADING_DELAY_MS);
  });

  it('accepts a zero delay', () => {
    const cells = [...FULL];
    cells[8] = '0';
    expect(parseVideoHero(rows(cells)).headingDelayMs).toBe(0);
  });

  it('ignores cells whose content does not match the slot', () => {
    const cells = [...FULL];
    cells[0] = 'not a picture';
    cells[2] = 'not a link';
    const config = parseVideoHero(rows(cells));
    expect(config.introPicture).toBeNull();
    expect(config.desktopVideoUrl).toBe('');
  });

  it('handles an uncollapsed introImageAlt row (10 rows)', () => {
    const cells = [pic('/intro.jpg'), 'Tea ceremony', ...FULL.slice(1)];
    const config = parseVideoHero(rows(cells));
    expect(config.introPicture?.querySelector('img')?.getAttribute('alt')).toBe('Tea ceremony');
    expect(config.desktopVideoUrl).toBe('/v.mp4');
    expect(config.heading).toBe('Kyoto');
    expect(config.headingDelayMs).toBe(800);
  });
});
