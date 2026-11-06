import { moveInstrumentation } from '@/app/scripts.js';
import { applyBlockIdentity } from '@/utils/block-identity.js';
import { getHCaptchaSiteKey, isUniversalEditor } from '@/utils/env.js';
import { loadHCaptcha } from '@/utils/hcaptcha.js';
import { resolveNewsletterProperty, submitNewsletterForm } from '@/utils/newsletter-submission.js';

const BLOCK = 'text-with-cta';
const ITEM_MODEL = 'text-with-cta-signup-form';

/** Sign-up item cells in model order; `tab` fields emit no cell. */
const FORM_FIELDS = [
  'triggerLabel',
  'salutationLabel',
  'salutationOptions',
  'firstNameLabel',
  'lastNameLabel',
  'countryLabel',
  'emailLabel',
  'consentLabel',
  'submitLabel',
] as const;
const CONFIG_FIELDS = ['enableHCaptcha', 'errorMessage', 'propertyOptions'] as const;
/** Read from the end of the row: the optional `infoText` before them drops its cell when blank. */
const TRAILING_FIELDS = [
  'salutationError',
  'firstNameError',
  'lastNameError',
  'countryError',
  'emailRequiredError',
  'emailFormatError',
  'consentError',
  'successEyebrow',
  'successHeading',
  'successMessage',
  'successButtonLabel',
] as const;
/** Pre-CAP-116 order: the success message followed the submit label. */
const LEGACY_FIELDS = ['successMessage', 'enableHCaptcha', 'errorMessage', 'propertyOptions', 'infoText'] as const;

type FieldName =
  (typeof FORM_FIELDS)[number] | (typeof CONFIG_FIELDS)[number] | (typeof TRAILING_FIELDS)[number] | 'infoText';

const INFO_TEXT_INDEX = FORM_FIELDS.length + CONFIG_FIELDS.length;
const ROW_LENGTH = INFO_TEXT_INDEX + 1 + TRAILING_FIELDS.length;
const LEGACY_ROW_LENGTH = FORM_FIELDS.length + LEGACY_FIELDS.length;

const DEFAULTS = {
  salutationError: 'Please select a title.',
  firstNameError: 'Please enter your first name.',
  lastNameError: 'Please enter your last name.',
  countryError: 'Please select your country.',
  emailRequiredError: 'Please enter a valid email address.',
  emailFormatError: 'Please enter a valid email address.',
  consentError: 'Please accept the terms to continue.',
  successEyebrow: 'Newsletter',
  successButtonLabel: 'Done',
} satisfies Partial<Record<FieldName, string>>;

const DEFAULT_SUCCESS_HEADING = ['Thank you', 'for subscribing'];
const DEFAULT_SUCCESS_MESSAGE =
  'You have successfully joined our mailing list. Look out for the latest news and exclusive offers from Capella.';

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

declare global {
  interface Window {
    /** Opens the newsletter success modal of the given form (element or id), or of the first one on the page. */
    showNewsletterSuccessModal?: (form?: HTMLFormElement | string) => boolean;
  }
}

const successModals = new Map<string, () => void>();

window.showNewsletterSuccessModal = (form) => {
  const id = typeof form === 'string' ? form : form?.id;
  const open = id ? successModals.get(id) : successModals.values().next().value;
  open?.();
  return !!open;
};

let uid = 0;

const textOf = (cell?: Element | null): string => cell?.textContent?.trim() || '';

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

/** Maps item cells to field names, for both the current tabbed model and pre-CAP-116 content. */
function parseSignupCells(cells: Element[]): Partial<Record<FieldName, Element>> {
  const fields: Partial<Record<FieldName, Element>> = {};
  const assign = (names: readonly FieldName[], from: Element[]): void => {
    names.forEach((name, index) => {
      if (from[index]) fields[name] = from[index];
    });
  };
  assign(FORM_FIELDS, cells);
  const rest = cells.slice(FORM_FIELDS.length);
  // Legacy rows put free text (the success message) where the hCaptcha boolean now sits.
  if (cells.length <= LEGACY_ROW_LENGTH && !/^(true|false)$/i.test(textOf(rest[0]))) {
    assign(LEGACY_FIELDS, rest);
    return fields;
  }
  assign(CONFIG_FIELDS, rest);
  if (cells.length < ROW_LENGTH - 1) {
    fields.infoText = cells[INFO_TEXT_INDEX];
    return fields;
  }
  assign(TRAILING_FIELDS, cells.slice(-TRAILING_FIELDS.length));
  if (cells.length >= ROW_LENGTH) fields.infoText = cells[INFO_TEXT_INDEX];
  return fields;
}

