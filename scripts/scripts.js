import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to?.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

// Maps URL path slugs to valid BCP 47 language tags.
// Only needed for slugs that differ from the BCP 47 primary (e.g. "jp" → "ja").
const LANG_MAP = {
  'zh-cn': 'zh-CN',
  jp: 'ja',
};

// Valid ISO 639-1 language primaries supported by this site.
// Used to distinguish language codes (ar, en) from market/country codes (qa, sa, ae).
const VALID_LANG_PRIMARIES = new Set([
  'ar', 'en', 'fr', 'de', 'ja', 'ko', 'zh',
  'he', 'fa', 'ur', 'it', 'es', 'pt', 'ru',
  'nl', 'tr', 'hi', 'vi', 'th', 'id', 'ms',
]);

/**
 * Detects the page language from the URL path and normalizes it to a BCP 47 tag.
 * Checks LANG_MAP aliases first, then validates primary against VALID_LANG_PRIMARIES.
 * Skips market/country codes (qa, sa, ae) that are not valid language primaries.
 * Falls back to "en".
 * @returns {string} BCP 47 language tag
 */
function getPageLang() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const match = segments.find((s) => {
    const lower = s.toLowerCase();
    return LANG_MAP[lower] || VALID_LANG_PRIMARIES.has(lower.split('-')[0]);
  });
  if (!match) return 'en';
  const lower = match.toLowerCase();
  if (LANG_MAP[lower]) return LANG_MAP[lower];
  const parts = lower.split('-');
  return parts.length > 1 ? `${parts[0]}-${parts[1].toUpperCase()}` : parts[0];
}

/**
 * Sets dir="rtl" and body.is-rtl for RTL languages.
 * Must run before any block decoration.
 * @param {string} lang BCP 47 language tag
 */
function applyDirection(lang) {
  const primary = lang.split('-')[0];
  if (RTL_LANGS.includes(primary)) {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.classList.add('is-rtl');
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  const lang = getPageLang();
  document.documentElement.lang = lang;
  applyDirection(lang);
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
