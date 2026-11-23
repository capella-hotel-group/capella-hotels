import { deslug, parsePagePath, toHref, trailPaths } from './path';

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

  it('builds no trail at or above the second URL level', () => {
    expect(trailPaths(parsePagePath('/singapore/en'))).toEqual([]);
    expect(trailPaths(parsePagePath('/singapore/en/'))).toEqual([]);
    expect(trailPaths(parsePagePath('/en/capella-singapore'))).toEqual([]);
    expect(trailPaths(parsePagePath('/en'))).toEqual([]);
    expect(trailPaths(parsePagePath('/'))).toEqual([]);
  });

  it('roots production hotel pages at the hotel page', () => {
    expect(trailPaths(parsePagePath('/en/capella-singapore/family-retreat'))).toEqual([
      ['en', 'capella-singapore'],
      ['en', 'capella-singapore', 'family-retreat'],
    ]);
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
