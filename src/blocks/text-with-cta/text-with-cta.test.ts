import type { HCaptchaApi, HCaptchaRenderOptions } from '@/types/hcaptcha.js';
import { getHCaptchaSiteKey, isUniversalEditor } from '@/utils/env.js';
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
  isUniversalEditor: jest.fn(() => false),
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

function buildBlock(
  enableHCaptcha?: string,
  propertyPath = '/content/dam/property-mapping',
  infoText = 'Submission in non-English is not supported',
  legacyInfoText?: string,
): HTMLElement {
  const block = document.createElement('div');
  block.className = 'text-with-cta';

  const contentRows = ['block-anchor', 'text-with-cta-test', 'Join Capella', 'Stay in the know'].map(
    (text) => `<div><div>${text}</div></div>`,
  );
  if (legacyInfoText !== undefined) contentRows.push(`<div><div>${legacyInfoText}</div></div>`);
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
  } else {
    fields.push('', '', '');
  }
  fields.push(infoText);

  const itemRow = `<div data-aue-model="text-with-cta-signup-form">${fields
    .map((text, index) => `<div${index === 13 ? ' data-aue-prop="infoText"' : ''}>${text}</div>`)
    .join('')}</div>`;
  block.innerHTML = [...contentRows, itemRow].join('');
  document.body.append(block);
  return block;
}

