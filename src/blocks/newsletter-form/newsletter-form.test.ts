import type { HCaptchaApi, HCaptchaRenderOptions } from '@/types/hcaptcha.js';
import { getHCaptchaSiteKey } from '@/utils/env.js';
import decorate from './newsletter-form';

jest.mock('@/app/scripts.js', () => ({ getPageLang: () => 'en' }));

jest.mock('@/utils/env.js', () => ({
  getBasePathBasedOnEnv: () => 'https://example.test',
  getHCaptchaSiteKey: jest.fn(() => 'test-site-key'),
}));

const mockGetSiteKey = jest.mocked(getHCaptchaSiteKey);
const originalFetch = global.fetch;

function buildBlock({
  enableHCaptcha,
  layout = 'Modal',
  salutationValue = '<ul><li>Mr</li><li>Mrs</li><li>Ms</li></ul>',
  countryPlaceholder = '',
}: {
  enableHCaptcha?: string;
  layout?: string;
  salutationValue?: string;
  countryPlaceholder?: string;
} = {}): HTMLElement {
  const values = [
    'Newsletter',
    'Salutation',
    salutationValue,
    'First name',
    'Last name',
    'Email',
    'Country',
    countryPlaceholder,
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

function fillModalRequiredFields(country: string): HTMLFormElement {
  const form = document.querySelector<HTMLFormElement>('.newsletter-form-element')!;
  form.querySelector<HTMLSelectElement>('select[name="salutation"]')!.value = 'Mr';
  form.querySelector<HTMLInputElement>('input[name="firstName"]')!.value = 'Alex';
  form.querySelector<HTMLInputElement>('input[name="lastName"]')!.value = 'Morgan';
  form.querySelector<HTMLInputElement>('input[name="email"]')!.value = 'alex@example.com';
  form.querySelector<HTMLInputElement>('input[name="country"]')!.value = country;
  return form;
}

describe('newsletter-form hCaptcha toggle', () => {
  afterEach(() => {
    document.body.textContent = '';
    document.head.querySelector('meta[name="hcaptcha-site-key"]')?.remove();
    delete window.hcaptcha;
    global.fetch = originalFetch;
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
    expect(api.render).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>('.newsletter-trigger')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.render).toHaveBeenCalledWith(
      document.querySelector('.newsletter-captcha'),
      expect.objectContaining({ sitekey: 'test-site-key' }),
    );
    expect(submit.getAttribute('aria-disabled')).toBe('true');

    renderOptions.callback('verified-token');
    expect(submit.hasAttribute('aria-disabled')).toBe(false);
  });

  it('initializes inline CAPTCHA when the visible form approaches the viewport', async () => {
    Object.assign(window, { hlx: { codeBasePath: '' } });
    const originalObserver = window.IntersectionObserver;
    const observe = jest.fn();
    const disconnect = jest.fn();
    let notifyIntersection!: IntersectionObserverCallback;
    const observer = { observe, disconnect } as unknown as IntersectionObserver;
    const mockObserver = jest.fn((callback: IntersectionObserverCallback) => {
      notifyIntersection = callback;
      return observer;
    });
    window.IntersectionObserver = mockObserver as unknown as typeof IntersectionObserver;
    const api: HCaptchaApi = {
      render: jest.fn(() => 'inline-captcha'),
      reset: jest.fn(),
    };
    window.hcaptcha = api;
    mockGetSiteKey.mockReturnValue('test-site-key');

    try {
      await decorate(buildBlock({ layout: 'Inline', enableHCaptcha: 'true' }));
      const form = document.querySelector<HTMLFormElement>('.newsletter-form-element')!;
      expect(observe).toHaveBeenCalledWith(form);
      expect(api.render).not.toHaveBeenCalled();

      notifyIntersection([{ isIntersecting: false } as IntersectionObserverEntry], observer);
      expect(api.render).not.toHaveBeenCalled();

      notifyIntersection([{ isIntersecting: true } as IntersectionObserverEntry], observer);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(disconnect).toHaveBeenCalledTimes(1);
      expect(api.render).toHaveBeenCalledTimes(1);
      expect(api.render).toHaveBeenCalledWith(
        form.querySelector('.newsletter-captcha'),
        expect.objectContaining({ sitekey: 'test-site-key' }),
      );
      expect(form.querySelector('button')?.getAttribute('aria-disabled')).toBe('true');
    } finally {
      window.IntersectionObserver = originalObserver;
    }
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

  it.each(['Modal', 'Inline'])('uses repeatable salutation options in %s layout', async (layout) => {
    Object.assign(window, { hlx: { codeBasePath: '' } });
    await decorate(buildBlock({ layout }));

    const select = document.querySelector<HTMLSelectElement>('select[name="salutation"]')!;
    expect([...select.options].slice(1).map((option) => option.textContent)).toEqual(['Mr', 'Mrs', 'Ms']);
  });

  it('renders Country as a required text field in Modal layout', async () => {
    await decorate(buildBlock({ countryPlaceholder: 'Enter your country' }));

    const country = document.querySelector<HTMLInputElement>('input[name="country"]')!;
    expect(document.querySelector('select[name="country"]')).toBeNull();
    expect(country.type).toBe('text');
    expect(country.required).toBe(true);
    expect(country.placeholder).toBe('Enter your country');
  });

  it('keeps Country as a text input in Inline layout', async () => {
    Object.assign(window, { hlx: { codeBasePath: '' } });
    await decorate(buildBlock({ layout: 'Inline' }));

    expect(document.querySelector('select[name="country"]')).toBeNull();
    const country = document.querySelector<HTMLInputElement>('input[name="country"]')!;
    expect(country.type).toBe('text');
    expect(country.required).toBe(true);
  });

  it('converts a full country name to an ISO alpha-2 code before submission', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    await decorate(buildBlock());

    const form = fillModalRequiredFields('Singapore');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(request.body)).toContain('country=SG');
  });

  it.each(['false', 'true'])('sends captchaEnabled=%s to the API', async (enableHCaptcha) => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    mockGetSiteKey.mockReturnValue('test-site-key');

    let renderOptions: HCaptchaRenderOptions | undefined;
    if (enableHCaptcha === 'true') {
      const api: HCaptchaApi = {
        render: jest.fn((_container, options) => {
          renderOptions = options;
          return 'newsletter-captcha';
        }),
        reset: jest.fn(),
      };
      window.hcaptcha = api;
    }

    await decorate(buildBlock({ enableHCaptcha }));
    if (enableHCaptcha === 'true') {
      document.querySelector<HTMLButtonElement>('.newsletter-trigger')!.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    renderOptions?.callback('verified-token');

    const form = fillModalRequiredFields('Singapore');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = new URLSearchParams(String(request.body));
    expect(payload.get('captchaEnabled')).toBe(enableHCaptcha);
    expect(payload.get('captchaValue')).toBe(enableHCaptcha === 'true' ? 'verified-token' : null);
  });

  it('blocks submission for an unrecognized country name', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await decorate(buildBlock());

    const form = fillModalRequiredFields('Atlantis');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(form.querySelector('.newsletter-message')?.textContent).toBe('Enter a valid country name.');
    expect(form.querySelector('[name="country"]')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('falls back to standard salutations for legacy Content Fragment paths', async () => {
    await decorate(buildBlock({ salutationValue: '<a href="/content/dam/salutations">/content/dam/salutations</a>' }));

    const select = document.querySelector<HTMLSelectElement>('select[name="salutation"]')!;
    expect([...select.options].slice(1).map((option) => option.textContent)).toEqual(['Mr', 'Mrs', 'Ms', 'Mx', 'Dr']);
  });

  it('ignores a legacy country Content Fragment path as an input placeholder', async () => {
    await decorate(buildBlock({ countryPlaceholder: '<a href="/content/dam/countries">/content/dam/countries</a>' }));

    const country = document.querySelector<HTMLInputElement>('input[name="country"]')!;
    expect(country.placeholder).toBe('Country');
  });
});