function linkOf(cell?: Element | null): string {
  if (!cell) return '';
  const link = cell.querySelector('a');
  return (link?.getAttribute('href') || cell.textContent || '').trim();
}

/** Cells are always divs; a richtext field can emit bare paragraphs onto its row. */
const cellsOf = (row: HTMLElement): HTMLElement[] => [...row.querySelectorAll<HTMLElement>(':scope > div')];

/** The row's single content cell, or the row itself when the field emitted bare nodes. */
const contentOf = (row?: HTMLElement): Element | undefined => (row ? cellsOf(row)[0] || row : undefined);

/**
 * Every block-level field emits exactly one cell, so only item rows hold several.
 * Item rows also carry their model in the editor, which wins when present.
 */
function findItemRows(rows: HTMLElement[]): HTMLElement[] {
  if (rows.some((row) => row.dataset.aueModel)) {
    return rows.filter((row) => row.dataset.aueModel === ITEM_MODEL);
  }
  return rows.filter((row) => cellsOf(row).length > 1);
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

interface TextField {
  name: string;
  label: string;
  type: 'text' | 'email';
  autocomplete: AutoFill;
}

type FormControl = HTMLInputElement | HTMLSelectElement;

interface FieldBuild {
  wrapper: HTMLElement;
  control: FormControl;
  error: HTMLElement;
}

function buildError(controlId: string): HTMLElement {
  const error = el('p', `${BLOCK}-field-error`);
  error.id = `${controlId}-error`;
  error.hidden = true;
  return error;
}

/**
 * Renders one underlined field. The design shows the label inside the field, so the
 * visible text is the placeholder and the real <label> is kept for screen readers.
 */
function buildTextField(field: TextField, formId: string): FieldBuild {
  const wrapper = el('div', `${BLOCK}-field`);
  const id = `${formId}-${field.name}`;

  const label = el('label', `${BLOCK}-field-label`, field.label);
  label.htmlFor = id;

  const input = el('input', `${BLOCK}-field-control`);
  input.id = id;
  input.name = field.name;
  input.type = field.type;
  input.placeholder = field.label;
  input.autocomplete = field.autocomplete;
  input.required = true;

  const error = buildError(id);
  wrapper.append(label, input, error);
  return { wrapper, control: input, error };
}

function buildSelectField(
  name: string,
  label: string,
  options: string[],
  formId: string,
  autocomplete?: AutoFill,
): FieldBuild {
  const wrapper = el('div', `${BLOCK}-field ${BLOCK}-field-select`);
  const id = `${formId}-${name}`;

  const fieldLabel = el('label', `${BLOCK}-field-label`, label);
  fieldLabel.htmlFor = id;

  const select = el('select', `${BLOCK}-field-control`);
  select.id = id;
  select.name = name;
  if (autocomplete) select.autocomplete = autocomplete;
  select.required = true;

  const placeholder = el('option', undefined, label);
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);
  appendOptions(select, options);

  const error = buildError(id);
  wrapper.append(fieldLabel, select, error);
  return { wrapper, control: select, error };
}

function appendOptions(select: HTMLSelectElement, options: string[]): void {
  select.append(
    ...options.map((option) => {
      const item = el('option', undefined, option);
      item.value = option;
      return item;
    }),
  );
}

let countryNames: Promise<string[]> | undefined;

/** ISO 3166 English names: the submission helper maps these back to alpha-2 codes. */
function loadCountryNames(): Promise<string[]> {
  countryNames ??= Promise.all([import('i18n-iso-countries'), import('i18n-iso-countries/langs/en.json')])
    .then(([countries, locale]) => {
      countries.registerLocale(locale.default);
      return Object.values(countries.getNames('en', { select: 'official' })).sort((a, b) => a.localeCompare(b));
    })
    .catch((error: unknown) => {
      countryNames = undefined;
      throw error;
    });
  return countryNames;
}

/** Consent row: the authored rich text is moved in as-is so its links survive. */
function buildConsent(source: Element | undefined, formId: string): FieldBuild {
  const wrapper = el('div', `${BLOCK}-consent-field`);
  const row = el('div', `${BLOCK}-consent`);
  const id = `${formId}-consent`;

  const input = el('input', `${BLOCK}-consent-control`);
  input.id = id;
  input.type = 'checkbox';
  input.name = 'consent';
  input.required = true;

  const label = el('label', `${BLOCK}-consent-label`);
  label.htmlFor = id;
  if (source) label.append(...source.childNodes);

  const error = buildError(id);
  row.append(input, label);
  wrapper.append(row, error);
  return { wrapper, control: input, error };
}

