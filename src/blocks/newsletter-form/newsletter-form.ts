import { getHCaptchaSiteKey as getEnvHCaptchaSiteKey } from '@/utils/env.js';
import { loadHCaptcha } from '@/utils/hcaptcha.js';
import { loadCountryNames, resolveNewsletterProperty, submitNewsletterForm } from '@/utils/newsletter-submission.js';

const DEFAULT_SALUTATION_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Mx', 'Dr'];

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  INFO_TEXT: 14,
};

// Inline-only authored cells, appended after INFO_TEXT in this exact order (tab fields emit no cell).
const MESSAGE_KEYS = [
  'errorMessage',
  'salutationError',
  'firstNameError',
  'lastNameError',
  'countryError',
  'countryInvalidError',
  'emailRequiredError',
  'emailFormatError',
  'consentError',
  'captchaRequiredError',
  'captchaUnavailableError',
  'countryValidationUnavailableError',
] as const;
const SUCCESS_KEYS = ['successEyebrow', 'successHeading', 'successMessage', 'successButtonLabel'] as const;
const TRAILING_KEYS = [...MESSAGE_KEYS, ...SUCCESS_KEYS] as const;

type MessageKey = (typeof MESSAGE_KEYS)[number];
type SuccessKey = (typeof SUCCESS_KEYS)[number];

const MESSAGE_DEFAULTS: Record<MessageKey, string> = {
  salutationError: 'Please select a title.',
  firstNameError: 'Please enter your first name.',
  lastNameError: 'Please enter your last name.',
  countryError: 'Please select your country.',
  countryInvalidError: 'Enter a valid country name.',
  emailRequiredError: 'Please enter a valid email address.',
  emailFormatError: 'Please enter a valid email address.',
  consentError: 'Please accept the terms to continue.',
  errorMessage: 'Sorry, something went wrong. Please try again.',
  captchaRequiredError: 'Please complete the CAPTCHA verification.',
  captchaUnavailableError: 'CAPTCHA is unavailable. Please try again later.',
  countryValidationUnavailableError: 'Country validation is unavailable. Please try again later.',
};

// With all trailing cells present the row count is INFO_TEXT + 16 (blank infoText dropped) or one more (filled).
const ROWS_WITHOUT_INFO_TEXT = ROW.INFO_TEXT + TRAILING_KEYS.length;

const DEFAULT_SUCCESS_EYEBROW = 'Newsletter';
const DEFAULT_SUCCESS_HEADING = ['Thank you', 'for subscribing'];
const DEFAULT_SUCCESS_MESSAGE =
  'You have successfully joined our mailing list. Look out for the latest news and exclusive offers from Capella.';
const DEFAULT_SUCCESS_BUTTON_LABEL = 'Done';

/** Splits a richtext cell into lines on paragraphs and `<br>`, whether or not it is wrapped in `<p>`. */
function linesOf(cell?: Element | null): string[] {
  if (!cell) return [];
  const paragraphs = cell.querySelector('p') ? [...cell.querySelectorAll('p')] : [cell];
  return paragraphs.flatMap((paragraph) => {
    const lines = [''];
    paragraph.childNodes.forEach((child) => {
      if (child.nodeName === 'BR') lines.push('');
      else lines[lines.length - 1] += child.textContent || '';
    });
    return lines.map((line) => line.trim()).filter(Boolean);
  });
}

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

/**
 * Reads the trailing cells from the end of the row list: a blank optional `infoText`
 * drops its cell, so fixed offsets from the start would shift. Legacy content has none.
 */
