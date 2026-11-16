jest.mock('@/app/scripts.js', () => ({
  LANG_MAP: {},
  VALID_LANG_PRIMARIES: new Set(['en']),
}));
jest.mock('@/utils/env.js', () => ({ isUniversalEditor: jest.fn(() => false) }));

import { isUniversalEditor } from '@/utils/env.js';
import decorate, { renderTrail } from './breadcrumb';
import type { Crumb } from './lib/labels';

const crumb = (label: string, current = false): Crumb => ({ label, href: `/${label.toLowerCase()}`, current });

function createBlock(className = 'breadcrumb block'): HTMLElement {
  const block = document.createElement('div');
  block.className = className;
  document.body.append(block);
  return block;
}

function mockFetch(pages: Record<string, string>): jest.Mock {
  const fetchMock = jest.fn(async (url: string) => ({
    ok: url in pages,
    text: async () => `<html><head>${pages[url] ?? ''}</head></html>`,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('renderTrail', () => {
  it('links parents and marks the current page', () => {
    const nav = renderTrail([crumb('Root'), crumb('Parent'), crumb('Current', true)]);

    expect(nav.tagName).toBe('NAV');
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');
    expect(nav.dataset.testid).toBe('breadcrumb');
    expect(nav.querySelectorAll('[data-testid="breadcrumb-link"]')).toHaveLength(2);
    expect(nav.querySelector('li:last-child span[aria-current="page"]')?.textContent).toBe('Current');
    expect(nav.querySelector('[data-testid="breadcrumb-expand"]')).toBeNull();
  });

  it('collapses middle items behind an expand button when longer than three', () => {
    const nav = renderTrail([crumb('Root'), crumb('A'), crumb('B'), crumb('C'), crumb('Current', true)]);
    const button = nav.querySelector<HTMLButtonElement>('[data-testid="breadcrumb-expand"]');

    expect(nav.querySelectorAll('.breadcrumb-collapsible')).toHaveLength(3);
    expect(button?.closest('li')?.previousElementSibling?.textContent).toBe('Root');
    expect(button?.getAttribute('aria-expanded')).toBe('false');

    button?.click();

    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(nav.classList.contains('is-expanded')).toBe(true);
  });
});

describe('decorate', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.title = '';
    (isUniversalEditor as jest.Mock).mockReturnValue(false);
  });

  it('renders nothing on the root page without fetching', async () => {
    const fetchMock = mockFetch({});
    const block = createBlock();

    await decorate(block, '/singapore/en');

    expect(block.childElementCount).toBe(0);
    expect(block.hidden).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders the trail with parent labels from metadata', async () => {
    mockFetch({ '/singapore/en': '<meta name="pagetitle" content="Capella Singapore">' });
    document.title = 'Accommodation';
    const block = createBlock('breadcrumb inverse block');

    await decorate(block, '/singapore/en/accommodation');

    const link = block.querySelector<HTMLAnchorElement>('[data-testid="breadcrumb-link"]');
    expect(link?.textContent).toBe('Capella Singapore');
    expect(link?.getAttribute('href')).toBe('/singapore/en');
    expect(block.querySelector('[aria-current="page"]')?.textContent).toBe('Accommodation');
    expect(block.classList.contains('inverse')).toBe(true);
    expect(block.classList.contains('is-loading')).toBe(false);
  });

  it('renders nothing on live when every ancestor fails', async () => {
    mockFetch({});
    const block = createBlock();

    await decorate(block, '/singapore/en/accommodation');

    expect(block.childElementCount).toBe(0);
  });

  it('shows a placeholder in the editor when there is no trail', async () => {
    (isUniversalEditor as jest.Mock).mockReturnValue(true);
    mockFetch({});
    const block = createBlock();

    await decorate(block, '/singapore/en/accommodation');

    expect(block.querySelector('.breadcrumb-placeholder')).not.toBeNull();
    expect(block.hidden).toBe(false);
  });
});
