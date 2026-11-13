import { loadFragment } from '@/blocks/fragment/fragment.js';
import decorate from './header';

jest.mock('@/app/aem.js', () => ({
  getMetadata: () => '/nav',
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
const originalMatchMedia = window.matchMedia;

async function buildHeader(categories: string, menu = 'global'): Promise<HTMLElement> {
  const fragment = document.createElement('main');
  fragment.innerHTML = `
    <div class="section" data-menu="${menu}">
      <div class="default-content-wrapper">
        <p><a href="/">Logo</a></p>
        <ul><li>Languages<ul><li><a href="/en">English</a></li></ul></li></ul>
        <p><a href="/book">Book</a></p>
      </div>
    </div>
    <div class="section"><div class="default-content-wrapper">${categories}</div></div>`;
  const block = document.createElement('div');
  block.className = 'header block';
  document.body.append(block);
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
