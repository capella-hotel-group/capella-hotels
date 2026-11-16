jest.mock('@/app/scripts.js', () => ({
  LANG_MAP: { 'zh-cn': 'zh-CN', jp: 'ja' },
  VALID_LANG_PRIMARIES: new Set(['ar', 'en', 'ja', 'ko', 'zh']),
}));

import { deslug, parsePagePath, rootDepth, toHref, trailPaths } from './path';

describe('breadcrumb path helpers', () => {
  it('parses delivery paths', () => {
    expect(parsePagePath('/singapore/en/accommodation/colonial-manor')).toEqual({
      segments: ['singapore', 'en', 'accommodation', 'colonial-manor'],
      isAuthor: false,
    });
  });

  it('parses author paths, keeping their casing', () => {
    expect(parsePagePath('/content/capella-hotels/Singapore/en/accommodation.html')).toEqual({
      segments: ['Singapore', 'en', 'accommodation'],
      isAuthor: true,
    });
  });

  it('ignores a trailing slash', () => {
    expect(parsePagePath('/singapore/en/')).toEqual({ segments: ['singapore', 'en'], isAuthor: false });
  });

  it('finds the root at the first language segment', () => {
    expect(rootDepth(['singapore', 'en', 'x'])).toBe(2);
    expect(rootDepth(['en', 'x'])).toBe(1);
    expect(rootDepth(['global', 'jp', 'x'])).toBe(2);
    expect(rootDepth(['test-pages', 'qa', 'card'])).toBe(1);
    expect(rootDepth([])).toBe(0);
  });

  it('builds no trail for the root page', () => {
    expect(trailPaths(parsePagePath('/singapore/en'))).toEqual([]);
    expect(trailPaths(parsePagePath('/singapore/en/'))).toEqual([]);
  });

  it('treats the home page as the root page', () => {
    expect(trailPaths(parsePagePath('/singapore/en/home'))).toEqual([]);
    expect(trailPaths(parsePagePath('/content/capella-hotels/Singapore/en/home.html'))).toEqual([]);
  });

  it('leaves the home page out of deeper trails', () => {
    expect(trailPaths(parsePagePath('/singapore/en/home/offers'))).toEqual([
      ['singapore', 'en'],
      ['singapore', 'en', 'home', 'offers'],
    ]);
  });

  it('builds the trail from root to the current page', () => {
    expect(trailPaths(parsePagePath('/singapore/en/accommodation/colonial-manor'))).toEqual([
      ['singapore', 'en'],
      ['singapore', 'en', 'accommodation'],
      ['singapore', 'en', 'accommodation', 'colonial-manor'],
    ]);
  });

  it('builds hrefs for author and delivery', () => {
    expect(toHref(['Singapore', 'en', 'accommodation'], true)).toBe(
      '/content/capella-hotels/Singapore/en/accommodation.html',
    );
    expect(toHref(['singapore', 'en'], false)).toBe('/singapore/en');
  });

  it('turns a slug into a label', () => {
    expect(deslug('colonial-manor')).toBe('Colonial Manor');
  });
});
