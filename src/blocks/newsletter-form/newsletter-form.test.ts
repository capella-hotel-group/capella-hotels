import type { HCaptchaApi, HCaptchaRenderOptions } from '@/types/hcaptcha.js';
import { getHCaptchaSiteKey } from '@/utils/env.js';
import decorate from './newsletter-form';

jest.mock('@/app/scripts.js', () => ({ getPageLang: () => 'en' }));

jest.mock('@/utils/env.js', () => ({
  getBasePathBasedOnEnv: () => 'https://example.test',
  getHCaptchaSiteKey: jest.fn(() => 'test-site-key'),
}));

const mockGetSiteKey = jest.mocked(getHCaptchaSiteKey);

function buildBlock({
  enableHCaptcha,
  layout = 'Modal',
}: { enableHCaptcha?: string; layout?: string } = {}): HTMLElement {
  const values = [
    'Newsletter',
    'Salutation',
    '',
    'First name',
    'Last name',
    'Email',
    'Country',
    '',
    'I agree to receive updates.',
    'Sign up',
    '',
    'Subscribe',
    layout,
  ];
  if (enableHCaptcha !== undefined) values.push(enableHCaptcha);

  const block = document.createElement('div');
  block.className = 'newsletter-form';
  block.innerHTML = values.map((value) => `<div><div>${value}</div></div>`).join('');
  document.body.append(block);
  return block;
}

describe('newsletter-form hCaptcha toggle', () => {
  afterEach(() => {
    document.body.textContent = '';
    document.head.querySelector('meta[name="hcaptcha-site-key"]')?.remove();
    delete window.hcaptcha;
    jest.clearAllMocks();
  });

  it.each([
    ['legacy content', undefined],
    ['explicitly off', 'false'],
  ])('does not render or load hCaptcha for %s', async (_label, enableHCaptcha) => {
    await decorate(buildBlock({ enableHCaptcha }));

    expect(mockGetSiteKey).not.toHaveBeenCalled();
    expect(document.querySelector('.newsletter-captcha')?.childElementCount).toBe(0);
    expect(document.querySelector('script[src*="hcaptcha.com"]')).toBeNull();
  });

  it('renders hCaptcha and gates submission when enabled', async () => {
    let renderOptions!: HCaptchaRenderOptions;
    const api: HCaptchaApi = {
      render: jest.fn((_container, options) => {
        renderOptions = options;
        return 'newsletter-captcha';
      }),
      reset: jest.fn(),
    };
    window.hcaptcha = api;

    await decorate(buildBlock({ enableHCaptcha: 'true' }));

    const submit = document.querySelector<HTMLButtonElement>('.newsletter-submit')!;
    expect(api.render).toHaveBeenCalledWith(
      document.querySelector('.newsletter-captcha'),
      expect.objectContaining({ sitekey: 'test-site-key' }),
    );
    expect(submit.getAttribute('aria-disabled')).toBe('true');

    renderOptions.callback('verified-token');
    expect(submit.hasAttribute('aria-disabled')).toBe(false);
  });

  it('keeps submission blocked when enabled but no site key is available', async () => {
    mockGetSiteKey.mockReturnValue('');

    await decorate(buildBlock({ enableHCaptcha: 'true' }));

    const submit = document.querySelector<HTMLButtonElement>('.newsletter-submit')!;
    expect(submit.getAttribute('aria-disabled')).toBe('true');
    expect(document.querySelector('.newsletter-message')?.textContent).toBe(
      'CAPTCHA is unavailable. Please try again later.',
    );
    expect(document.querySelector('.newsletter-captcha')?.childElementCount).toBe(0);
  });
});
