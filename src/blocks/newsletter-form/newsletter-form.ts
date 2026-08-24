import { getBasePathBasedOnEnv, getHCaptchaSiteKey as getEnvHCaptchaSiteKey } from '../../../scripts/env.js';
import { getPageLang } from '@/app/scripts.js';
import type { HCaptchaApi } from '@/types/hcaptcha.js';

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

// Identifies which form was submitted — sent as the auto `source` field so SFMC
// can tell newsletter sign-ups apart from other (e.g. enquiry) forms.
const FORM_SOURCE = 'Newsletter';

// `property` fallback codes for non-hotel pages (where no specific hotel is
// matched from the URL), chosen by the site's domain. Hotel-specific pages
// always send the resolved hotel code instead.
//   • capellahotelgroup.com          → CHG (Capella Hotel Group)
//   • any other domain, e.g.
//     capellahotels.com              → CHR (Capella Hotels & Resorts)
const GROUP_PROPERTY_CODE = 'CHG';
const NON_HOTEL_PROPERTY_CODE = 'CHR';

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
  TRIGGER_LABEL: 11,
};

/** Reads the trimmed text of an authored row's value cell. */
function rowText(rows: Element[], index: number): string {
  return rows[index]?.querySelector(':scope > div')?.textContent?.trim() ?? '';
}

/** Reads the inner HTML of an authored row's value cell (for richtext). */
function rowHTML(rows: Element[], index: number): string {
  return rows[index]?.querySelector(':scope > div')?.innerHTML?.trim() ?? '';
}

/**
 * Reads a Content Fragment path from an `aem-content` row. The picker renders
 * the selected path as a link; fall back to the cell's text if it is stored as
 * plain text.
 */
function rowLink(rows: Element[], index: number): string {
  const cell = rows[index]?.querySelector(':scope > div');
  if (!cell) return '';
  const link = cell.querySelector('a');
  return (link?.getAttribute('href') || cell.textContent || '').trim();
}

interface NormalizedOption {
  value: string;
  label: string;
}

/**
 * Normalises a single raw Content Fragment entry into a { value, label } pair.
 * Accepts either a `Label|VALUE` string (e.g. `Singapore|SG` — the visible label
 * first, the submitted value/code last; value optional) or an object using any
 * of the common key names (value/code/key/id and label/name/title/text).
 */
function normalizeOption(item: unknown): NormalizedOption | null {
  if (typeof item === 'string') {
    const line = item.trim();
    if (!line) return null;
    // Authored as `Label|VALUE` (e.g. `Singapore|SG`): the visible label comes
    // first, the submitted value/code last. The value never contains a pipe, so
    // take the final segment as the value and everything before it as the label.
    // A single segment (no pipe) is used for both value and label.
    const parts = line.split('|');
    const value = parts.pop()?.trim() ?? '';
    const label = parts.length ? parts.join('|').trim() : value;
    return { value, label };
  }
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const value = obj.value ?? obj.code ?? obj.key ?? obj.id ?? obj.label ?? obj.name ?? obj.title;
    if (value == null) return null;
    const label = obj.label ?? obj.name ?? obj.title ?? obj.text ?? value;
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
function collectRawItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, any>;

  // GraphQL persisted-query envelope: drill into `data` → `<model>List.items`.
  if (obj.data && typeof obj.data === 'object') {
    const node = Object.values(obj.data).find((v) => v && typeof v === 'object');
    const items = Array.isArray((node as any)?.items)
      ? (node as any).items
      : Object.values(obj.data).find((v) => Array.isArray(v));
    if (Array.isArray(items)) {
      // Each list fragment holds its options in a nested array field
      // (e.g. `listItems`); flatten those out. Items without a nested array are
      // treated as option entries themselves.
      return items.flatMap((item: unknown) => {
        if (item && typeof item === 'object') {
          const nested = Object.values(item as Record<string, unknown>).find((v) => Array.isArray(v));
          if (nested) return nested;
        }
        return item;
      });
    }
  }

  // Unwrap the Content Fragment data node when present (JCR JSON export).
  const master = obj['jcr:content']?.data?.master ?? obj.data?.master ?? obj;

  const arrayKey = OPTION_KEYS.find((key) => Array.isArray(master[key]));
  if (arrayKey) return master[arrayKey];

  // A single multiline string field → one option per line.
  const multiline = Object.values(master).find((v) => typeof v === 'string' && v.includes('\n'));
  if (multiline) return (multiline as string).split('\n');

  // Otherwise, the first array-valued field on the fragment.
  return (Object.values(master).find((v) => Array.isArray(v)) as unknown[]) ?? [];
}

