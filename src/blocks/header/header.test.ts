import { getMetadata } from '@/app/aem.js';
import { loadFragment } from '@/blocks/fragment/fragment.js';
import decorate from './header';

jest.mock('@/app/aem.js', () => ({
  getMetadata: jest.fn(() => '/nav'),
}));
jest.mock('@/blocks/fragment/fragment.js', () => ({
  loadFragment: jest.fn(),
}));
jest.mock('@/app/scripts.js', () => ({
  moveInstrumentation: jest.fn(),
  SUPPORTED_SITES: ['global', 'singapore'],
  DEFAULT_SITE_SEGMENT: '',
  LANG_MAP: {},
  VALID_LANG_PRIMARIES: new Set(['en']),
}));
jest.mock('@/utils/env', () => ({
  isUniversalEditor: () => false,
}));

const mockLoadFragment = jest.mocked(loadFragment);
const mockGetMetadata = jest.mocked(getMetadata);
const originalMatchMedia = window.matchMedia;
const originalRequestAnimationFrame = window.requestAnimationFrame;

function navFragment(categories: string, menu = 'global', logoSources: string[] = []): HTMLElement {
  const fragment = document.createElement('main');
  fragment.innerHTML = `
    <div class="section" data-menu="${menu}">
      <div class="default-content-wrapper">
        ${logoSources.map((src) => `<p><picture><img src="${src}"></picture></p>`).join('')}
        <p><a href="/">Logo</a></p>
        <ul><li>Languages<ul><li><a href="/en">English</a></li></ul></li></ul>
        <p><a href="/book">Book</a></p>
      </div>
    </div>
    <div class="section"><div class="default-content-wrapper">${categories}</div></div>`;
  return fragment;
}

async function buildHeader(
  categories: string,
  menu = 'global',
  wrapHeader = false,
  logoSources: string[] = [],
): Promise<HTMLElement> {
  const fragment = navFragment(categories, menu, logoSources);
  const block = document.createElement('div');
  block.className = 'header block';
  if (wrapHeader) {
    const header = document.createElement('header');
    header.append(block);
    document.body.append(header);
  } else {
    document.body.append(block);
  }
  mockLoadFragment.mockResolvedValueOnce(fragment);
  await decorate(block);
  return block;
}

function category(label: string): string {
  return `<ul><li><p>${label}</p><ul>
    <li><a href="/overview">OVERVIEW</a> | open-in-new-tab</li>
    <li><a href="/little-star">LITTLE STAR</a> | open-in-same-tab</li>
  </ul></li></ul>`;
}

