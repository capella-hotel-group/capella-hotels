import { getHCaptchaSiteKey as getEnvHCaptchaSiteKey } from '@/utils/env.js';
import { loadHCaptcha } from '@/utils/hcaptcha.js';
import { resolveNewsletterProperty, submitNewsletterForm } from '@/utils/newsletter-submission.js';

const CONSENT_REQUIRED_MESSAGE = 'Please accept the consent to continue.';
const DEFAULT_SALUTATION_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Mx', 'Dr'];

// Per-instance suffix so ids stay unique when several newsletter blocks share a page.
let instanceCount = 0;

// Authored row order — must match the field order in `_newsletter-form.json`.
// PROPERTY_OPTIONS is the only Content Fragment path; dropdown choices and
// other form labels are read from authored fields.
const ROW = {
  TITLE: 0,
  SALUTATION_LABEL: 1,
  SALUTATION_OPTIONS: 2,
  FIRST_NAME: 3,
  LAST_NAME: 4,
  EMAIL: 5,
  COUNTRY_LABEL: 6,
  COUNTRY_PLACEHOLDER: 7,
  CONSENT: 8,
  SUBMIT: 9,
  PROPERTY_OPTIONS: 10,
  TRIGGER_LABEL: 11,
  LAYOUT: 12,
  ENABLE_HCAPTCHA: 13,
};

function rowText(rows: Element[], index: number): string {
  return rows[index]?.querySelector(':scope > div')?.textContent?.trim() ?? '';
}

function rowPlainText(rows: Element[], index: number): string {
  const cell = rows[index]?.querySelector(':scope > div');
  if (!cell || cell.querySelector('a')) return '';
  const value = cell.textContent?.trim() ?? '';
  return value.startsWith('/content/') ? '' : value;
}

function rowHTML(rows: Element[], index: number): string {
  return rows[index]?.querySelector(':scope > div')?.innerHTML?.trim() ?? '';
}

function rowLink(rows: Element[], index: number): string {
  const cell = rows[index]?.querySelector(':scope > div');
  if (!cell) return '';
  const link = cell.querySelector('a');
  return (link?.getAttribute('href') || cell.textContent || '').trim();
}

function rowList(rows: Element[], index: number, fallback: string[] = []): string[] {
  const cell = rows[index]?.querySelector(':scope > div');
  if (!cell) return fallback;
  const items = [...cell.querySelectorAll('li')].map((item) => item.textContent?.trim() ?? '').filter(Boolean);
  if (items.length) return items;
  const authoredText = cell.textContent?.trim() ?? '';
  if (!authoredText || cell.querySelector('a') || authoredText.startsWith('/content/')) return fallback;
  const options = authoredText
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean);
  return options.length ? options : fallback;
}

/**
 * Resolves the public hCaptcha site key. Prefers the per-environment value from
 * `env.js` (the "environment variable" equivalent in EDS); falls back to the
 * `hcaptcha-site-key` <meta> tag when no environment key is configured.
 */
function getHCaptchaSiteKey(enabled: boolean): string {
  if (!enabled) return '';
  return (
    getEnvHCaptchaSiteKey() ||
    document.head.querySelector<HTMLMetaElement>('meta[name="hcaptcha-site-key"]')?.content?.trim() ||
    ''
  );
}

interface CaptchaController {
  getToken: () => string;
  reset: () => void;
}

/**
 * Renders an hCaptcha widget into `container` and reports solved/unsolved state
 * through `onChange` (rather than touching the submit button directly), so a
 * caller can combine it with other gating conditions (e.g. a consent
 * checkbox). Returns a getter for the current token (empty when unsolved). On
 * any failure `onChange(false)` is reported so an enabled CAPTCHA fails closed.
 */