function readTrailingFields(rows: Element[]): Partial<Record<MessageKey | SuccessKey, Element>> {
  const fields: Partial<Record<MessageKey | SuccessKey, Element>> = {};
  if (rows.length < ROWS_WITHOUT_INFO_TEXT) return fields;
  const trailing = rows.slice(-TRAILING_KEYS.length);
  TRAILING_KEYS.forEach((key, index) => {
    const row = trailing[index];
    const cell = row?.querySelector(':scope > div') ?? row;
    if (cell) fields[key] = cell;
  });
  return fields;
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
    onChange(false);
    throw error;
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
 * Mirrors the hCaptcha state into the submit button's `aria-disabled` (not
 * `disabled`, so the button stays focusable). Consent is validated on submit
 * so its error can show inline instead of silently blocking the button.
 */
function createSubmitGate(
  submitBtn: HTMLButtonElement,
  { requireCaptcha }: { requireCaptcha: boolean },
): {
  setCaptcha: (ok: boolean) => void;
  blockedBy: () => 'captcha' | null;
} {
  let captchaOk = !requireCaptcha;
  const blockedBy = () => (captchaOk ? null : 'captcha');
  const recompute = () => {
    if (blockedBy()) submitBtn.setAttribute('aria-disabled', 'true');
    else submitBtn.removeAttribute('aria-disabled');
  };
  recompute();
  return {
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

  appendOptions(select, options);

  return select;
}

function appendOptions(select: HTMLSelectElement, options: string[]): void {
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    select.append(option);
  });
}

/** Builds a text/email input. */
function buildInput(name: string, type: string, placeholder?: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  if (placeholder) input.placeholder = placeholder;
  return input;
}

type FormControl = HTMLInputElement | HTMLSelectElement;

/** An `Inline` field: `group` is what goes into the row; `control` and `error` drive validation. */
interface InlineFieldBuild {
  group: HTMLDivElement;
  control: FormControl;
  error: HTMLParagraphElement;
}

interface InlineRule {
  control: FormControl;
  error: HTMLElement;
  validate: (value: string) => string;
}

/** Per-field error line; the control references it via `aria-describedby`. */
function buildInlineError(controlId: string): HTMLParagraphElement {
  const error = document.createElement('p');
  error.className = 'newsletter-inline-field-error';
  error.id = `${controlId}-error`;
  error.hidden = true;
  return error;
}

/** Shows or clears a field's error and keeps `aria-invalid` / `aria-describedby` in sync. */
function setFieldError(control: HTMLElement, error: HTMLElement, text: string): void {
  error.textContent = text;
  error.hidden = !text;
  if (text) {
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', error.id);
  } else {
    control.removeAttribute('aria-invalid');
    control.removeAttribute('aria-describedby');
  }
}

function runInlineRule({ control, error, validate }: InlineRule): boolean {
  const text = validate(control.value.trim());
  setFieldError(control, error, text);
  return !text;
}

/**
 * Wraps a control for the `Inline` layout: no separate <label> (the control's
 * own placeholder text stands in for one, matching the underline-field design),
 * marked required, with an `aria-label` for assistive tech since the placeholder
 * disappears once a value is entered. Adds a chevron icon for `<select>`s,
 * whose native arrow is hidden in CSS. The error line sits under the field.
 */
function buildInlineField(control: FormControl, label: string, id: string): InlineFieldBuild {
  control.id = id;
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

  const error = buildInlineError(id);
  const group = document.createElement('div');
  group.className = 'newsletter-inline-field-group';
  group.append(wrapper, error);
  return { group, control, error };
}

/** Groups a set of `Inline` fields into one responsive row. */
function buildInlineRow(fields: HTMLElement[]): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'newsletter-inline-row';
  row.append(...fields);
  return row;
}

