import type { HCaptchaApi, HCaptchaRenderOptions } from '@/types/hcaptcha.js';
import { getHCaptchaSiteKey } from '@/utils/env.js';
import { loadHCaptcha } from '@/utils/hcaptcha.js';
import { resolveNewsletterProperty, submitNewsletterForm } from '@/utils/newsletter-submission.js';
import decorate from './text-with-cta';

jest.mock(
  '@/app/scripts.js',
  () => ({
    moveInstrumentation: (source: HTMLElement, target: HTMLElement | null) => {
      [...source.attributes]
        .filter(({ name }) => name.startsWith('data-aue-'))
        .forEach(({ name, value }) => {
          target?.setAttribute(name, value);
          source.removeAttribute(name);
        });
    },
  }),
  { virtual: true },
);

jest.mock('@/utils/env.js', () => ({
  getHCaptchaSiteKey: jest.fn(),
  isUniversalEditor: () => false,
}));

jest.mock('@/utils/hcaptcha.js', () => ({
  loadHCaptcha: jest.fn(),
}));

jest.mock('@/utils/newsletter-submission.js', () => ({
  resolveNewsletterProperty: jest.fn(),
  submitNewsletterForm: jest.fn(),
}));

const mockGetSiteKey = jest.mocked(getHCaptchaSiteKey);
const mockLoadHCaptcha = jest.mocked(loadHCaptcha);
const mockResolveProperty = jest.mocked(resolveNewsletterProperty);
const mockSubmitNewsletterForm = jest.mocked(submitNewsletterForm);

function buildBlock(enableHCaptcha?: string, propertyPath = '/content/dam/property-mapping'): HTMLElement {
  const block = document.createElement('div');
  block.className = 'text-with-cta';

  const contentRows = ['block-anchor', 'text-with-cta-test', 'Join Capella', 'Stay in the know'].map(
    (text) => `<div><div>${text}</div></div>`,
  );
  const fields = [
    'Join now',
    'Title',
    'Mr, Mrs, Ms',
    'First name',
    'Last name',
    'Country',
    'Email',
    'I agree to receive updates.',
    'Sign up',
    'Thanks for subscribing.',
  ];
  if (enableHCaptcha !== undefined) {
    fields.push(enableHCaptcha, 'Sorry, please try again.', `<a href="${propertyPath}">${propertyPath}</a>`);
  }

  const itemRow = `<div data-aue-model="text-with-cta-signup-form">${fields
    .map((text) => `<div>${text}</div>`)
    .join('')}</div>`;
  block.innerHTML = [...contentRows, itemRow].join('');
  document.body.append(block);
  return block;
}

function fillRequiredFields(form: HTMLFormElement): void {
  form.querySelector<HTMLSelectElement>('select[name="salutation"]')!.value = 'Mr';
  form.querySelector<HTMLInputElement>('input[name="firstName"]')!.value = 'Alex';
  form.querySelector<HTMLInputElement>('input[name="lastName"]')!.value = 'Morgan';
  form.querySelector<HTMLInputElement>('input[name="country"]')!.value = 'Singapore';
  form.querySelector<HTMLInputElement>('input[name="email"]')!.value = 'alex@example.com';
  const consent = form.querySelector<HTMLInputElement>('input[name="consent"]')!;
  consent.checked = true;
}