async function setupCaptcha(
  container: HTMLElement,
  siteKey: string,
  onChange: (hasToken: boolean) => void,
): Promise<CaptchaController> {
  let token = '';
  let widgetId: string | undefined;
  try {
    const hcaptcha = await loadHCaptcha();
    widgetId = hcaptcha.render(container, {
      sitekey: siteKey,
      callback: (response) => {
        token = response;
        onChange(true);
      },
      'expired-callback': () => {
        token = '';
        onChange(false);
      },
      'error-callback': () => {
        token = '';
        onChange(false);
      },
    });
  } catch (error) {
    console.error('Newsletter captcha error:', error);
    onChange(false);
    return { getToken: () => '', reset: () => {} };
  }

  return {
    getToken: () => token,
    reset: () => {
      token = '';
      onChange(false);
      if (window.hcaptcha && widgetId !== undefined) window.hcaptcha.reset(widgetId);
    },
  };
}

/**
 * Combines consent-checkbox and hCaptcha gating into the submit button's
 * `aria-disabled` state (not `disabled`, so the button stays focusable).
 * `blockedBy()` reports which condition currently blocks submission.
 */
function createSubmitGate(
  submitBtn: HTMLButtonElement,
  { requireConsent, requireCaptcha }: { requireConsent: boolean; requireCaptcha: boolean },
): {
  setConsent: (ok: boolean) => void;
  setCaptcha: (ok: boolean) => void;
  blockedBy: () => 'consent' | 'captcha' | null;
} {
  let consentOk = !requireConsent;
  let captchaOk = !requireCaptcha;
  const blockedBy = () => {
    if (!consentOk) return 'consent';
    if (!captchaOk) return 'captcha';
    return null;
  };
  const recompute = () => {
    if (blockedBy()) submitBtn.setAttribute('aria-disabled', 'true');
    else submitBtn.removeAttribute('aria-disabled');
  };
  recompute();
  return {
    setConsent: (ok: boolean) => {
      consentOk = ok;
      recompute();
    },
    setCaptcha: (ok: boolean) => {
      captchaOk = ok;
      recompute();
    },
    blockedBy,
  };
}

/** Creates a labelled field wrapper containing the given input/select. */
function buildField(
  id: string,
  labelText: string,
  control: HTMLInputElement | HTMLSelectElement,
  { required = true } = {},
): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'newsletter-field';

  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = required ? `${labelText}*` : labelText;

  control.id = id;
  if (required) control.required = true;

  wrapper.append(label, control);
  return wrapper;
}

/** Builds a <select> from a list of { value, label } (or plain string) options. */
function buildSelect(name: string, placeholder: string, options: string[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.name = name;

  const blank = document.createElement('option');
  blank.value = '';
  blank.disabled = true;
  blank.selected = true;
  blank.textContent = placeholder;
  select.append(blank);

  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    select.append(option);
  });

  return select;
}

/** Builds a text/email input. */
function buildInput(name: string, type: string, placeholder?: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  if (placeholder) input.placeholder = placeholder;
  return input;
}

/**
 * Wraps a control for the `Inline` layout: no separate <label> (the control's
 * own placeholder text stands in for one, matching the underline-field design),
 * marked required, with an `aria-label` for assistive tech since the placeholder
 * disappears once a value is entered. Adds a chevron icon for `<select>`s,
 * whose native arrow is hidden in CSS.
 */
function buildInlineField(control: HTMLInputElement | HTMLSelectElement, label: string): HTMLDivElement {
  control.required = true;
  control.setAttribute('aria-label', label);

  const wrapper = document.createElement('div');
  wrapper.className = 'newsletter-inline-field';
  wrapper.append(control);

  if (control instanceof HTMLSelectElement) {
    wrapper.classList.add('newsletter-inline-field-select');
    const chevron = document.createElement('img');
    chevron.src = `${window.hlx.codeBasePath}/icons/arrow-down.svg`;
    chevron.alt = '';
    chevron.loading = 'lazy';
    chevron.className = 'newsletter-inline-chevron';
    wrapper.append(chevron);
  }

  return wrapper;
}

/** Groups a set of `Inline` fields into one responsive row. */
function buildInlineRow(fields: HTMLDivElement[]): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'newsletter-inline-row';
  row.append(...fields);
  return row;
}