/** Builds the `Inline` layout's consent checkbox + notice, with its error line below. */
function buildInlineConsent(consentHTML: string, id: string): InlineFieldBuild & { control: HTMLInputElement } {
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

  const error = buildInlineError(id);
  const group = document.createElement('div');
  group.className = 'newsletter-inline-field-group';
  group.append(wrapper, error);
  return { group, control: checkbox, error };
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

interface SuccessModalContent {
  eyebrow: string;
  heading: string[];
  message: string[];
  buttonLabel: string;
}

/** Native <dialog> gives the focus trap, Escape handling and focus restore for free. */
function buildSuccessModal(content: SuccessModalContent, id: string): { dialog: HTMLDialogElement; open: () => void } {
  const dialog = document.createElement('dialog');
  dialog.className = 'newsletter-modal';
  const headingId = `${id}-heading`;
  const messageId = `${id}-message`;
  dialog.setAttribute('aria-labelledby', headingId);
  dialog.setAttribute('aria-describedby', messageId);
  dialog.setAttribute('data-testid', 'newsletter-form-success-modal');

  const panel = document.createElement('div');
  panel.className = 'newsletter-modal-content';
  const copy = document.createElement('div');
  copy.className = 'newsletter-modal-copy';
  const titleBlock = document.createElement('div');
  titleBlock.className = 'newsletter-modal-title-block';

  if (content.eyebrow) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'newsletter-modal-eyebrow';
    eyebrow.textContent = content.eyebrow;
    titleBlock.append(eyebrow);
  }

  const heading = document.createElement('h2');
  heading.className = 'newsletter-modal-title';
  heading.id = headingId;
  content.heading.forEach((line, index) => {
    if (index) heading.append(document.createElement('br'));
    heading.append(line);
  });
  titleBlock.append(heading);

  const messageBlock = document.createElement('div');
  messageBlock.className = 'newsletter-modal-message';
  messageBlock.id = messageId;
  content.message.forEach((line) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = line;
    messageBlock.append(paragraph);
  });
  copy.append(titleBlock, messageBlock);

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'newsletter-modal-done';
  done.textContent = content.buttonLabel;
  done.setAttribute('data-testid', 'newsletter-form-success-done');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'newsletter-modal-close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.setAttribute('data-testid', 'newsletter-form-success-close');

  panel.append(copy, done, closeButton);
  dialog.append(panel);

  const close = (): void => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };
  const open = (): void => {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    done.focus();
  };

  done.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  // The content panel fills the dialog, so a click landing on the dialog itself is on the backdrop.
  // Requiring the press to start there too keeps a text-selection drag that ends outside from closing it.
  let pressedOnBackdrop = false;
  dialog.addEventListener('mousedown', (event) => {
    pressedOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && pressedOnBackdrop) close();
    pressedOnBackdrop = false;
  });

  return { dialog, open };
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

/** Inline-only behaviour of `submitForm`: authored messages and per-field error handling. */
interface InlineSubmitHandlers {
  messages: Record<MessageKey, string>;
  /** Reruns every rule, showing all errors; returns true when the form is valid. */
  revalidate: () => boolean;
  flagCountryInvalid: () => void;
  reset: () => void;
  /** Opens the thank-you modal in place of the success status line. */
  openSuccess: () => void;
}

interface SubmitConfig {
  property: string;
  captcha: CaptchaController | null;
  captchaEnabled: boolean;
  inline?: InlineSubmitHandlers;
}