describe('header navigation variants', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn(() => ({ matches: false, addEventListener: jest.fn() })),
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    jest.clearAllMocks();
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  it.each([
    ['nav--global', 'nav-global'],
    [' NAV--DESTINATION ', 'nav-destination'],
  ])('classifies categories from %s', async (marker, className) => {
    const header = await buildHeader(category(`EXPERIENCES | ${marker}`));
    const trigger = header.querySelector('.header-menu-category-trigger');
    expect(trigger?.textContent).toBe('EXPERIENCES');
    expect(header.querySelector('.header-menu-category-content')?.classList.contains(className)).toBe(true);
    expect(header.querySelector('.header-menu-link-grid a')?.getAttribute('target')).toBe('_blank');
    expect(header.querySelectorAll('.header-menu-link-grid a')[1]?.getAttribute('target')).toBeNull();
  });

  it.each([
    ['nav--global', 'destination', 'nav-global'],
    ['nav--destination', 'global', 'nav-destination'],
  ])('ignores %s conflicting menu metadata', async (marker, metadata, className) => {
    const header = await buildHeader(category(`EXPERIENCES | ${marker}`), metadata);
    expect(header.querySelector('.header-menu-category-content')?.classList.contains(className)).toBe(true);
  });

  it.each(['EXPERIENCES', 'EXPERIENCES | custom-marker'])(
    'defaults unmarked categories to global and preserves %s',
    async (label) => {
      const header = await buildHeader(category(label), 'destination');
      expect(header.querySelector('.header-menu-category-trigger')?.textContent).toBe(label);
      expect(header.querySelector('.header-menu-category-content')?.classList.contains('nav-global')).toBe(true);
    },
  );

  it.each([
    ['nav--destination | open-in-new-tab', '_blank'],
    ['open-in-new-tab | nav--destination', '_blank'],
    ['nav--destination | open-in-same-tab', null],
  ])('preserves category target alongside %s', async (markers, target) => {
    const header = await buildHeader(`<ul><li><a href="/experience">EXPERIENCES</a> | ${markers}</li></ul>`);
    const anchor = header.querySelector<HTMLAnchorElement>('a.header-menu-category-trigger');
    expect(anchor?.getAttribute('target')).toBe(target);
    expect(anchor?.querySelector('.header-sr-only')?.textContent ?? '').toBe(target ? ' (opens in a new tab)' : '');
    expect(anchor?.textContent).not.toContain('nav--');
    expect(anchor?.getAttribute('href')).toBe('/experience');
    if (target) expect(anchor?.rel).toBe('noopener');
  });

  it('preserves mixed category contents and merged regions', async () => {
    const header = await buildHeader(
      category('EXPERIENCES | nav--destination') +
        `<ul><li>DESTINATIONS | nav--global<ul>
          <li>EUROPE | merge-columns<ul><li><a href="/london">LONDON</a></li></ul></li>
          <li>MIDDLE EAST<ul><li>A VERY LONG DESTINATION NAME WITHOUT A LINK</li></ul></li>
        </ul></li></ul>`,
    );
    const panes = header.querySelectorAll('.header-menu-category-content');
    expect(panes[0]?.classList.contains('nav-destination')).toBe(true);
    expect(panes[1]?.classList.contains('nav-global')).toBe(true);
    expect(panes[1]?.classList.contains('nav-destination')).toBe(false);
    expect(panes[1]?.querySelectorAll('.header-menu-merged-cell')).toHaveLength(2);
    expect(panes[1]?.querySelector('.nav-link.is-disabled')?.textContent).toBe(
      'A VERY LONG DESTINATION NAME WITHOUT A LINK',
    );
    expect(panes[1]?.querySelector('a')?.getAttribute('href')).toBe('/london');
  });
});

