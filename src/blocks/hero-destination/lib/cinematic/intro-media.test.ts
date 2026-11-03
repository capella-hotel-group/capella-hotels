import { buildIntroMedia } from './intro-media';

function picture(src: string, alt = ''): HTMLPictureElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<picture><img src="${src}" alt="${alt}" loading="lazy"></picture>`;
  return wrapper.querySelector('picture') as HTMLPictureElement;
}

describe('buildIntroMedia', () => {
  let mqMatches: boolean;
  let mqListener: (() => void) | undefined;

  beforeEach(() => {
    mqMatches = false;
    mqListener = undefined;
    window.matchMedia = jest.fn().mockImplementation(() => ({
      get matches() {
        return mqMatches;
      },
      addEventListener: (_type: string, cb: () => void) => {
        mqListener = cb;
      },
      removeEventListener: jest.fn(),
    }));
  });

  const shownSrc = (el: HTMLElement) => el.querySelector('img')?.getAttribute('src');

  it('returns null without any picture', () => {
    expect(buildIntroMedia(null, null)).toBeNull();
  });

  it('shows the desktop picture eagerly at desktop widths', () => {
    const intro = buildIntroMedia(picture('/d.jpg', 'Tea'), picture('/m.jpg'));
    expect(intro?.element.className).toBe('hero-destination-video-intro');
    expect(shownSrc(intro!.element)).toBe('/d.jpg');
    const img = intro!.element.querySelector('img')!;
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
  });

  it('shows the mobile picture with the desktop alt below 768px', () => {
    mqMatches = true;
    const intro = buildIntroMedia(picture('/d.jpg', 'Tea'), picture('/m.jpg'));
    expect(shownSrc(intro!.element)).toBe('/m.jpg');
    expect(intro!.element.querySelector('img')?.getAttribute('alt')).toBe('Tea');
  });

  it('falls back to whichever picture exists', () => {
    mqMatches = true;
    expect(shownSrc(buildIntroMedia(picture('/d.jpg'), null)!.element)).toBe('/d.jpg');
    mqMatches = false;
    expect(shownSrc(buildIntroMedia(null, picture('/m.jpg'))!.element)).toBe('/m.jpg');
  });

  it.each(['load', 'error'])('resolves loaded on img %s', async (type) => {
    const intro = buildIntroMedia(picture('/d.jpg'), null)!;
    let done = false;
    intro.loaded.then(() => {
      done = true;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    intro.element.querySelector('img')!.dispatchEvent(new Event(type));
    await intro.loaded;
    expect(done).toBe(true);
  });

  it('swaps pictures when crossing the breakpoint', () => {
    const intro = buildIntroMedia(picture('/d.jpg'), picture('/m.jpg'))!;
    mqMatches = true;
    mqListener?.();
    expect(shownSrc(intro.element)).toBe('/m.jpg');
    expect(intro.element.querySelectorAll('picture')).toHaveLength(1);
  });
});
