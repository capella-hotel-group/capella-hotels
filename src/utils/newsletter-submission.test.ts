import { resolveNewsletterProperty, submitNewsletterForm } from './newsletter-submission';

jest.mock('@/app/scripts.js', () => ({ getPageLang: () => 'en-US' }));
jest.mock('@/utils/env.js', () => ({ getBasePathBasedOnEnv: () => 'https://example.test' }));

describe('submitNewsletterForm', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  function buildForm(country: string): HTMLFormElement {
    const form = document.createElement('form');
    [
      ['salutation', 'Ms'],
      ['firstName', 'Taylor'],
      ['lastName', 'Smith'],
      ['email', 'taylor@example.com'],
      ['country', country],
    ].forEach(([name, value]) => {
      const input = document.createElement('input');
      input.name = name!;
      input.value = value!;
      form.append(input);
    });
    return form;
  }

  it('removes the rendered .html suffix from property Content Fragment paths', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = fetchMock as unknown as typeof fetch;

    await resolveNewsletterProperty('/content/dam/capella-hotels/list-fragments/property-source-list.html');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/graphql/execute.json/capella-hotels/ListCF;path=/content/dam/capella-hotels/list-fragments/property-source-list',
      { headers: { Accept: 'application/json' } },
    );
  });

  it.each([
    [false, ''],
    [true, 'captcha-token'],
  ])('sends normalized fields and captchaEnabled=%s', async (captchaEnabled, captchaToken) => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await submitNewsletterForm(buildForm(' Singapore '), {
      property: 'CHR',
      captchaEnabled,
      captchaToken,
    });

    expect(result).toBe('success');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/content/servlet.newslettersubscription.json',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = new URLSearchParams(String(request.body));
    expect(payload.get('country')).toBe('SG');
    expect(payload.get('property')).toBe('CHR');
    expect(payload.get('language')).toBe('en');
    expect(payload.get('source')).toBe('Newsletter');
    expect(payload.get('captchaEnabled')).toBe(String(captchaEnabled));
    expect(payload.get('captchaValue')).toBe(captchaToken || null);
  });

  it('does not call the API when CAPTCHA is enabled without a token', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      submitNewsletterForm(buildForm('Singapore'), {
        property: 'CHR',
        captchaEnabled: true,
        captchaToken: '',
      }),
    ).resolves.toBe('captcha-required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the API when the country name is invalid', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      submitNewsletterForm(buildForm('Atlantis'), {
        property: 'CHR',
        captchaEnabled: false,
        captchaToken: '',
      }),
    ).resolves.toBe('invalid-country');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
