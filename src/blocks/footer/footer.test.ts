import { getMetadata } from '@/app/aem.js';
import { loadFragment } from '@/blocks/fragment/fragment.js';
import decorate from './footer';

jest.mock('@/app/aem.js', () => ({
  getMetadata: jest.fn(() => '/footer'),
}));

jest.mock('@/blocks/fragment/fragment.js', () => ({
  loadFragment: jest.fn(),
}));

jest.mock('@/app/scripts.js', () => ({
  moveInstrumentation: jest.fn(),
  SUPPORTED_SITES: ['global', 'singapore'],
  DEFAULT_SITE_SEGMENT: 'global',
  LANG_MAP: { en: 'English' },
  VALID_LANG_PRIMARIES: new Set(['en']),
}));

const mockLoadFragment = jest.mocked(loadFragment);

function createFragment(withSeparators: boolean, visibleInPublish = false): HTMLElement {
  const fragment = document.createElement('main');
  const pieces = [
    '<div class="footer"><div><div>clean-white</div></div></div>',
    '<div class="footer-contact-info">Contact details</div>',
    '<div class="footer-social">Social links</div>',
    '<div class="footer-nav-columns">Navigation links</div>',
    '<div class="newsletter-form">Newsletter signup</div>',
    '<div class="footer-legal">Legal links</div>',
  ];
  fragment.innerHTML = pieces
    .map(
      (piece) =>
        `<div class="section">${piece}${
          withSeparators
            ? `<div class="separator-wrapper"><div class="separator block${
                visibleInPublish ? '' : ' separator--publish-hidden'
              } separator--with-line" data-aue-model="separator">
              <div><div>100px</div></div><div><div>80px</div></div>
              <div><div>${visibleInPublish}</div></div><div><div>true</div></div>
            </div></div>`
            : ''
        }</div>`,
    )
    .join('');
  return fragment;
}

async function buildFooter(fragment: HTMLElement): Promise<HTMLElement> {
  const landmark = document.createElement('footer');
  const block = document.createElement('div');
  block.className = 'footer block';
  landmark.append(block);
  document.body.append(landmark);
  mockLoadFragment.mockResolvedValueOnce(fragment);
  await decorate(block);
  return block;
}

describe('footer separators', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.classList.remove('adobe-ue-edit');
    jest.clearAllMocks();
  });

  it.each([false, true])(
    'keeps the assembled footer unchanged with separators (visibleInPublish=%s)',
    async (visibleInPublish) => {
      const baseline = await buildFooter(createFragment(false));
      const fragment = createFragment(true, visibleInPublish);
      const footer = await buildFooter(fragment);

      expect(footer.innerHTML).toBe(baseline.innerHTML);
      expect(footer.querySelector('.separator, .separator-wrapper')).toBeNull();
      expect(footer.querySelectorAll('.footer-divider')).toHaveLength(4);
      expect(fragment.querySelectorAll('[data-aue-model="separator"]')).toHaveLength(6);
    },
  );

  it('does not pull authoring separators into the assembled footer in UE', async () => {
    document.documentElement.classList.add('adobe-ue-edit');
    const fragment = createFragment(true);

    const footer = await buildFooter(fragment);

    expect(footer.querySelector('.separator')).toBeNull();
    expect(footer.querySelector('.footer-contact-info')?.textContent).toBe('Contact details');
    expect(fragment.querySelectorAll('[data-aue-model="separator"]')).toHaveLength(6);
  });

  it('ignores component matches inside separators while assembling the DOM', async () => {
    const baseline = await buildFooter(createFragment(false));
    const fragment = createFragment(true, true);
    const separator = document.createElement('div');
    separator.className = 'separator';
    separator.innerHTML = createFragment(false).innerHTML;
    fragment.prepend(separator);
    const originalSeparator = separator.innerHTML;

    const footer = await buildFooter(fragment);

    expect(footer.innerHTML).toBe(baseline.innerHTML);
    expect(footer.querySelector('.separator, .separator-wrapper')).toBeNull();
    expect(separator.innerHTML).toBe(originalSeparator);
    expect(fragment.contains(separator)).toBe(true);
  });

  it('leaves the authored footer page unchanged outside the footer landmark', async () => {
    const fragment = createFragment(true);
    document.body.append(fragment);
    const block = fragment.querySelector<HTMLElement>('.footer')!;
    const original = fragment.innerHTML;

    await decorate(block);

    expect(fragment.innerHTML).toBe(original);
    expect(loadFragment).not.toHaveBeenCalled();
    expect(getMetadata).not.toHaveBeenCalled();
  });
});