interface SuccessModalContent {
  eyebrow: string;
  heading: string[];
  message: string[];
  buttonLabel: string;
}

/** Native <dialog> gives the focus trap, Escape handling and focus restore for free. */
function buildSuccessModal(
  content: SuccessModalContent,
  formId: string,
): { dialog: HTMLDialogElement; open: () => void } {
  const dialog = el('dialog', `${BLOCK}-modal`);
  const headingId = `${formId}-success-heading`;
  const messageId = `${formId}-success-message`;
  dialog.setAttribute('aria-labelledby', headingId);
  dialog.setAttribute('aria-describedby', messageId);
  dialog.setAttribute('data-testid', `${BLOCK}-success-modal`);

  const panel = el('div', `${BLOCK}-modal-content`);
  const copy = el('div', `${BLOCK}-modal-copy`);
  const titleBlock = el('div', `${BLOCK}-modal-title-block`);
  if (content.eyebrow) titleBlock.append(el('p', `${BLOCK}-modal-eyebrow`, content.eyebrow));

  const heading = el('h2', `${BLOCK}-modal-title`);
  heading.id = headingId;
  content.heading.forEach((line, index) => {
    if (index) heading.append(document.createElement('br'));
    heading.append(line);
  });
  titleBlock.append(heading);

  const message = el('div', `${BLOCK}-modal-message`);
  message.id = messageId;
  message.append(...content.message.map((paragraph) => el('p', undefined, paragraph)));
  copy.append(titleBlock, message);

  const done = el('button', `${BLOCK}-modal-done`, content.buttonLabel);
  done.type = 'button';

  const closeButton = el('button', `${BLOCK}-modal-close`);
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');

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
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  return { dialog, open };
}

function buildRow(modifier: string, fields: HTMLElement[]): HTMLElement {
  const row = el('div', `${BLOCK}-form-row ${BLOCK}-form-row-${modifier}`);
  row.append(...fields);
  return row;
}

function wireDisclosure(trigger: HTMLButtonElement, form: HTMLFormElement, panel: HTMLElement): void {
  const setExpanded = (expanded: boolean): void => {
    trigger.setAttribute('aria-expanded', String(expanded));
    form.hidden = !expanded;
    panel.classList.toggle('is-expanded', expanded);
  };

  trigger.addEventListener('click', () => {
    setExpanded(trigger.getAttribute('aria-expanded') !== 'true');
    if (!form.hidden) form.querySelector<HTMLElement>('select, input')?.focus();
  });

  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    setExpanded(false);
    trigger.focus();
  });

  // The authoring iframe has no way to click through to the expanded state.
  setExpanded(isUniversalEditor());
}

interface SignupFormBuild {
  panel: HTMLElement;
}

