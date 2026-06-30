import { getEnv, getBasePathBasedOnEnv } from '../../scripts/env.js';
import { getPageLang } from '../../scripts/scripts.js';

// Fixed submission endpoint — resolved per environment, not author-editable.
const API_ENDPOINT = `${getBasePathBasedOnEnv()}/bin/chg/newslettersubscription.json`;

// Persisted GraphQL query that returns a Content Fragment "list" by path. The
// authored CF path is appended as `;path=<cfPath>`, e.g.
// /graphql/execute.json/capella-hotels/ListCF;path=/content/dam/.../salutation-list
const OPTIONS_GRAPHQL_QUERY = '/graphql/execute.json/capella-hotels/ListCF';

// Fallback option lists, used when the author leaves the Content Fragment path
// empty or when the referenced fragment cannot be loaded.
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
// SALUTATION_OPTIONS and COUNTRY_OPTIONS are Content Fragment paths whose
// entries populate the corresponding dropdowns.
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
 * Reads a Content Fragment path from an `aem-content` row. The picker renders
 * the selected path as a link; fall back to the cell's text if it is stored as
 * plain text.
 */
function rowLink(rows, index) {
  const cell = rows[index]?.querySelector(':scope > div');
  if (!cell) return '';
  const link = cell.querySelector('a');
  return (link?.getAttribute('href') || cell.textContent || '').trim();
}

/**
 * Normalises a single raw Content Fragment entry into a { value, label } pair.
 * Accepts either a `VALUE|Label` string (label optional) or an object using any
 * of the common key names (value/code/key/id and label/name/title/text).
 * @returns {{ value: string, label: string } | null}
 */
function normalizeOption(item) {
  if (typeof item === 'string') {
    const line = item.trim();
    if (!line) return null;
    const [first, ...rest] = line.split('|');
    const value = first.trim();
    return { value, label: rest.length ? rest.join('|').trim() : value };
  }
  if (item && typeof item === 'object') {
    const value = item.value ?? item.code ?? item.key ?? item.id
      ?? item.label ?? item.name ?? item.title;
    if (value == null) return null;
    const label = item.label ?? item.name ?? item.title ?? item.text ?? value;
    return { value: String(value).trim(), label: String(label).trim() };
  }
  return null;
}

// Field names a Content Fragment might use to hold its list of options.
const OPTION_KEYS = ['options', 'items', 'elements', 'values', 'list', 'salutations', 'countries'];

/**
 * Extracts the raw list of option entries from the query response, tolerating
 * the shapes AEM commonly returns: the GraphQL persisted-query envelope
 * (`{ data: { <model>List: { items: [{ listItems: [...] }] } } }`), a bare
 * array, a model field that is an array, a single multiline text field (one
 * option per line), or the nested JCR export (`jcr:content/data/master`).
 */
function collectRawItems(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  // GraphQL persisted-query envelope: drill into `data` → `<model>List.items`.
  if (data.data && typeof data.data === 'object') {
    const node = Object.values(data.data).find((v) => v && typeof v === 'object');
    const items = Array.isArray(node?.items)
      ? node.items
      : Object.values(data.data).find((v) => Array.isArray(v));
    if (Array.isArray(items)) {
      // Each list fragment holds its options in a nested array field
      // (e.g. `listItems`); flatten those out. Items without a nested array are
      // treated as option entries themselves.
      return items.flatMap((item) => {
        if (item && typeof item === 'object') {
          const nested = Object.values(item).find((v) => Array.isArray(v));
          if (nested) return nested;
        }
        return item;
      });
    }
  }

  // Unwrap the Content Fragment data node when present (JCR JSON export).
  const master = data['jcr:content']?.data?.master ?? data.data?.master ?? data;

  const arrayKey = OPTION_KEYS.find((key) => Array.isArray(master[key]));
  if (arrayKey) return master[arrayKey];

  // A single multiline string field → one option per line.
  const multiline = Object.values(master).find((v) => typeof v === 'string' && v.includes('\n'));
  if (multiline) return multiline.split('\n');

  // Otherwise, the first array-valued field on the fragment.
  return Object.values(master).find((v) => Array.isArray(v)) ?? [];
}

/**
 * Fetches the option list for a Content Fragment via the `ListCF` persisted
 * GraphQL query, passing the authored CF path as the `;path=` parameter.
 * Returns the provided fallback list when no path is authored or the query
 * cannot be loaded/parsed, so the form always has usable options.
 * @param {string} path Authored Content Fragment path (e.g. `/content/dam/...`).
 * @param {Array} fallback Options to use if the fragment is unavailable.
 */
async function fetchOptions(path, fallback) {
  if (!path) return fallback;
  try {
    const cfPath = path.replace(/\.json$/, '');
    const url = `${getBasePathBasedOnEnv()}${OPTIONS_GRAPHQL_QUERY};path=${encodeURIComponent(cfPath)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return fallback;

    const options = collectRawItems(await response.json())
      .map(normalizeOption)
      .filter((opt) => opt && opt.value);
    return options.length ? options : fallback;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Newsletter options fetch error:', path, error);
    return fallback;
  }
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

export default async function decorate(block) {
  const rows = [...block.children];

  // ── Read authored labels / config (the dialog inputs) ────────────────────
  const cfg = {
    title: rowText(rows, ROW.TITLE) || 'Subscribe to our newsletter',
    salutationLabel: rowText(rows, ROW.SALUTATION_LABEL) || 'Salutation',
    salutationPath: rowLink(rows, ROW.SALUTATION_OPTIONS),
    firstNameLabel: rowText(rows, ROW.FIRST_NAME) || 'First Name',
    lastNameLabel: rowText(rows, ROW.LAST_NAME) || 'Last Name',
    emailLabel: rowText(rows, ROW.EMAIL) || 'Email Address',
    countryLabel: rowText(rows, ROW.COUNTRY_LABEL) || 'Country',
    countryPath: rowLink(rows, ROW.COUNTRY_OPTIONS),
    consentHTML: rowHTML(rows, ROW.CONSENT),
    submitLabel: rowText(rows, ROW.SUBMIT) || 'Continue',
  };

  // Load dropdown options from the authored Content Fragments (in parallel),
  // falling back to the built-in lists when a fragment is missing or empty.
  const [salutationOptions, countryOptions] = await Promise.all([
    fetchOptions(cfg.salutationPath, SALUTATIONS),
    fetchOptions(cfg.countryPath, COUNTRIES),
  ]);

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
    buildSelect('Salutation', 'Select', salutationOptions),
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
    buildSelect('Country', 'Select', countryOptions),
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