/** Expands the form if needed so the lazily loaded country list is in place. */
async function fillRequiredFields(form: HTMLFormElement): Promise<void> {
  if (form.hidden)
    form.closest('.text-with-cta-signup')!.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
  const country = form.querySelector<HTMLSelectElement>('select[name="country"]')!;
  for (let i = 0; i < 20 && country.options.length < 2; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  form.querySelector<HTMLSelectElement>('select[name="salutation"]')!.value = 'Mr';
  form.querySelector<HTMLInputElement>('input[name="firstName"]')!.value = 'Alex';
  form.querySelector<HTMLInputElement>('input[name="lastName"]')!.value = 'Morgan';
  country.value = 'Singapore';
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
    jest.mocked(isUniversalEditor).mockReturnValue(false);
    mockResolveProperty.mockResolvedValue('CHR');
    mockSubmitNewsletterForm.mockResolvedValue('success');
  });

  it.each(['success', 'request-failed'] as const)('disables submit until a %s response', async (result) => {
    let finish!: (value: typeof result) => void;
    mockSubmitNewsletterForm.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const block = buildBlock('false');
    decorate(block);
    const form = block.querySelector<HTMLFormElement>('form')!;
    await fillRequiredFields(form);
    await dispatchSubmit(form);
    expect(form.querySelector('[role="status"]')?.textContent).toBe('');
    expect(form.querySelector('[type="submit"]')?.getAttribute('aria-busy')).toBe('true');
    expect(form.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(true);
    finish(result);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(form.querySelector('[type="submit"]')?.hasAttribute('aria-busy')).toBe(false);
    expect(form.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(false);
  });

  it('keeps submit disabled if CAPTCHA resolves again during submission', async () => {
    let options!: HCaptchaRenderOptions;
    const api: HCaptchaApi = {
      render: jest.fn((_container, callbacks) => {
        options = callbacks;
        return 'widget';
      }),
      reset: jest.fn(),
    };
    mockGetSiteKey.mockReturnValue('public-site-key');
    mockLoadHCaptcha.mockResolvedValue(api);
    let finish!: (value: 'success') => void;
    mockSubmitNewsletterForm.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const block = buildBlock('true');
    decorate(block);
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
    const form = block.querySelector<HTMLFormElement>('form')!;
    form.querySelector<HTMLInputElement>('[name="consent"]')!.click();
    await Promise.resolve();
    options.callback('token');
    await fillRequiredFields(form);
    await dispatchSubmit(form);
    options.callback('another-token');
    expect(form.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(true);
    await dispatchSubmit(form);
    expect(mockSubmitNewsletterForm).toHaveBeenCalledTimes(1);
    finish('success');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it.each(['click', 'change'])('renders CAPTCHA only on consent %s after preloading on typing', async (eventType) => {
    const api: HCaptchaApi = { render: jest.fn(() => 'widget'), reset: jest.fn() };
    mockGetSiteKey.mockReturnValue('public-site-key');
    mockLoadHCaptcha.mockResolvedValue(api);
    const block = buildBlock('true');
    decorate(block);
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
    block.querySelector<HTMLInputElement>('[name="email"]')!.focus();
    expect(mockLoadHCaptcha).not.toHaveBeenCalled();

    const consent = block.querySelector<HTMLInputElement>('[name="consent"]')!;
    consent.focus();
    expect(mockLoadHCaptcha).not.toHaveBeenCalled();
    block.querySelector('[name="email"]')!.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    expect(mockLoadHCaptcha).toHaveBeenCalledTimes(1);
    expect(api.render).not.toHaveBeenCalled();
    consent.dispatchEvent(new Event(eventType));
    await Promise.resolve();
    consent.dispatchEvent(new Event(eventType));
    expect(mockLoadHCaptcha).toHaveBeenCalledTimes(2);
    expect(api.render).toHaveBeenCalledTimes(1);
  });

  it('does not initialize CAPTCHA just because UE expands the form', () => {
    jest.mocked(isUniversalEditor).mockReturnValue(true);
    decorate(buildBlock('true'));
    expect(document.querySelector<HTMLFormElement>('.text-with-cta-form')?.hidden).toBe(false);
    expect(mockLoadHCaptcha).not.toHaveBeenCalled();
  });

  it('renders authored info text above the sign-up fields and preserves its editor instrumentation', () => {
    const block = buildBlock();

    decorate(block);

    expect(block.querySelector('.text-with-cta-title')?.textContent).toBe('Join Capella');
    expect(block.querySelector('.text-with-cta-info-text')).toBeNull();
    const infoText = block.querySelector('.text-with-cta-form-info-text');
    expect(infoText?.textContent).toBe('Submission in non-English is not supported');
    expect(infoText?.getAttribute('data-aue-prop')).toBe('infoText');
    expect(infoText?.parentElement?.classList.contains('text-with-cta-form-fields')).toBe(true);
    expect(infoText?.nextElementSibling?.classList.contains('text-with-cta-form-row')).toBe(true);
    expect(block.querySelector('.text-with-cta-description')?.textContent).toBe('Stay in the know');
  });

  it('omits the info text element when the field is blank', () => {
    const block = buildBlock(undefined, undefined, '');

    decorate(block);

    expect(block.querySelector('.text-with-cta-form-info-text')).toBeNull();
    expect(block.querySelector('.text-with-cta-info-text')).toBeNull();
    expect(block.querySelector('.text-with-cta-heading')).toBeNull();
    expect(block.querySelector('.text-with-cta-title')?.textContent).toBe('Join Capella');
  });

  it('moves legacy block-level info text into the sign-up form', () => {
    const block = buildBlock(undefined, undefined, '', 'Legacy signup note');

    decorate(block);

    expect(block.querySelector('.text-with-cta-form-info-text')?.textContent).toBe('Legacy signup note');
    expect(block.querySelector('.text-with-cta-description')?.textContent).toBe('Stay in the know');
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

    await fillRequiredFields(form);
    await dispatchSubmit(form);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('');
    expect(block.querySelector<HTMLDialogElement>('.text-with-cta-modal')?.hasAttribute('open')).toBe(true);
    expect(block.querySelector('.text-with-cta-modal-message')?.textContent).toBe('Thanks for subscribing.');
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
    expect(mockLoadHCaptcha).not.toHaveBeenCalled();
    block.querySelector<HTMLInputElement>('input[name="consent"]')!.click();
    await Promise.resolve();

    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    const submit = form.querySelector<HTMLButtonElement>('.text-with-cta-submit')!;
    expect(form.querySelector('.text-with-cta-captcha')).not.toBeNull();
    expect(api.render).toHaveBeenCalledWith(
      form.querySelector('.text-with-cta-captcha'),
      expect.objectContaining({ sitekey: 'public-site-key' }),
    );
    expect(submit.disabled).toBe(true);

    await fillRequiredFields(form);
    dispatchSubmit(form);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Please complete the CAPTCHA verification.');

    renderOptions.callback('verified-token');
    expect(submit.disabled).toBe(false);
    await dispatchSubmit(form);

    expect(block.querySelector('.text-with-cta-modal')?.hasAttribute('open')).toBe(true);
    expect(mockSubmitNewsletterForm).toHaveBeenCalledWith(
      form,
      expect.objectContaining({
        property: 'CHR',
        captchaEnabled: true,
        captchaToken: 'verified-token',
      }),
    );
    expect(api.reset).toHaveBeenCalledWith('captcha-widget');
    expect(submit.disabled).toBe(false);
    const captcha = form.querySelector<HTMLElement>('.text-with-cta-captcha')!;
    expect(captcha.hidden).toBe(true);
    form.querySelector<HTMLInputElement>('[name="email"]')!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(captcha.hidden).toBe(true);
    form.querySelector<HTMLInputElement>('[name="consent"]')!.click();
    expect(captcha.hidden).toBe(false);
    expect(api.render).toHaveBeenCalledTimes(1);
    expect(submit.disabled).toBe(false);
    await fillRequiredFields(form);
    await dispatchSubmit(form);
    expect(mockSubmitNewsletterForm).toHaveBeenCalledTimes(1);
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Please complete the CAPTCHA verification.');
  });

  it('fails closed when the site key is missing', () => {
    mockGetSiteKey.mockReturnValue('');
    const block = buildBlock('true');

    decorate(block);
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
    block.querySelector<HTMLInputElement>('input[name="consent"]')!.click();

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
    block.querySelector<HTMLInputElement>('input[name="consent"]')!.click();
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
    block.querySelector<HTMLInputElement>('input[name="consent"]')!.click();
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
    await fillRequiredFields(form);
    await dispatchSubmit(form);

    expect(mockResolveProperty).toHaveBeenCalledWith('/content/dam/property-mapping');
    expect(mockSubmitNewsletterForm).toHaveBeenCalledWith(
      form,
      expect.objectContaining({ property: 'CPMAC', captchaEnabled: false, captchaToken: '' }),
    );
    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe('Sorry, please try again.');
  });

  it('shows a retry message when country validation cannot load', async () => {
    mockSubmitNewsletterForm.mockResolvedValue('country-validation-unavailable');
    const block = buildBlock('false');

    decorate(block);
    const form = block.querySelector<HTMLFormElement>('.text-with-cta-form')!;
    block.querySelector<HTMLButtonElement>('.text-with-cta-trigger')!.click();
    await fillRequiredFields(form);
    await dispatchSubmit(form);

    expect(form.querySelector('.text-with-cta-status')?.textContent).toBe(
      'Country validation is unavailable. Please try again later.',
    );
  });
});

const TRAILING_CELLS = [
  'Select a salutation',
  'First name please',
  'Last name please',
  'Country please',
  'Email is required',
  'Email looks wrong',
  'Tick the box',
  'Mailing list',
  '<p>Thanks</p><p>a lot</p>',
  '<p>Welcome aboard.</p><p>See you soon.</p>',
  'Close',
];

/** Rewrites the legacy fixture row into the current model order (success message moved to its tab). */
function toCurrentLayout(block: HTMLElement, dropInfoText = false): void {
  const row = block.querySelector<HTMLElement>('[data-aue-model]')!;
  row.children[9].remove();
  if (dropInfoText) row.lastElementChild!.remove();
  row.removeAttribute('data-aue-model');
  TRAILING_CELLS.forEach((html) => {
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
  });
}

describe('text-with-cta validation', () => {
  beforeEach(() => {
    jest.mocked(isUniversalEditor).mockReturnValue(false);
    mockResolveProperty.mockResolvedValue('CHR');
    mockSubmitNewsletterForm.mockResolvedValue('success');
  });

  afterEach(() => {
    document.body.textContent = '';
    jest.clearAllMocks();
  });

  const errorOf = (form: HTMLFormElement, name: string): HTMLElement | null => {
    const control = form.querySelector(`[name="${name}"]`)!;
    const id = control.getAttribute('aria-describedby');
    return id ? form.querySelector(`#${id}`) : null;
  };

  it('flags every invalid field at once with the default messages', async () => {
    const block = buildBlock('false');
    decorate(block);
    const form = block.querySelector<HTMLFormElement>('form')!;

    await dispatchSubmit(form);

    expect(mockSubmitNewsletterForm).not.toHaveBeenCalled();
    const messages = ['salutation', 'firstName', 'lastName', 'country', 'email', 'consent'].map((name) => {
      expect(form.querySelector(`[name="${name}"]`)?.getAttribute('aria-invalid')).toBe('true');
      return errorOf(form, name)?.textContent;
    });
    expect(messages).toEqual([
      'Please select a title.',
      'Please enter your first name.',
      'Please enter your last name.',
      'Please select your country.',
      'Please enter a valid email address.',
      'Please accept the terms to continue.',
    ]);
    expect(document.activeElement).toBe(form.querySelector('[name="salutation"]'));
  });

  it.each([false, true])('uses authored messages (info text dropped: %s)', async (dropInfoText) => {
    const block = buildBlock('false');
    toCurrentLayout(block, dropInfoText);
    decorate(block);
    const form = block.querySelector<HTMLFormElement>('form')!;
    await fillRequiredFields(form);
    form.querySelector<HTMLInputElement>('[name="firstName"]')!.value = 'Alex2';
    form.querySelector<HTMLInputElement>('[name="email"]')!.value = 'alex@';

    await dispatchSubmit(form);

    expect(errorOf(form, 'firstName')?.textContent).toBe('First name please');
    expect(errorOf(form, 'email')?.textContent).toBe('Email looks wrong');
    expect(errorOf(form, 'lastName')).toBeNull();
    expect(block.querySelector('.text-with-cta-form-info-text') !== null).toBe(!dropInfoText);

    form.querySelector<HTMLInputElement>('[name="email"]')!.value = '';
    form.querySelector('[name="email"]')!.dispatchEvent(new Event('input'));
    expect(errorOf(form, 'email')?.textContent).toBe('Email is required');
  });

  it('loads the ISO 3166 country list into a select only once the form is opened', async () => {
    const block = buildBlock('false');
    decorate(block);
    const form = block.querySelector<HTMLFormElement>('form')!;
    const country = form.querySelector<HTMLSelectElement>('select[name="country"]')!;

    expect(country.options).toHaveLength(1);
    await fillRequiredFields(form);

    const names = [...country.options].slice(1).map((option) => option.value);
    expect(names).toHaveLength(250);
    expect(names).toContain('Singapore');
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    expect(country.value).toBe('Singapore');
  });

  it('clears an error as soon as the field becomes valid', async () => {
    const block = buildBlock('false');
    decorate(block);
    const form = block.querySelector<HTMLFormElement>('form')!;
    await dispatchSubmit(form);

    const lastName = form.querySelector<HTMLInputElement>('[name="lastName"]')!;
    lastName.value = "O'Neil-Smith";
    lastName.dispatchEvent(new Event('input'));

    expect(lastName.hasAttribute('aria-invalid')).toBe(false);
    expect(lastName.hasAttribute('aria-describedby')).toBe(false);
  });

  it('renders the authored success modal and exposes it for the backend', async () => {
    const block = buildBlock('true');
    toCurrentLayout(block);
    decorate(block);
    const form = block.querySelector<HTMLFormElement>('form')!;
    const dialog = block.querySelector<HTMLDialogElement>('.text-with-cta-modal')!;

    expect(dialog.hasAttribute('open')).toBe(false);
    expect(block.querySelector('.text-with-cta-modal-eyebrow')?.textContent).toBe('Mailing list');
    expect(block.querySelector('.text-with-cta-modal-title')?.innerHTML).toBe('Thanks<br>a lot');
    expect([...block.querySelectorAll('.text-with-cta-modal-message p')].map((p) => p.textContent)).toEqual([
      'Welcome aboard.',
      'See you soon.',
    ]);
    expect(block.querySelector('.text-with-cta-modal-done')?.textContent).toBe('Close');
    expect(block.querySelector('.text-with-cta-form-info-text')?.textContent).toBe(
      'Submission in non-English is not supported',
    );
    expect(form.querySelector('.text-with-cta-captcha')).not.toBeNull();

    expect(window.showNewsletterSuccessModal?.(form)).toBe(true);
    expect(dialog.hasAttribute('open')).toBe(true);
    block.querySelector<HTMLButtonElement>('.text-with-cta-modal-close')!.click();
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(window.showNewsletterSuccessModal?.('unknown-form')).toBe(false);
  });
});