/**
 * Runs the `ListCF` persisted GraphQL query for a Content Fragment path and
 * returns its raw list entries. Empty array when no path is authored or the
 * query cannot be loaded/parsed.
 */
async function fetchRawList(path: string): Promise<unknown[]> {
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
 */
async function fetchOptions(path: string): Promise<NormalizedOption[]> {
  return (await fetchRawList(path))
    .map(normalizeOption)
    .filter((opt): opt is NormalizedOption => !!opt && !!opt.value);
}

interface NormalizedProperty {
  keys: string[];
  name: string;
  code: string;
}

/**
 * Normalises a raw property-mapping entry into { keys, name, code }. Accepts a
 * pipe string in either the 2-part `KEYS|CODE` form or the legacy 3-part
 * `KEYS|NAME|CODE` form — NAME is optional, only aids authoring readability, and
 * is NOT submitted (only `code` is). KEYS may list several comma/space separated
 * location keywords (e.g. `macau,macao|CPMAC`). Objects using
 * keys/key/location + code/source (+ optional name) style fields also work.
 */
function normalizeProperty(item: unknown): NormalizedProperty | null {
  let keysRaw: unknown;
  let name = '';
  let code: unknown;
  if (typeof item === 'string') {
    const parts = item.split('|').map((part) => part.trim());
    // 3+ parts → KEYS|NAME|CODE (legacy); 2 parts → KEYS|CODE.
    if (parts.length >= 3) {
      [keysRaw, name, code] = [parts[0], parts[1] ?? '', parts[2]];
    } else {
      [keysRaw, code] = parts;
    }
  } else if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    keysRaw = obj.keys ?? obj.key ?? obj.location ?? obj.slug;
    name = String(obj.name ?? obj.property ?? obj.title ?? obj.label ?? '');
    code = obj.code ?? obj.source ?? obj.value;
  }
  // Only `code` is mandatory now (it is the submitted value). `name` is optional.
  if (!code) return null;
  const keysStr = Array.isArray(keysRaw) ? keysRaw.join(' ') : String(keysRaw ?? name);
  const keys = keysStr.toLowerCase().split(/[,\s/_-]+/).filter(Boolean);
  if (!keys.length) return null;
  return { keys, name: String(name).trim(), code: String(code).trim() };
}

/**
 * Fetches the location → Property/Source mapping from a Content Fragment.
 */
async function fetchProperties(path: string): Promise<NormalizedProperty[]> {
  return (await fetchRawList(path))
    .map(normalizeProperty)
    .filter((p): p is NormalizedProperty => !!p);
}

/**
 * Derives the Capella property from the current page URL by matching a known
 * location keyword in the path against the authored mapping. The path is
 * tokenised on slashes, hyphens and underscores, so a location matches whether
 * it stands alone (`/bangkok`) or is part of a larger slug (`/capella-bangkok/`).
 */
function resolveProperty(properties: NormalizedProperty[]): NormalizedProperty | null {
  if (!properties?.length) return null;
  const path = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();
  const tokens = path.split(/[/_-]+/).filter(Boolean);
  return properties.find(({ keys }) => keys.some((key) => tokens.includes(key))) ?? null;
}

/**
 * Fallback `property` code for non-hotel pages (no specific hotel matched from
 * the URL), evaluated in order:
 *   1. A Residence(s) page without a country/hotel in the path → `CHR`
 *      (Residences belong to Capella Hotels & Resorts), regardless of domain.
 *   2. The Capella Hotel Group site (`capellahotelgroup.com`) → `CHG`.
 *   3. Any other domain (e.g. `capellahotels.com`) → `CHR`.
 */
function resolveFallbackCode(): string {
  const path = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();
  const tokens = path.split(/[/_-]+/).filter(Boolean);
  // Match both the singular (`residence`) and plural (`residences`) slugs.
  if (tokens.includes('residences') || tokens.includes('residence')) return NON_HOTEL_PROPERTY_CODE;
  const host = (typeof window !== 'undefined' ? window.location.hostname : '').toLowerCase();
  return host.includes('capellahotelgroup') ? GROUP_PROPERTY_CODE : NON_HOTEL_PROPERTY_CODE;
}