async function submitForm(
  form: HTMLFormElement,
  config: SubmitConfig,
  message: HTMLElement,
  submitBtn: HTMLButtonElement,
): Promise<void> {
  showMessage(message, '');
  submitBtn.disabled = true;
  submitBtn.setAttribute('aria-busy', 'true');
  const result = await submitNewsletterForm(form, {
    property: config.property,
    captchaEnabled: config.captchaEnabled,
    captchaToken: config.captcha?.getToken() ?? '',
  });
  submitBtn.removeAttribute('aria-busy');

  if (result === 'success') {
    form.reset();
    config.inline?.reset();
    if (config.captcha) config.captcha.reset();
    const captchaContainer = form.querySelector<HTMLElement>('.newsletter-captcha');
    if (captchaContainer) captchaContainer.hidden = true;
    submitBtn.disabled = false;
    if (config.inline) config.inline.openSuccess();
    else showMessage(message, 'Thank you for subscribing!', 'success');
    return;
  }

  const { inline } = config;
  if (result === 'missing-fields') {
    if (!inline) flagInvalidFields(form, message);
    // The rules already passed, so a still-valid form means the API helper saw something the rules did not.
    else if (inline.revalidate()) showMessage(message, inline.messages.errorMessage, 'error');
  } else if (result === 'invalid-country') {
    if (inline) {
      inline.flagCountryInvalid();
    } else {
      showMessage(message, 'Enter a valid country name.', 'error');
      const countryInput = form.querySelector<HTMLInputElement>('[name="country"]');
      if (countryInput) markInvalid(countryInput, message);
    }
  } else if (result === 'country-validation-unavailable') {
    showMessage(
      message,
      inline?.messages.countryValidationUnavailableError ??
        'Country validation is unavailable. Please try again later.',
      'error',
    );
  } else if (result === 'captcha-required') {
    showMessage(message, inline?.messages.captchaRequiredError ?? 'Please complete the captcha.', 'error');
  } else {
    showMessage(message, inline?.messages.errorMessage ?? 'Sorry, something went wrong. Please try again.', 'error');
    if (config.captcha) config.captcha.reset();
  }
  submitBtn.disabled = false;
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const rows = [...block.children];
  instanceCount += 1;
  const uid = instanceCount;

  // ── Read authored labels / config (the dialog inputs) ────────────────────
  const trailing = readTrailingFields(rows);
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
    infoText: rows.length === ROWS_WITHOUT_INFO_TEXT ? '' : rowText(rows, ROW.INFO_TEXT),
    messages: Object.fromEntries(
      MESSAGE_KEYS.map((key) => [key, trailing[key]?.textContent?.trim() || MESSAGE_DEFAULTS[key]]),
    ) as Record<MessageKey, string>,
    success: {
      eyebrow: trailing.successEyebrow?.textContent?.trim() || DEFAULT_SUCCESS_EYEBROW,
      heading: linesOf(trailing.successHeading),
      message: linesOf(trailing.successMessage),
      buttonLabel: trailing.successButtonLabel?.textContent?.trim() || DEFAULT_SUCCESS_BUTTON_LABEL,
    },
  };

  const property = await resolveNewsletterProperty(cfg.propertyPath);

  // ── Build the real <form> ────────────────────────────────────────────────
  const form = document.createElement('form');
  form.className = 'newsletter-form-element';
  form.noValidate = true;

  const title = document.createElement('h2');
  title.className = 'newsletter-title';
  title.textContent = cfg.title;

  let titleContent: HTMLElement = title;
  if (cfg.infoText) {
    const titleInfo = document.createElement('div');
    titleInfo.className = 'newsletter-title-info';

    const infoText = document.createElement('div');
    infoText.className = 'newsletter-info-text';
    infoText.textContent = cfg.infoText;

    titleInfo.append(title, infoText);
    titleContent = titleInfo;
  }

  // hCaptcha widget mount point. The submit button starts aria-disabled while a
  // captcha is configured, until the gate below reports it solved.
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
  const gate = createSubmitGate(submitBtn, { requireCaptcha: cfg.enableHCaptcha });

  // Inline-only validation state; the rules are filled in by the Inline branch below.
  let inlineRules: InlineRule[] = [];
  let inlineCountry: InlineRule | null = null;
  let validationAttempted = false;

  if (cfg.layout === 'Inline') {
    submitBtn.className = 'newsletter-inline-submit';
    form.setAttribute('data-testid', 'newsletter-form');
    submitBtn.setAttribute('data-testid', 'newsletter-form-submit');
    const { messages } = cfg;
    const fieldId = (name: string): string => `newsletter-inline-${uid}-${name}`;

    const salutation = buildInlineField(
      buildSelect('salutation', cfg.salutationLabel, cfg.salutationOptions),
      cfg.salutationLabel,
      fieldId('salutation'),
    );
    const firstName = buildInlineField(
      buildInput('firstName', 'text', cfg.firstNameLabel),
      cfg.firstNameLabel,
      fieldId('first-name'),
    );
    const lastName = buildInlineField(
      buildInput('lastName', 'text', cfg.lastNameLabel),
      cfg.lastNameLabel,
      fieldId('last-name'),
    );
    const countrySelect = buildSelect('country', cfg.countryPlaceholder, []);
    countrySelect.autocomplete = 'country-name';
    const country = buildInlineField(countrySelect, cfg.countryLabel, fieldId('country'));
    loadCountryNames()
      .then((names) => appendOptions(countrySelect, names))
      .catch((error: unknown) => console.error('Newsletter country list error:', error));
    const email = buildInlineField(buildInput('email', 'email', cfg.emailLabel), cfg.emailLabel, fieldId('email'));
    const consent = buildInlineConsent(cfg.consentHTML, `newsletter-inline-consent-${uid}`);
    consentCheckbox = consent.control;

    const nameRule = (text: string) => (value: string) => (NAME_PATTERN.test(value) ? '' : text);
    inlineCountry = {
      control: country.control,
      error: country.error,
      validate: (value) => (value ? '' : messages.countryError),
    };
    inlineRules = [
      {
        control: salutation.control,
        error: salutation.error,
        validate: (value) => (value ? '' : messages.salutationError),
      },
      { control: firstName.control, error: firstName.error, validate: nameRule(messages.firstNameError) },
      { control: lastName.control, error: lastName.error, validate: nameRule(messages.lastNameError) },
      inlineCountry,
      {
        control: email.control,
        error: email.error,
        validate: (value) => {
          if (!value) return messages.emailRequiredError;
          return EMAIL_PATTERN.test(value) ? '' : messages.emailFormatError;
        },
      },
      {
        control: consent.control,
        error: consent.error,
        validate: () => (consent.control.checked ? '' : messages.consentError),
      },
    ];
    // After the first submit attempt each field re-validates as it changes.
    inlineRules.forEach((rule) => {
      const revalidate = (): void => {
        if (validationAttempted) runInlineRule(rule);
      };
      rule.control.addEventListener('input', revalidate);
      rule.control.addEventListener('change', revalidate);
    });

    form.append(
      titleContent,
      buildInlineRow([salutation.group, firstName.group, lastName.group]),
      buildInlineRow([country.group, email.group]),
      consent.group,
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

    form.append(titleContent, salutation, nameRow, email, country, consentWrapper, captchaWrapper, submitBtn, message);
  }

  let captcha: CaptchaController | null = null;
  let captchaLoading = false;
  let captchaPreloaded = false;
  const captchaUnavailableText =
    cfg.layout === 'Inline' ? cfg.messages.captchaUnavailableError : 'CAPTCHA is unavailable. Please try again later.';
  const preloadCaptcha = (): void => {
    if (!siteKey || captchaPreloaded) return;
    captchaPreloaded = true;
    void loadHCaptcha().catch((error: unknown) => {
      captchaPreloaded = false;
      console.error('Newsletter captcha error:', error);
      showMessage(message, captchaUnavailableText, 'error');
    });
  };
  const initializeCaptcha = (): void => {
    if (!siteKey) return;
    captchaWrapper.hidden = false;
    if (captcha || captchaLoading) return;
    captchaLoading = true;
    void setupCaptcha(captchaWrapper, siteKey, (ok) => gate.setCaptcha(ok))
      .then((controller) => {
        captcha = controller;
      })
      .catch((error: unknown) => {
        console.error('Newsletter captcha error:', error);
        showMessage(message, captchaUnavailableText, 'error');
      })
      .finally(() => {
        captchaLoading = false;
      });
  };
  if (cfg.enableHCaptcha && !siteKey) {
    showMessage(message, captchaUnavailableText, 'error');
  }

  // ── Wire up submission ───────────────────────────────────────────────────
  const validateInline = (): boolean => {
    const invalid = inlineRules.filter((rule) => !runInlineRule(rule));
    invalid[0]?.control.focus();
    return !invalid.length;
  };
  const successModal =
    cfg.layout === 'Inline'
      ? buildSuccessModal(
          {
            ...cfg.success,
            heading: cfg.success.heading.length ? cfg.success.heading : DEFAULT_SUCCESS_HEADING,
            message: cfg.success.message.length ? cfg.success.message : [DEFAULT_SUCCESS_MESSAGE],
          },
          `newsletter-inline-${uid}-success`,
        )
      : null;
  // Native dialogs restore focus themselves, but the submit button was disabled while the request ran.
  successModal?.dialog.addEventListener('close', () => submitBtn.focus());
  const inlineHandlers: InlineSubmitHandlers = {
    messages: cfg.messages,
    openSuccess: () => successModal?.open(),
    revalidate: validateInline,
    flagCountryInvalid: () => {
      if (!inlineCountry) return;
      setFieldError(inlineCountry.control, inlineCountry.error, cfg.messages.countryError);
      inlineCountry.control.focus();
    },
    reset: () => {
      validationAttempted = false;
      inlineRules.forEach(({ control, error }) => {
        setFieldError(control, error, '');
        // form.reset() lands on the first enabled option because the placeholder has no `selected` attribute.
        if (control instanceof HTMLSelectElement) control.selectedIndex = 0;
      });
    },
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (cfg.layout === 'Inline') {
      if (submitBtn.getAttribute('aria-busy') === 'true') return;
      validationAttempted = true;
      showMessage(message, '');
      if (!validateInline()) return;
      if (gate.blockedBy() === 'captcha') {
        // A restored form can have consent ticked without the change event that normally starts the widget.
        initializeCaptcha();
        showMessage(
          message,
          !siteKey ? cfg.messages.captchaUnavailableError : cfg.messages.captchaRequiredError,
          'error',
        );
        return;
      }
      submitForm(
        form,
        { property, captcha, captchaEnabled: cfg.enableHCaptcha, inline: inlineHandlers },
        message,
        submitBtn,
      );
      return;
    }
    if (gate.blockedBy() === 'captcha') {
      initializeCaptcha();
      showMessage(
        message,
        !siteKey
          ? 'CAPTCHA is unavailable. Please try again later.'
          : captchaLoading
            ? 'CAPTCHA is loading. Please wait.'
            : 'Please complete the captcha.',
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
    // Inline fields clear or refresh their own error through their rule.
    if (cfg.layout !== 'Inline') {
      target.removeAttribute('aria-invalid');
      target.removeAttribute('aria-describedby');
    }
    if (cfg.layout === 'Inline' && target instanceof HTMLInputElement && target.type !== 'checkbox') {
      preloadCaptcha();
    }
  });
  if (cfg.layout === 'Inline' && consentCheckbox) {
    consentCheckbox.addEventListener('click', initializeCaptcha);
    consentCheckbox.addEventListener('change', initializeCaptcha);
  } else {
    form.addEventListener('focusin', initializeCaptcha);
    form.addEventListener('pointerdown', initializeCaptcha);
  }

  if (cfg.layout === 'Inline') {
    // ── Replace authored rows with the form rendered directly in place ─────
    block.textContent = '';
    block.classList.add('newsletter-inline');
    block.append(form);
    if (successModal) block.append(successModal.dialog);
    return;
  }

  // ── Wrap the form in a modal, triggered by an on-page button ─────────────
  const { overlay, trigger } = buildModal(form, cfg.triggerLabel, cfg.title);
  trigger.addEventListener('click', initializeCaptcha);

  // ── Replace authored rows with the trigger button + modal ────────────────
  block.textContent = '';
  block.append(trigger, overlay);
}
