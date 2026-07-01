import { getBasePathBasedOnEnv, getHCaptchaSiteKey as getEnvHCaptchaSiteKey } from '../../scripts/env.js';
import { getPageLang } from '../../scripts/scripts.js';

// Fixed submission endpoint — resolved per environment, not author-editable.
const API_ENDPOINT = `${getBasePathBasedOnEnv()}/content/servlet.newslettersubscription.json`;

// Persisted GraphQL query that returns a Content Fragment "list" by path. The
// authored CF path is appended as `;path=<cfPath>`, e.g.
// /graphql/execute.json/capella-hotels/ListCF;path=/content/dam/.../salutation-list
const OPTIONS_GRAPHQL_QUERY = '/graphql/execute.json/capella-hotels/ListCF';

// hCaptcha JS API, loaded on demand. `render=explicit` lets us mount the widget
// ourselves (rather than auto-scanning the DOM), which is what we need inside a
// dynamically decorated block.
const HCAPTCHA_API_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit';

// Visitor-entered fields that are all mandatory. Submission is rejected (and
// never sent) if any of these is missing or blank.
const REQUIRED_FIELDS = ['salutation', 'firstName', 'lastName', 'email', 'country'];

// Authored row order — must match the field order in `_newsletter-form.json`.
// SALUTATION_OPTIONS, COUNTRY_OPTIONS and PROPERTY_OPTIONS are Content Fragment
// paths: the first two populate the dropdowns, the last provides the
// location → Property/Source mapping used on submit.
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
  PROPERTY_OPTIONS: 10,
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
 * Runs the `ListCF` persisted GraphQL query for a Content Fragment path and
 * returns its raw list entries. Empty array when no path is authored or the
 * query cannot be loaded/parsed.
 * @param {string} path Authored Content Fragment path (e.g. `/content/dam/...`).
 * @returns {Promise<Array>}
 */