/**
 * Resolves the public hCaptcha site key. Prefers the per-environment value from
 * `env.js` (the "environment variable" equivalent in EDS); falls back to the
 * `hcaptcha-site-key` <meta> tag when no environment key is configured.
 */
function getHCaptchaSiteKey(): string {
  return getEnvHCaptchaSiteKey()
    || document.head.querySelector<HTMLMetaElement>('meta[name="hcaptcha-site-key"]')?.content?.trim()
    || '';
}

// Single shared promise so the hCaptcha API script is loaded at most once, even
// when several newsletter blocks are present on the page.
let hcaptchaApiPromise: Promise<HCaptchaApi> | undefined;

/**
 * Loads the hCaptcha JS API on demand and resolves with `window.hcaptcha`.
 * Rejects if the script fails to load.
 */
function loadHCaptcha(): Promise<HCaptchaApi> {
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

interface CaptchaController {
  getToken: () => string;
  reset: () => void;
}

/**
 * Renders an hCaptcha widget into `container` and wires it to enable/disable the
 * submit button. Returns a getter for the current token (empty when unsolved).
 * On any failure the submit button is left enabled so the form still works —
 * server-side verification remains the source of truth.
 */
async function setupCaptcha(container: HTMLElement, siteKey: string, submitBtn: HTMLButtonElement): Promise<CaptchaController> {
  let token = '';
  let widgetId: string | undefined;
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
function buildSelect(name: string, placeholder: string, options: (NormalizedOption | string)[]): HTMLSelectElement {
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
function buildInput(name: string, type: string, placeholder?: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  if (placeholder) input.placeholder = placeholder;
  return input;
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
function buildModal(form: HTMLFormElement, triggerLabel: string, title: string): { overlay: HTMLDivElement; trigger: HTMLButtonElement } {
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

interface SubmitConfig {
  endpoint: string;
  property: NormalizedProperty | null;
  captcha: CaptchaController | null;
}

/**
 * Collects every form entry plus auto-mapped metadata and POSTs it as
 * application/x-www-form-urlencoded (so the Sling servlet's getParameter()
 * can read each field).
 */
async function submitForm(form: HTMLFormElement, config: SubmitConfig, message: HTMLElement, submitBtn: HTMLButtonElement): Promise<void> {
  // Gather all named fields the visitor entered, trimming whitespace so that
  // spaces-only values (which satisfy HTML5 `required`) are treated as empty.
  const payload: Record<string, string> = Object.fromEntries(
    [...new FormData(form).entries()].map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  ) as Record<string, string>;

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
  // Language: SFMC expects the 2-character code only. `getPageLang()` /
  // <html lang> may hold a full BCP-47 tag (e.g. `en-US`, `ar-QA`), so take the
  // primary subtag before the hyphen.
  const langTag = document.documentElement.lang || getPageLang();
  payload.language = (langTag.split('-')[0] ?? '').toLowerCase();
  // Property: the hotel code resolved from the page URL against the authored CF
  // mapping. On non-hotel pages (no match) fall back to a group code — CHR for a
  // Residences page without a country, CHG on capellahotelgroup.com, else CHR.
  // Source: a constant identifying which form was submitted.
  const { property } = config;
  payload.property = property ? property.code : resolveFallbackCode();
  payload.source = FORM_SOURCE;

  message.textContent = '';
  message.className = 'newsletter-message';
  submitBtn.disabled = true;

  try {
    // The Sling servlet reads fields via request.getParameter(), which only
    // parses form-encoded (or query-string / multipart) bodies — NOT a raw JSON
    // body. Send application/x-www-form-urlencoded so every field is readable.
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
      },
      body: new URLSearchParams(payload).toString(),
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

export default async function decorate(block: HTMLElement): Promise<void> {
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
    triggerLabel: rowText(rows, ROW.TRIGGER_LABEL) || 'Subscribe',
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

  // ── Wrap the form in a modal, triggered by an on-page button ─────────────
  const { overlay, trigger } = buildModal(form, cfg.triggerLabel, cfg.title);

  // ── Replace authored rows with the trigger button + modal ────────────────
  block.textContent = '';
  block.append(trigger, overlay);
}
