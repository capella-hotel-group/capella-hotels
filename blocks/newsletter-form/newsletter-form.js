import { getEnv, getBasePathBasedOnEnv } from '../../scripts/env.js';
import { getPageLang } from '../../scripts/scripts.js';

// Fixed submission endpoint — resolved per environment, not author-editable.
const API_ENDPOINT = `${getBasePathBasedOnEnv()}/bin/chg/newslettersubscription.json`;

// Fallback option lists, used only when the author leaves the corresponding
// options field empty in the block dialog.
const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];
const COUNTRIES = [
  { value: 'SG', label: 'Singapore' },
  { value: 'AU', label: 'Australia' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
];

// Maps a location found in the page URL to its display name and Capella
// property code. Used to auto-derive Property (name) and Source (code) on submit.
const PROPERTY_CODES = [
  { keys: ['bangkok'], name: 'Capella Bangkok', code: 'CPBAN' },
  { keys: ['hanoi'], name: 'Capella Hanoi', code: 'CPHAN' },
  { keys: ['kyoto'], name: 'Capella Kyoto', code: 'CPKYO' },
  { keys: ['macau', 'macao'], name: 'Capella Macau', code: 'CPMAC' },
  { keys: ['sanya', 'tufu'], name: 'Capella Sanya', code: 'CPSAN' },
  { keys: ['shanghai'], name: 'Capella Shanghai', code: 'CPSHA' },
  { keys: ['singapore'], name: 'Capella Singapore', code: 'CPSIN' },
  { keys: ['sydney'], name: 'Capella Sydney', code: 'CPSYD' },
  { keys: ['taipei'], name: 'Capella Taipei', code: 'CPTAI' },
  { keys: ['ubud'], name: 'Capella Ubud', code: 'CPUBU' },
];

// Authored row order — must match the field order in `_newsletter-form.json`.
const ROW = {
  TITLE: 0,
  SALUTATION_LABEL: 1,
  SALUTATION_OPTIONS: 2,
  FIRST_NAME: 3,
  LAST_NAME: 4,
  EMAIL: 5,
  COUNTRY_LABEL: 6,
  COUNTRY_OPTIONS: 7,
  CONSENT: 8,
  SUBMIT: 9,
};

/** Reads the trimmed text of an authored row's value cell. */
function rowText(rows, index) {
  return rows[index]?.querySelector(':scope > div')?.textContent?.trim() ?? '';
}

/** Reads the inner HTML of an authored row's value cell (for richtext). */
function rowHTML(rows, index) {
  return rows[index]?.querySelector(':scope > div')?.innerHTML?.trim() ?? '';
}

/**
 * Parses an authored options cell into a list of { value, label }.
 * Each line (a <p> or <li>) is one option. Authors may use a `VALUE|Label`
 * syntax to set a distinct submitted value (e.g. `SG|Singapore`); when the
 * pipe is omitted, the text is used for both value and label.
 * Returns the provided fallback list when the cell is empty.
 */
function parseOptions(rows, index, fallback) {
  const cell = rows[index]?.querySelector(':scope > div');
  if (!cell) return fallback;

  const lineEls = [...cell.querySelectorAll('p, li')];
  const lines = (lineEls.length ? lineEls.map((el) => el.textContent) : cell.textContent.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return fallback;

  return lines.map((line) => {
    const [first, ...rest] = line.split('|');
    const value = first.trim();
    const label = rest.length ? rest.join('|').trim() : value;
    return { value, label };
  });
}

/**
 * Derives the Capella property from the current page URL by matching a known
 * location keyword in the path. The path is tokenized on slashes, hyphens and
 * underscores, so a location matches whether it stands alone (`/bangkok`) or is
 * part of a larger slug (`/capella-bangkok/...`).
 * @returns {{ name: string, code: string } | null} The matched property, or null.
 */
function resolveProperty() {
  const path = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();
  // Split into tokens so `bangkok` matches in `/bangkok` and `/capella-bangkok/`
  // alike, without the substring false positives of a plain `includes` check.
  const tokens = path.split(/[/_-]+/).filter(Boolean);
  return PROPERTY_CODES.find(({ keys }) => keys.some((key) => tokens.includes(key))) ?? null;
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
 * @param {{ endpoint: string }} config
 * @param {HTMLElement} message Live-region element for feedback
 * @param {HTMLButtonElement} submitBtn
 */
async function submitForm(form, config, message, submitBtn) {
  // Gather all named fields the visitor entered.
  const payload = Object.fromEntries(new FormData(form).entries());

  // Auto-mapped metadata (not visitor-entered).
  // Prefer the <html lang> attribute; if it is missing (e.g. block decorated
  // before scripts.js sets it), derive the language from the URL path instead.
  payload.Language = document.documentElement.lang || getPageLang();
  // Property is the location name and Source is the property code (CP...),
  // both derived from the page URL. On non-property pages Property is empty and
  // Source falls back to 'website'.
  const property = resolveProperty();
  payload.Property = property ? property.name : '';
  payload.Source = property ? property.code : 'website';
  payload.Environment = getEnv();

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
    salutationLabel: rowText(rows, ROW.SALUTATION_LABEL) || 'Salutation',
    salutationOptions: parseOptions(rows, ROW.SALUTATION_OPTIONS, SALUTATIONS),
    firstNameLabel: rowText(rows, ROW.FIRST_NAME) || 'First Name',
    lastNameLabel: rowText(rows, ROW.LAST_NAME) || 'Last Name',
    emailLabel: rowText(rows, ROW.EMAIL) || 'Email Address',
    countryLabel: rowText(rows, ROW.COUNTRY_LABEL) || 'Country',
    countryOptions: parseOptions(rows, ROW.COUNTRY_OPTIONS, COUNTRIES),
    consentHTML: rowHTML(rows, ROW.CONSENT),
    submitLabel: rowText(rows, ROW.SUBMIT) || 'Continue',
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
    buildSelect('Salutation', 'Select', cfg.salutationOptions),
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
    buildSelect('Country', 'Select', cfg.countryOptions),
  );

  // Consent notice — an informational line (no checkbox). By submitting the
  // form the visitor agrees to this statement.
  const consentWrapper = document.createElement('div');
  consentWrapper.className = 'newsletter-consent';
  consentWrapper.innerHTML = cfg.consentHTML
    || 'I would like to receive updates and offers from Capella Hotel Group via email or other electronic channels. <a href="/privacy">View our Privacy Policy</a>.';

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
    submitForm(form, { endpoint: API_ENDPOINT }, message, submitBtn);
  });

  // ── Replace authored rows with the finished form ─────────────────────────
  block.textContent = '';
  block.append(form);
}