/** Builds the `Inline` layout's required consent checkbox + notice. */
function buildInlineConsent(consentHTML: string, id: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'newsletter-inline-consent';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = id;
  checkbox.name = 'consent';
  checkbox.required = true;

  const label = document.createElement('label');
  label.setAttribute('for', checkbox.id);
  label.innerHTML =
    consentHTML ||
    'I would like to receive updates and offers from Capella Hotel Group via email or other electronic channels. <a href="/privacy">View our Privacy Policy</a>.';

  wrapper.append(checkbox, label);
  return wrapper;
}

/**
 * Wraps the form in an overlay modal and returns the overlay plus its trigger
 * button. A native <dialog>.showModal() is deliberately NOT used: a modal
 * dialog renders in the browser "top layer", which paints above every
 * normal-flow element regardless of z-index — including the hCaptcha challenge
 * iframe hCaptcha appends to <body>. That made the captcha appear *behind* the
 * form. A plain overlay keeps normal stacking so the challenge (max z-index)
 * shows above the form. Closing is wired to: the ✕ button, a backdrop click,
 * and the Escape key.
 */
function buildModal(
  form: HTMLFormElement,
  triggerLabel: string,
  title: string,
): { overlay: HTMLDivElement; trigger: HTMLButtonElement } {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'newsletter-trigger';
  trigger.textContent = triggerLabel;

  const overlay = document.createElement('div');
  overlay.className = 'newsletter-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);

  const panel = document.createElement('div');
  panel.className = 'newsletter-dialog-panel';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'newsletter-dialog-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';

  // The close button is absolutely positioned inside the panel, so it stays
  // pinned in the corner while the form scrolls.
  panel.append(closeBtn, form);
  overlay.append(panel);

  const open = () => {
    overlay.classList.add('is-open');
    document.body.classList.add('newsletter-modal-open');
    closeBtn.focus();
  };
  const close = () => {
    overlay.classList.remove('is-open');
    document.body.classList.remove('newsletter-modal-open');
    trigger.focus();
  };

  // Open the modal from the on-page trigger.
  trigger.addEventListener('click', open);

  // Close via the ✕ button.
  closeBtn.addEventListener('click', close);

  // Close when the backdrop (the overlay itself, outside the panel) is clicked.
  // Clicks inside the panel bubble to the overlay too, so compare the target.
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  // Close on Escape while the modal is open.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('is-open')) close();
  });

  return { overlay, trigger };
}

/** Writes the feedback message; `role` follows the kind so errors are announced assertively. */
function showMessage(message: HTMLElement, text: string, kind?: 'error' | 'success'): void {
  message.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  message.className = kind ? `newsletter-message is-${kind}` : 'newsletter-message';
  message.textContent = text;
}

function markInvalid(control: HTMLElement, message: HTMLElement): void {
  control.setAttribute('aria-invalid', 'true');
  control.setAttribute('aria-describedby', message.id);
  control.focus();
}

/** Flags every failing control, announces the error and focuses the first failing one. */
function flagInvalidFields(form: HTMLFormElement, message: HTMLElement): void {
  const invalid = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')].filter(
    (control) => !control.checkValidity(),
  );
  invalid.forEach((control) => control.setAttribute('aria-invalid', 'true'));
  showMessage(message, 'Please fill in all required fields.', 'error');
  if (invalid[0]) markInvalid(invalid[0], message);
  form.reportValidity();
}

interface SubmitConfig {
  property: string;
  captcha: CaptchaController | null;
  captchaEnabled: boolean;
}