async function fetchRawList(path) {
  if (!path) return [];
  try {
    // The persisted-query `;path=` parameter must be the RAW Content Fragment
    // path. URL-encoding the slashes (e.g. `%2F`) makes the query match nothing
    // and return an empty `items` array, so pass the path as-is.
    const cfPath = path.replace(/\.json$/, '');
    const url = `${getBasePathBasedOnEnv()}${OPTIONS_GRAPHQL_QUERY};path=${cfPath}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    return collectRawItems(await response.json());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Newsletter list fetch error:', path, error);
    return [];
  }
}

/**
 * Fetches dropdown options from a Content Fragment as { value, label } pairs.
 * @param {string} path Authored Content Fragment path.
 * @returns {Promise<Array<{ value: string, label: string }>>}
 */
async function fetchOptions(path) {
  return (await fetchRawList(path))
    .map(normalizeOption)
    .filter((opt) => opt && opt.value);
}

/**
 * Normalises a raw property-mapping entry into { keys, name, code }. Accepts a
 * `KEYS|NAME|CODE` string (KEYS may list several comma/space separated location
 * keywords, e.g. `macau,macao|Capella Macau|CPMAC`) or an object using
 * keys/key/location + name/property + code/source style fields. When KEYS is
 * omitted the NAME is tokenised and used for matching instead.
 * @returns {{ keys: string[], name: string, code: string } | null}
 */
function normalizeProperty(item) {
  let keysRaw;
  let name;
  let code;
  if (typeof item === 'string') {
    [keysRaw, name, code] = item.split('|').map((part) => part.trim());
  } else if (item && typeof item === 'object') {
    keysRaw = item.keys ?? item.key ?? item.location ?? item.slug;
    name = item.name ?? item.property ?? item.title ?? item.label;
    code = item.code ?? item.source ?? item.value;
  }
  if (!name || !code) return null;
  const keysStr = Array.isArray(keysRaw) ? keysRaw.join(' ') : String(keysRaw ?? name);
  const keys = keysStr.toLowerCase().split(/[,\s/_-]+/).filter(Boolean);
  if (!keys.length) return null;
  return { keys, name: String(name).trim(), code: String(code).trim() };
}

/**
 * Fetches the location → Property/Source mapping from a Content Fragment.
 * @param {string} path Authored Content Fragment path.
 * @returns {Promise<Array<{ keys: string[], name: string, code: string }>>}
 */
async function fetchProperties(path) {
  return (await fetchRawList(path))
    .map(normalizeProperty)
    .filter(Boolean);
}

/**
 * Derives the Capella property from the current page URL by matching a known
 * location keyword in the path against the authored mapping. The path is
 * tokenised on slashes, hyphens and underscores, so a location matches whether
 * it stands alone (`/bangkok`) or is part of a larger slug (`/capella-bangkok/`).
 * @param {Array<{ keys: string[], name: string, code: string }>} properties
 * @returns {{ name: string, code: string } | null} The matched property, or null.
 */
function resolveProperty(properties) {
  if (!properties?.length) return null;
  const path = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();
  const tokens = path.split(/[/_-]+/).filter(Boolean);
  return properties.find(({ keys }) => keys.some((key) => tokens.includes(key))) ?? null;
}

/**
 * Resolves the public hCaptcha site key. Prefers the per-environment value from
 * `env.js` (the "environment variable" equivalent in EDS); falls back to the
 * `hcaptcha-site-key` <meta> tag when no environment key is configured.
 */
function getHCaptchaSiteKey() {
  return getEnvHCaptchaSiteKey()
    || document.head.querySelector('meta[name="hcaptcha-site-key"]')?.content?.trim()
    || '';
}

// Single shared promise so the hCaptcha API script is loaded at most once, even
// when several newsletter blocks are present on the page.
let hcaptchaApiPromise;

/**
 * Loads the hCaptcha JS API on demand and resolves with `window.hcaptcha`.
 * Rejects if the script fails to load.
 * @returns {Promise<object>}
 */
function loadHCaptcha() {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
  if (hcaptchaApiPromise) return hcaptchaApiPromise;

  hcaptchaApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = HCAPTCHA_API_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.hcaptcha ? resolve(window.hcaptcha) : reject(new Error('hCaptcha API unavailable')));
    script.onerror = () => reject(new Error('Failed to load hCaptcha API'));
    document.head.append(script);
  });
  return hcaptchaApiPromise;
}

/**
 * Renders an hCaptcha widget into `container` and wires it to enable/disable the
 * submit button. Returns a getter for the current token (empty when unsolved).
 * On any failure the submit button is left enabled so the form still works —
 * server-side verification remains the source of truth.
 * @param {HTMLElement} container
 * @param {string} siteKey
 * @param {HTMLButtonElement} submitBtn
 * @returns {Promise<{ getToken: () => string, reset: () => void }>}
 */
async function setupCaptcha(container, siteKey, submitBtn) {
  let token = '';
  let widgetId;
  try {
    const hcaptcha = await loadHCaptcha();
    widgetId = hcaptcha.render(container, {
      sitekey: siteKey,
      callback: (response) => {
        token = response;
        submitBtn.disabled = false;
      },
      'expired-callback': () => {
        token = '';
        submitBtn.disabled = true;
      },
      'error-callback': () => {
        token = '';
        submitBtn.disabled = true;
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Newsletter captcha error:', error);
    submitBtn.disabled = false;
    return { getToken: () => '', reset: () => {} };
  }

  return {
    getToken: () => token,
    reset: () => {
      token = '';
      submitBtn.disabled = true;
      if (window.hcaptcha && widgetId !== undefined) window.hcaptcha.reset(widgetId);
    },
  };
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
 * @param {{ endpoint: string, property: ({ name: string, code: string }|null),
 *   captcha: ({ getToken: () => string, reset: () => void }|null) }} config
 * @param {HTMLElement} message Live-region element for feedback
 * @param {HTMLButtonElement} submitBtn
 */
async function submitForm(form, config, message, submitBtn) {
  // Gather all named fields the visitor entered, trimming whitespace so that
  // spaces-only values (which satisfy HTML5 `required`) are treated as empty.
  const payload = Object.fromEntries(
    [...new FormData(form).entries()].map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  );

  // All fields are mandatory: if any is missing or blank, fail fast and do not
  // send the request.
  const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
  if (missing.length) {
    message.textContent = 'Please fill in all required fields.';
    message.className = 'newsletter-message is-error';
    form.reportValidity();
    return;
  }

  // hCaptcha: require a solved token before sending (defence-in-depth on top of
  // the disabled submit button). Skipped when captcha isn't configured/loaded.
  const captchaToken = config.captcha ? config.captcha.getToken() : '';
  if (config.captcha && !captchaToken) {
    message.textContent = 'Please complete the captcha.';
    message.className = 'newsletter-message is-error';
    return;
  }
  if (captchaToken) payload.captchaValue = captchaToken;

  // Auto-mapped metadata (not visitor-entered).
  // Prefer the <html lang> attribute; if it is missing (e.g. block decorated
  // before scripts.js sets it), derive the language from the URL path instead.
  payload.language = document.documentElement.lang || getPageLang();
  // Property is the location name and Source is the property code (CP...), both
  // resolved from the page URL against the authored CF mapping. On non-property
  // pages neither is set — the keys are omitted rather than sent empty.
  const { property } = config;
  if (property) {
    payload.property = property.name;
    payload.source = property.code;
  }

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
    // hCaptcha tokens are single-use: reset so a new solve is needed to submit
    // again. This also re-disables the submit button.
    if (config.captcha) config.captcha.reset();
    else submitBtn.disabled = false;
  } catch (error) {
    message.textContent = 'Sorry, something went wrong. Please try again.';
    message.classList.add('is-error');
    // eslint-disable-next-line no-console
    console.error('Newsletter submission error:', error);
    // The used token is now invalid; force a fresh challenge before retrying.
    if (config.captcha) config.captcha.reset();
    else submitBtn.disabled = false;
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
    propertyPath: rowLink(rows, ROW.PROPERTY_OPTIONS),
  };

  // Load dropdown options and the property mapping from the authored Content
  // Fragments (in parallel). Only fragment data is used — nothing is hardcoded.
  const [salutationOptions, countryOptions, properties] = await Promise.all([
    fetchOptions(cfg.salutationPath),
    fetchOptions(cfg.countryPath),
    fetchProperties(cfg.propertyPath),
  ]);

  // Resolve the current page's property once, for use on submit.
  const property = resolveProperty(properties);

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
    buildSelect('salutation', 'Select', salutationOptions),
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

  const email = buildField(
    'newsletter-email',
    cfg.emailLabel,
    buildInput('email', 'email', cfg.emailLabel),
  );

  const country = buildField(
    'newsletter-country',
    cfg.countryLabel,
    buildSelect('country', 'Select', countryOptions),
  );

  // Consent notice — an informational line (no checkbox). By submitting the
  // form the visitor agrees to this statement.
  const consentWrapper = document.createElement('div');
  consentWrapper.className = 'newsletter-consent';
  consentWrapper.innerHTML = cfg.consentHTML
    || 'I would like to receive updates and offers from Capella Hotel Group via email or other electronic channels. <a href="/privacy">View our Privacy Policy</a>.';

  // hCaptcha widget mount point. When a site key is configured the submit button
  // starts disabled and is enabled by the captcha callback (see setupCaptcha).
  const siteKey = getHCaptchaSiteKey();
  const captchaWrapper = document.createElement('div');
  captchaWrapper.className = 'newsletter-captcha';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'newsletter-submit';
  submitBtn.textContent = cfg.submitLabel;
  if (siteKey) submitBtn.disabled = true;

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
    captchaWrapper,
    submitBtn,
    message,
  );

  // Render the captcha (if configured) and gate the submit button on it.
  const captcha = siteKey
    ? await setupCaptcha(captchaWrapper, siteKey, submitBtn)
    : null;

  // ── Wire up submission ───────────────────────────────────────────────────
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    submitForm(form, { endpoint: API_ENDPOINT, property, captcha }, message, submitBtn);
  });

  // ── Replace authored rows with the finished form ─────────────────────────
  block.textContent = '';
  block.append(form);
}
