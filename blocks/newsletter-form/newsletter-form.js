import { getEnv } from '../../scripts/env.js';

// Fixed option lists for the select fields. Labels for these fields are
// author-configurable via the block dialog; the option values are stable.
const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
const COUNTRIES = [
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
];

// Authored row order — must match the field order in `_newsletter-form.json`.
const ROW = {
  TITLE: 0,
  SALUTATION: 1,
  FIRST_NAME: 2,
  LAST_NAME: 3,
  EMAIL: 4,
  COUNTRY: 5,
  CONSENT: 6,
  SUBMIT: 7,
  ENDPOINT: 8,
  SOURCE: 9,
};

/** Reads the trimmed text of an authored row's value cell. */
function rowText(rows, index) {
  return rows[index]?.querySelector(':scope > div')?.textContent?.trim() ?? '';
}

/** Reads the inner HTML of an authored row's value cell (for richtext). */
function rowHTML(rows, index) {
  return rows[index]?.querySelector(':scope > div')?.innerHTML?.trim() ?? '';
}

/** Creates a labelled field wrapper containing the given input/select. */
function buildField(id, labelText, control, { required = true } = {}) {
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
function buildSelect(name, placeholder, options) {
  const select = document.createElement('select');
  select.name = name;

  const blank = document.createElement('option');
  blank.value = '';
  blank.disabled = true;
  blank.selected = true;
  blank.textContent = placeholder;
  select.append(blank);

  options.forEach((opt) => {
    const value = typeof opt === 'string' ? opt : opt.value;
    const text = typeof opt === 'string' ? opt : opt.label;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  });

  return select;
}

/** Builds a text/email input. */
function buildInput(name, type, placeholder) {
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  if (placeholder) input.placeholder = placeholder;
  return input;
}

/**
 * Collects every form entry plus auto-mapped metadata and POSTs it as JSON.
 * @param {HTMLFormElement} form
 * @param {{ endpoint: string, source: string }} config
 * @param {HTMLElement} message Live-region element for feedback
 * @param {HTMLButtonElement} submitBtn
 */
async function submitForm(form, config, message, submitBtn) {
  // Gather all named fields the visitor entered.
  const payload = Object.fromEntries(new FormData(form).entries());

  // Auto-mapped metadata (not visitor-entered).
  payload.Consent = form.querySelector('[name="consentCheckbox"]')?.checked ? 'TRUE' : 'FALSE';
  payload.Timestamp = new Date().toISOString();
  payload.Language = document.documentElement.lang || 'en';
  payload.Source = config.source || 'website';
  payload.Environment = getEnv();
  delete payload.consentCheckbox; // internal control, replaced by Consent

  message.textContent = '';
  message.className = 'newsletter-message';
  submitBtn.disabled = true;

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Submission failed: ${response.status} ${response.statusText}`);
    }

    form.reset();
    message.textContent = 'Thank you for subscribing!';
    message.classList.add('is-success');
  } catch (error) {
    message.textContent = 'Sorry, something went wrong. Please try again.';
    message.classList.add('is-error');
    // eslint-disable-next-line no-console
    console.error('Newsletter submission error:', error);
  } finally {
    submitBtn.disabled = false;
  }
}

export default function decorate(block) {
  const rows = [...block.children];

  // ── Read authored labels / config (the dialog inputs) ────────────────────
  const cfg = {
    title: rowText(rows, ROW.TITLE) || 'Subscribe to our newsletter',
    salutationLabel: rowText(rows, ROW.SALUTATION) || 'Salutation',
    firstNameLabel: rowText(rows, ROW.FIRST_NAME) || 'First Name',
    lastNameLabel: rowText(rows, ROW.LAST_NAME) || 'Last Name',
    emailLabel: rowText(rows, ROW.EMAIL) || 'Email Address',
    countryLabel: rowText(rows, ROW.COUNTRY) || 'Country',
    consentHTML: rowHTML(rows, ROW.CONSENT),
    submitLabel: rowText(rows, ROW.SUBMIT) || 'Continue',
    endpoint: rowText(rows, ROW.ENDPOINT) || '/api/leads',
    source: rowText(rows, ROW.SOURCE) || 'website',
  };

  // ── Build the real <form> ────────────────────────────────────────────────
  const form = document.createElement('form');
  form.className = 'newsletter-form-element';
  form.noValidate = true;

  const title = document.createElement('h2');
  title.className = 'newsletter-title';
  title.textContent = cfg.title;

  const salutation = buildField(
    'newsletter-salutation',
    cfg.salutationLabel,
    buildSelect('Salutation', cfg.salutationLabel, SALUTATIONS),
  );

  const firstName = buildField(
    'newsletter-first-name',
    cfg.firstNameLabel,
    buildInput('FirstName', 'text', cfg.firstNameLabel),
  );

  const lastName = buildField(
    'newsletter-last-name',
    cfg.lastNameLabel,
    buildInput('LastName', 'text', cfg.lastNameLabel),
  );

  const nameRow = document.createElement('div');
  nameRow.className = 'newsletter-name-row';
  nameRow.append(firstName, lastName);

  const email = buildField(
    'newsletter-email',
    cfg.emailLabel,
    buildInput('Email', 'email', cfg.emailLabel),
  );

  const country = buildField(
    'newsletter-country',
    cfg.countryLabel,
    buildSelect('Country', cfg.countryLabel, COUNTRIES),
  );

  // Consent checkbox — uses an internal control name; value is mapped to
  // `Consent` (TRUE/FALSE) at submit time.
  const consentWrapper = document.createElement('div');
  consentWrapper.className = 'newsletter-consent';
  const consentInput = document.createElement('input');
  consentInput.type = 'checkbox';
  consentInput.id = 'newsletter-consent';
  consentInput.name = 'consentCheckbox';
  consentInput.required = true;
  const consentLabel = document.createElement('label');
  consentLabel.setAttribute('for', 'newsletter-consent');
  consentLabel.innerHTML = cfg.consentHTML || 'I agree to receive updates.';
  consentWrapper.append(consentInput, consentLabel);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'newsletter-submit';
  submitBtn.textContent = cfg.submitLabel;

  const message = document.createElement('div');
  message.className = 'newsletter-message';
  message.setAttribute('aria-live', 'polite');

  form.append(
    title,
    salutation,
    nameRow,
    email,
    country,
    consentWrapper,
    submitBtn,
    message,
  );

  // ── Wire up submission ───────────────────────────────────────────────────
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    submitForm(form, { endpoint: cfg.endpoint, source: cfg.source }, message, submitBtn);
  });

  // ── Replace authored rows with the finished form ─────────────────────────
  block.textContent = '';
  block.append(form);
}