describe('header compact logo', () => {
  beforeEach(() => {
    mockLoadFragment.mockReset();
    mockGetMetadata.mockReturnValue('/qa/nav');
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  });

  afterEach(() => {
    document.body.replaceChildren();
    mockLoadFragment.mockReset();
    mockGetMetadata.mockReturnValue('/nav');
    jest.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  it('uses the authored icon without loading another nav', async () => {
    const header = await buildHeader(category('EXPERIENCES'), 'global', false, [
      '/locale-default.svg',
      '/locale-dark.png',
      '/locale-icon.png',
    ]);

    expect(header.querySelector('.header-logo-img-scroll')?.getAttribute('src')).toBe('/locale-icon.png');
    expect(mockLoadFragment).toHaveBeenCalledTimes(1);
  });

  it('inherits the shared icon instead of the full wordmark when the local nav has only two logos', async () => {
    mockLoadFragment.mockResolvedValue(
      navFragment(category('EXPERIENCES'), 'global', ['/shared-default.svg', '/shared-dark.png', '/shared-icon.png']),
    );
    const header = await buildHeader(category('EXPERIENCES'), 'global', false, [
      '/locale-default.svg',
      '/locale-dark.png',
    ]);

    expect(header.querySelector('.header-logo-img-scroll')?.getAttribute('src')).toBe('/shared-icon.png');
    expect(header.querySelector('.header-logo-img-default')?.getAttribute('src')).toBe('/locale-default.svg');
    expect(header.querySelector('.header-logo-img-active')?.getAttribute('src')).toBe('/locale-dark.png');
    expect(mockLoadFragment).toHaveBeenCalledWith('/nav');
  });

  it('warns and preserves the existing logo fallback if the shared icon is unavailable', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLoadFragment.mockResolvedValue(null);
    const header = await buildHeader(category('EXPERIENCES'), 'global', false, [
      '/locale-default.svg',
      '/locale-dark.png',
    ]);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Icon-only logo'));
    expect(header.querySelector('.header-logo-img-scroll')?.getAttribute('src')).toBe('/locale-dark.png');
  });
});

describe('header overlay theme', () => {
  let animationFrames: FrameRequestCallback[];

  beforeEach(() => {
    animationFrames = [];
    window.matchMedia = jest
      .fn()
      .mockReturnValue({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      },
    });
  });

  afterEach(async () => {
    document.body.replaceChildren();
    await Promise.resolve();
    flushAnimationFrames();
    if (originalRequestAnimationFrame) {
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        value: originalRequestAnimationFrame,
      });
    } else {
      Reflect.deleteProperty(window, 'requestAnimationFrame');
    }
  });

  afterAll(() => {
    window.matchMedia = originalMatchMedia;
  });

  function flushAnimationFrames(): void {
    const callbacks = animationFrames.splice(0);
    callbacks.forEach((callback) => callback(0));
  }

  function setRect(element: HTMLElement, top: number, bottom: number): void {
    element.getBoundingClientRect = () =>
      ({
        x: 0,
        y: top,
        top,
        bottom,
        left: 0,
        right: 0,
        width: 0,
        height: bottom - top,
        toJSON: () => {},
      }) as DOMRect;
  }

  async function themedHeader(): Promise<{ block: HTMLElement; header: HTMLElement }> {
    const block = await buildHeader(category('EXPERIENCES'), 'global', true);
    const header = block.closest('header') as HTMLElement;
    setRect(header, 0, 104);
    return { block, header };
  }

  it('applies the declared theme when the block intersects the header bottom edge', async () => {
    const { block, header } = await themedHeader();
    block.dataset.headerTheme = 'overlay';
    setRect(block, 103, 1000);

    flushAnimationFrames();

    expect(header.dataset.theme).toBe('overlay');
  });

  it('does not apply a theme when a declared block does not intersect the header bottom edge', async () => {
    const { block, header } = await themedHeader();
    block.dataset.headerTheme = 'overlay';
    setRect(block, 104, 1000);

    flushAnimationFrames();

    expect(header.dataset.theme).toBeUndefined();
  });

  it('clears the theme after scrolling past the declared block', async () => {
    const { block, header } = await themedHeader();
    block.dataset.headerTheme = 'overlay';
    setRect(block, 103, 1000);
    flushAnimationFrames();
    expect(header.dataset.theme).toBe('overlay');

    setRect(block, -1000, 0);
    window.dispatchEvent(new Event('scroll'));
    flushAnimationFrames();

    expect(header.dataset.theme).toBeUndefined();
  });

  it('clears the theme when the active block is removed without scrolling', async () => {
    const { block, header } = await themedHeader();
    block.dataset.headerTheme = 'overlay';
    setRect(block, 103, 1000);
    flushAnimationFrames();
    expect(header.dataset.theme).toBe('overlay');

    block.remove();
    await Promise.resolve();
    flushAnimationFrames();

    expect(header.dataset.theme).toBeUndefined();
  });

  it('applies the theme when an eligible block is added without scrolling', async () => {
    const { header } = await themedHeader();
    flushAnimationFrames();

    const block = document.createElement('div');
    block.dataset.headerTheme = 'overlay';
    setRect(block, 103, 1000);
    document.body.append(block);
    await Promise.resolve();
    flushAnimationFrames();

    expect(header.dataset.theme).toBe('overlay');
  });

  it('updates the theme when the active block attribute changes', async () => {
    const { block, header } = await themedHeader();
    block.dataset.headerTheme = 'overlay';
    setRect(block, 103, 1000);
    flushAnimationFrames();
    expect(header.dataset.theme).toBe('overlay');

    block.removeAttribute('data-header-theme');
    await Promise.resolve();
    flushAnimationFrames();

    expect(header.dataset.theme).toBeUndefined();
  });

  it('rechecks the block against the new header edge after resizing', async () => {
    const { block, header } = await themedHeader();
    block.dataset.headerTheme = 'overlay';
    setRect(block, 101, 1000);
    setRect(header, 0, 100);
    flushAnimationFrames();
    expect(header.dataset.theme).toBeUndefined();

    setRect(header, 0, 104);
    window.dispatchEvent(new Event('resize'));
    flushAnimationFrames();

    expect(header.dataset.theme).toBe('overlay');
  });
});