function buildSignupForm(row: Element, legacyInfoTextCell?: Element): SignupFormBuild {
  const cells = parseSignupCells([...row.children]);
  const formId = `${BLOCK}-form-${(uid += 1)}`;
  const label = (name: FieldName, fallback: string): string => textOf(cells[name]) || fallback;
  const message = (name: keyof typeof DEFAULTS): string => label(name, DEFAULTS[name]);
  const enableHCaptcha = label('enableHCaptcha', '').toLowerCase() === 'true';

  const panel = el('div', `${BLOCK}-signup`);
  moveInstrumentation(row, panel);

  const trigger = el('button', `${BLOCK}-trigger`, label('triggerLabel', 'Join now'));
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', formId);

  const form = el('form', `${BLOCK}-form`);
  form.id = formId;
  // Errors are rendered inline for every field at once instead of the native one-at-a-time popups.
  form.noValidate = true;

  const fields = el('div', `${BLOCK}-form-fields`);
  const infoTextCell = cells.infoText;
  const infoTextSource = infoTextCell && textOf(infoTextCell) ? infoTextCell : legacyInfoTextCell;
  if (infoTextSource && textOf(infoTextSource)) {
    const infoText = el('div', `${BLOCK}-form-info-text`);
    moveInstrumentation(infoTextSource, infoText);
    infoText.append(...infoTextSource.childNodes);
    fields.append(infoText);
  }

  const salutationOptions = label('salutationOptions', '')
    .split(',')
    .map((option) => option.trim())
    .filter(Boolean);

  const salutation = buildSelectField('salutation', label('salutationLabel', 'Title'), salutationOptions, formId);
  const firstName = buildTextField(
    { name: 'firstName', label: label('firstNameLabel', 'First name'), type: 'text', autocomplete: 'given-name' },
    formId,
  );
  const lastName = buildTextField(
    { name: 'lastName', label: label('lastNameLabel', 'Last name'), type: 'text', autocomplete: 'family-name' },
    formId,
  );
  const country = buildSelectField('country', label('countryLabel', 'Country'), [], formId, 'country-name');
  let countriesRequested = false;
  // The list is only needed once the form is shown, so the countries chunk stays off the critical path.
  const populateCountries = (): void => {
    if (countriesRequested) return;
    countriesRequested = true;
    loadCountryNames()
      .then((names) => appendOptions(country.control as HTMLSelectElement, names))
      .catch((error: unknown) => {
        countriesRequested = false;
        console.error('Text with CTA country list error:', error);
      });
  };
  trigger.addEventListener('click', populateCountries);
  if (isUniversalEditor()) populateCountries();
  const email = buildTextField(
    { name: 'email', label: label('emailLabel', 'Email'), type: 'email', autocomplete: 'email' },
    formId,
  );
  const consent = buildConsent(cells.consentLabel, formId);
  fields.append(
    buildRow('three', [salutation.wrapper, firstName.wrapper, lastName.wrapper]),
    buildRow('two', [country.wrapper, email.wrapper]),
    consent.wrapper,
  );

  const nameRule = (name: keyof typeof DEFAULTS) => (value: string) => (NAME_PATTERN.test(value) ? '' : message(name));
  const rules: { field: FieldBuild; validate: (value: string) => string }[] = [
    { field: salutation, validate: (value) => (value ? '' : message('salutationError')) },
    { field: firstName, validate: nameRule('firstNameError') },
    { field: lastName, validate: nameRule('lastNameError') },
    { field: country, validate: (value) => (value ? '' : message('countryError')) },
    {
      field: email,
      validate: (value) => {
        if (!value) return message('emailRequiredError');
        return EMAIL_PATTERN.test(value) ? '' : message('emailFormatError');
      },
    },
    {
      field: consent,
      validate: () => ((consent.control as HTMLInputElement).checked ? '' : message('consentError')),
    },
  ];

  const setError = ({ control, error }: FieldBuild, text: string): void => {
    error.textContent = text;
    error.hidden = !text;
    if (text) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', error.id);
    } else {
      control.removeAttribute('aria-invalid');
      control.removeAttribute('aria-describedby');
    }
  };
  const runRule = ({ field, validate }: (typeof rules)[number]): boolean => {
    const text = validate(field.control.value.trim());
    setError(field, text);
    return !text;
  };
  /** Flags every invalid field at once and moves focus to the first one. */
  const validateForm = (): boolean => {
    const invalid = rules.filter((rule) => !runRule(rule));
    invalid[0]?.field.control.focus();
    return !invalid.length;
  };
  let validationAttempted = false;
  rules.forEach((rule) => {
    const revalidate = (): void => {
      if (validationAttempted) runRule(rule);
    };
    rule.field.control.addEventListener('input', revalidate);
    rule.field.control.addEventListener('change', revalidate);
  });

  const submit = el('button', `${BLOCK}-submit`, label('submitLabel', 'Sign up'));
  submit.type = 'submit';
  submit.setAttribute('data-testid', `${BLOCK}-submit`);
  submit.disabled = enableHCaptcha;

  const captcha = el('div', `${BLOCK}-captcha`);
  captcha.setAttribute('data-testid', `${BLOCK}-captcha`);

  const status = el('p', `${BLOCK}-status`);
  status.setAttribute('role', 'status');

  form.append(fields);
  if (enableHCaptcha) form.append(captcha);
  form.append(submit, status);

  const successHeading = linesOf(cells.successHeading);
  const successMessage = linesOf(cells.successMessage);
  const successModal = buildSuccessModal(
    {
      eyebrow: message('successEyebrow'),
      heading: successHeading.length ? successHeading : DEFAULT_SUCCESS_HEADING,
      message: successMessage.length ? successMessage : [DEFAULT_SUCCESS_MESSAGE],
      buttonLabel: message('successButtonLabel'),
    },
    formId,
  );
  successModals.set(formId, successModal.open);
  panel.append(trigger, form, successModal.dialog);

  const errorMessage = label('errorMessage', 'Sorry, something went wrong. Please try again.');
  const propertyPath = linkOf(cells.propertyOptions);
  let captchaToken = '';
  let captchaWidgetId: string | undefined;
  let captchaInitialized = false;
  let captchaUnavailable = false;
  let captchaPreloaded = false;
  form.addEventListener('input', (event) => {
    const target = event.target;
    if (!enableHCaptcha || captchaPreloaded || !(target instanceof HTMLInputElement) || target.type === 'checkbox') {
      return;
    }
    captchaPreloaded = true;
    void loadHCaptcha().catch((error: unknown) => {
      captchaPreloaded = false;
      console.error('Text with CTA CAPTCHA error:', error);
      status.textContent = 'CAPTCHA is unavailable. Please try again later.';
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.getAttribute('aria-busy') === 'true') return;
    validationAttempted = true;
    if (!validateForm()) return;
    if (enableHCaptcha && captchaUnavailable) {
      status.textContent = 'CAPTCHA is unavailable. Please try again later.';
      return;
    }
    if (enableHCaptcha && !captchaToken) {
      status.textContent = 'Please complete the CAPTCHA verification.';
      return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    status.textContent = '';
    const property = await resolveNewsletterProperty(propertyPath);
    const result = await submitNewsletterForm(form, {
      property,
      captchaEnabled: enableHCaptcha,
      captchaToken,
    });
    submit.removeAttribute('aria-busy');

    if (result === 'success') {
      form.reset();
      validationAttempted = false;
      rules.forEach(({ field }) => setError(field, ''));
      captcha.hidden = true;
      successModal.open();
      if (enableHCaptcha) {
        captchaToken = '';
        if (window.hcaptcha && captchaWidgetId !== undefined) window.hcaptcha.reset(captchaWidgetId);
      }
    } else if (result === 'missing-fields') {
      validateForm();
    } else if (result === 'invalid-country') {
      setError(country, message('countryError'));
      country.control.focus();
    } else if (result === 'country-validation-unavailable') {
      status.textContent = 'Country validation is unavailable. Please try again later.';
    } else if (result === 'captcha-required') {
      status.textContent = 'Please complete the CAPTCHA verification.';
    } else {
      status.textContent = errorMessage;
      if (enableHCaptcha) {
        captchaToken = '';
        if (window.hcaptcha && captchaWidgetId !== undefined) window.hcaptcha.reset(captchaWidgetId);
      }
    }
    submit.disabled = result !== 'success' && enableHCaptcha && !captchaToken;
  });

  const initializeCaptcha = (): void => {
    if (!enableHCaptcha) return;
    captcha.hidden = false;
    if (captchaInitialized) return;
    captchaInitialized = true;

    const siteKey =
      getHCaptchaSiteKey() ||
      document.head.querySelector<HTMLMetaElement>('meta[name="hcaptcha-site-key"]')?.content?.trim() ||
      '';

    if (!siteKey) {
      captchaUnavailable = true;
      status.textContent = 'CAPTCHA is unavailable. Please try again later.';
      return;
    }

    loadHCaptcha()
      .then((hcaptcha) => {
        captchaWidgetId = hcaptcha.render(captcha, {
          sitekey: siteKey,
          callback: (token) => {
            captchaToken = token;
            submit.disabled = submit.getAttribute('aria-busy') === 'true';
            status.textContent = '';
          },
          'expired-callback': () => {
            captchaToken = '';
            submit.disabled = true;
            status.textContent = 'Please complete the CAPTCHA verification.';
          },
          'error-callback': () => {
            captchaToken = '';
            submit.disabled = true;
            status.textContent = 'CAPTCHA verification failed. Please try again.';
          },
        });
      })
      .catch((error: unknown) => {
        console.error('Text with CTA CAPTCHA error:', error);
        captchaToken = '';
        captchaUnavailable = true;
        submit.disabled = true;
        status.textContent = 'CAPTCHA is unavailable. Please try again later.';
      });
  };

  consent.control.addEventListener('click', initializeCaptcha);
  consent.control.addEventListener('change', initializeCaptcha);
  wireDisclosure(trigger, form, panel);
  return { panel };
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children] as HTMLElement[];
  const itemRows = findItemRows(rows);
  const contentRows = rows.filter((row) => !itemRows.includes(row));
  const [titleRow, descriptionRow, legacyInfoTextRow] = applyBlockIdentity(block, contentRows, { contentRows: 2 });

  const text = el('div', `${BLOCK}-text`);

  const titleCell = contentOf(titleRow);
  if (titleCell) {
    titleCell.classList.add(`${BLOCK}-title`);
    text.append(titleCell);
  }

  const descriptionCell = contentOf(descriptionRow);
  if (descriptionCell) {
    descriptionCell.classList.add(`${BLOCK}-description`);
    text.append(descriptionCell);
  }

  const aside = el('div', `${BLOCK}-aside`);
  const legacyInfoTextCell = contentOf(legacyInfoTextRow);
  const signupForms = itemRows.map((row, index) => buildSignupForm(row, index === 0 ? legacyInfoTextCell : undefined));
  signupForms.forEach(({ panel }) => aside.append(panel));

  block.textContent = '';
  block.append(text, aside);
}