async function dispatchSubmit(form: HTMLFormElement): Promise<void> {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('text-with-cta hCaptcha', () => {
  afterEach(() => {
    document.body.textContent = '';
    document.head.querySelector('meta[name="hcaptcha-site-key"]')?.remove();
    delete window.hcaptcha;
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockResolveProperty.mockResolvedValue('CHR');
    mockSubmitNewsletterForm.mockResolvedValue('success');
  });

  it.each([
    ['legacy content', undefined],
    ['toggle off', 'false'],
  ])('uses the shared submission path with CAPTCHA off for %s', async (_label, value) => {
    const block = buildBlock(value);

    decorate(block);

    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    const submit = form.querySelector<HTMLButtonElement>('.text-with-cta-submit')!;
    expect(form.querySelector('.text-with-cta-captcha')).toBeNull();
    expect(submit.disabled).toBe(false);
    expect(mockLoadHCaptcha).not.toHaveBeenCalled();

    fillRequiredFields(form);
    await dispatchSubmit(form);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Thanks for subscribing.');
    expect(mockSubmitNewsletterForm).toHaveBeenCalledWith(
      form,
      expect.objectContaining({ captchaEnabled: false, captchaToken: '' }),
    );
  });

  it('requires a solved CAPTCHA before showing success and resets it after submission', async () => {
    let renderOptions!: HCaptchaRenderOptions;
    const api: HCaptchaApi = {
      render: jest.fn((_container, options) => {
        renderOptions = options;
        return 'captcha-widget';
      }),
      reset: jest.fn(),
    };
    window.hcaptcha = api;
    mockGetSiteKey.mockReturnValue('public-site-key');
    mockLoadHCaptcha.mockResolvedValue(api);
    const block = buildBlock('true');

    decorate(block);
    const trigger = block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!;
    expect(mockLoadHCaptcha).not.toHaveBeenCalled();
    trigger.click();
    await Promise.resolve();

    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    const submit = form.querySelector<HTMLButtonElement>('.text-with-cta-submit')!;
    expect(form.querySelector('.text-with-cta-captcha')).not.toBeNull();
    expect(api.render).toHaveBeenCalledWith(
      form.querySelector('.text-with-cta-captcha'),
      expect.objectContaining({ sitekey: 'public-site-key' }),
    );
    expect(submit.disabled).toBe(true);

    fillRequiredFields(form);
    dispatchSubmit(form);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Please complete the CAPTCHA verification.');

    renderOptions.callback('verified-token');
    expect(submit.disabled).toBe(false);
    await dispatchSubmit(form);

    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Thanks for subscribing.');
    expect(mockSubmitNewsletterForm).toHaveBeenCalledWith(
      form,
      expect.objectContaining({
        property: 'CHR',
        captchaEnabled: true,
        captchaToken: 'verified-token',
      }),
    );
    expect(api.reset).toHaveBeenCalledWith('captcha-widget');
    expect(submit.disabled).toBe(true);
  });

  it('fails closed when the site key is missing', () => {
    mockGetSiteKey.mockReturnValue('');
    const block = buildBlock('true');

    decorate(block);
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();

    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    expect(form.querySelector<HTMLButtonElement>('.text-with-cta-submit')?.disabled).toBe(true);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe(
      'CAPTCHA is unavailable. Please try again later.',
    );
    expect(mockLoadHCaptcha).not.toHaveBeenCalled();
  });

  it('fails closed when the hCaptcha API cannot load', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetSiteKey.mockReturnValue('public-site-key');
    mockLoadHCaptcha.mockRejectedValue(new Error('network failure'));
    const block = buildBlock('true');

    decorate(block);
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    expect(form.querySelector<HTMLButtonElement>('.text-with-cta-submit')?.disabled).toBe(true);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe(
      'CAPTCHA is unavailable. Please try again later.',
    );
    consoleError.mockRestore();
  });

  it('requires a new CAPTCHA solve after the token expires', async () => {
    let renderOptions!: HCaptchaRenderOptions;
    const api: HCaptchaApi = {
      render: jest.fn((_container, options) => {
        renderOptions = options;
        return 'captcha-widget';
      }),
      reset: jest.fn(),
    };
    mockGetSiteKey.mockReturnValue('public-site-key');
    mockLoadHCaptcha.mockResolvedValue(api);
    const block = buildBlock('true');

    decorate(block);
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
    await Promise.resolve();
    renderOptions.callback('verified-token');
    renderOptions['expired-callback']();

    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    expect(form.querySelector<HTMLButtonElement>('.text-with-cta-submit')?.disabled).toBe(true);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Please complete the CAPTCHA verification.');
  });

  it('uses the authored property mapping and error message on API failure', async () => {
    mockResolveProperty.mockResolvedValue('CPMAC');
    mockSubmitNewsletterForm.mockResolvedValue('request-failed');
    const block = buildBlock('false', '/content/dam/property-mapping');

    decorate(block);
    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
    fillRequiredFields(form);
    await dispatchSubmit(form);

    expect(mockResolveProperty).toHaveBeenCalledWith('/content/dam/property-mapping');
    expect(mockSubmitNewsletterForm).toHaveBeenCalledWith(
      form,
      expect.objectContaining({ property: 'CPMAC', captchaEnabled: false, captchaToken: '' }),
    );
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Sorry, please try again.');
  });
});