async function submitForm(
  form: HTMLFormElement,
  config: SubmitConfig,
  message: HTMLElement,
  submitBtn: HTMLButtonElement,
): Promise<void> {
  showMessage(message, '');
  submitBtn.disabled = true;
  const result = await submitNewsletterForm(form, {
    property: config.property,
    captchaEnabled: config.captchaEnabled,
    captchaToken: config.captcha?.getToken() ?? '',
  });

  if (result === 'success') {
    form.reset();
    showMessage(message, 'Thank you for subscribing!', 'success');
    if (config.captcha) config.captcha.reset();
    submitBtn.disabled = false;
    return;
  }

  if (result === 'missing-fields') {
    flagInvalidFields(form, message);
  } else if (result === 'invalid-country') {
    showMessage(message, 'Enter a valid country name.', 'error');
    const countryInput = form.querySelector<HTMLInputElement>('[name="country"]');
    if (countryInput) markInvalid(countryInput, message);
  } else if (result === 'captcha-required') {
    showMessage(message, 'Please complete the captcha.', 'error');
  } else {
    showMessage(message, 'Sorry, something went wrong. Please try again.', 'error');
    if (config.captcha) config.captcha.reset();
  }
  submitBtn.disabled = false;
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const rows = [...block.children];
  instanceCount += 1;
  const uid = instanceCount;

  // ── Read authored labels / config (the dialog inputs) ────────────────────
  const cfg = {
    title: rowText(rows, ROW.TITLE) || 'Subscribe to our newsletter',
    salutationLabel: rowText(rows, ROW.SALUTATION_LABEL) || 'Salutation',
    salutationOptions: rowList(rows, ROW.SALUTATION_OPTIONS, DEFAULT_SALUTATION_OPTIONS),
    firstNameLabel: rowText(rows, ROW.FIRST_NAME) || 'First Name',
    lastNameLabel: rowText(rows, ROW.LAST_NAME) || 'Last Name',
    emailLabel: rowText(rows, ROW.EMAIL) || 'Email Address',
    countryLabel: rowText(rows, ROW.COUNTRY_LABEL) || 'Country',
    countryPlaceholder: rowPlainText(rows, ROW.COUNTRY_PLACEHOLDER) || rowText(rows, ROW.COUNTRY_LABEL) || 'Country',
    consentHTML: rowHTML(rows, ROW.CONSENT),
    submitLabel: rowText(rows, ROW.SUBMIT) || 'Continue',
    propertyPath: rowLink(rows, ROW.PROPERTY_OPTIONS),
    triggerLabel: rowText(rows, ROW.TRIGGER_LABEL) || 'Subscribe',
    layout: rowText(rows, ROW.LAYOUT) === 'Inline' ? 'Inline' : 'Modal',
    enableHCaptcha: rowText(rows, ROW.ENABLE_HCAPTCHA).toLowerCase() === 'true',
  };

  const property = await resolveNewsletterProperty(cfg.propertyPath);

  // ── Build the real <form> ────────────────────────────────────────────────
  const form = document.createElement('form');
  form.className = 'newsletter-form-element';
  form.noValidate = true;

  const title = document.createElement('h2');
  title.className = 'newsletter-title';
  title.textContent = cfg.title;

  // hCaptcha widget mount point. The submit button starts disabled whenever a
  // captcha is configured and/or (in `Inline`) consent is required, until the
  // combined gate below reports both conditions satisfied.
  const siteKey = getHCaptchaSiteKey(cfg.enableHCaptcha);
  const captchaWrapper = document.createElement('div');
  captchaWrapper.className = 'newsletter-captcha';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = cfg.submitLabel;

  const message = document.createElement('div');
  message.id = `newsletter-message-${uid}`;
  message.className = 'newsletter-message';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');

  let consentCheckbox: HTMLInputElement | null = null;
  const gate = createSubmitGate(submitBtn, {
    requireConsent: cfg.layout === 'Inline',
    requireCaptcha: cfg.enableHCaptcha,
  });

  if (cfg.layout === 'Inline') {
    submitBtn.className = 'newsletter-inline-submit';

    const salutation = buildInlineField(
      buildSelect('salutation', cfg.salutationLabel, cfg.salutationOptions),
      cfg.salutationLabel,
    );
    const firstName = buildInlineField(buildInput('firstName', 'text', cfg.firstNameLabel), cfg.firstNameLabel);
    const lastName = buildInlineField(buildInput('lastName', 'text', cfg.lastNameLabel), cfg.lastNameLabel);
    const country = buildInlineField(buildInput('country', 'text', cfg.countryPlaceholder), cfg.countryLabel);
    const email = buildInlineField(buildInput('email', 'email', cfg.emailLabel), cfg.emailLabel);

    const consent = buildInlineConsent(cfg.consentHTML, `newsletter-inline-consent-${uid}`);
    const checkbox = consent.querySelector('input[type="checkbox"]') as HTMLInputElement;
    consentCheckbox = checkbox;
    checkbox.addEventListener('change', () => gate.setConsent(checkbox.checked));

    form.append(
      title,
      buildInlineRow([salutation, firstName, lastName]),
      buildInlineRow([country, email]),
      consent,
      captchaWrapper,
      submitBtn,
      message,
    );
  } else {
    const salutation = buildField(
      'newsletter-salutation',
      cfg.salutationLabel,
      buildSelect('salutation', 'Select', cfg.salutationOptions),
    );

    const firstName = buildField(
      'newsletter-first-name',
      cfg.firstNameLabel,
      buildInput('firstName', 'text', cfg.firstNameLabel),
    );

    const lastName = buildField(
      'newsletter-last-name',
      cfg.lastNameLabel,
      buildInput('lastName', 'text', cfg.lastNameLabel),
    );

    const nameRow = document.createElement('div');
    nameRow.className = 'newsletter-name-row';
    nameRow.append(firstName, lastName);

    const email = buildField('newsletter-email', cfg.emailLabel, buildInput('email', 'email', cfg.emailLabel));

    const country = buildField(
      'newsletter-country',
      cfg.countryLabel,
      buildInput('country', 'text', cfg.countryPlaceholder),
    );

    // Consent notice — an informational line (no checkbox). By submitting the
    // form the visitor agrees to this statement.
    const consentWrapper = document.createElement('div');
    consentWrapper.className = 'newsletter-consent';
    consentWrapper.innerHTML =
      cfg.consentHTML ||
      'I would like to receive updates and offers from Capella Hotel Group via email or other electronic channels. <a href="/privacy">View our Privacy Policy</a>.';

    submitBtn.className = 'newsletter-submit';

    form.append(title, salutation, nameRow, email, country, consentWrapper, captchaWrapper, submitBtn, message);
  }

  // Render the captcha (if configured) and combine it with any consent gating.
  const captcha = siteKey ? await setupCaptcha(captchaWrapper, siteKey, (ok) => gate.setCaptcha(ok)) : null;
  if (cfg.enableHCaptcha && !siteKey) {
    showMessage(message, 'CAPTCHA is unavailable. Please try again later.', 'error');
  }

  // ── Wire up submission ───────────────────────────────────────────────────
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const blocked = gate.blockedBy();
    if (blocked === 'consent' && consentCheckbox) {
      showMessage(message, CONSENT_REQUIRED_MESSAGE, 'error');
      markInvalid(consentCheckbox, message);
      return;
    }
    if (blocked === 'captcha') {
      showMessage(
        message,
        siteKey ? 'Please complete the captcha.' : 'CAPTCHA is unavailable. Please try again later.',
        'error',
      );
      return;
    }
    if (!form.checkValidity()) {
      flagInvalidFields(form, message);
      return;
    }
    submitForm(form, { property, captcha, captchaEnabled: cfg.enableHCaptcha }, message, submitBtn);
  });

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    target.removeAttribute('aria-invalid');
    target.removeAttribute('aria-describedby');
  });

  if (cfg.layout === 'Inline') {
    // ── Replace authored rows with the form rendered directly in place ─────
    block.textContent = '';
    block.classList.add('newsletter-inline');
    block.append(form);
    return;
  }

  // ── Wrap the form in a modal, triggered by an on-page button ─────────────
  const { overlay, trigger } = buildModal(form, cfg.triggerLabel, cfg.title);

  // ── Replace authored rows with the trigger button + modal ────────────────
  block.textContent = '';
  block.append(trigger, overlay);
}
