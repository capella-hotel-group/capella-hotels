/**
 * Environment detection and AEM asset URL resolution.
 * Update ENV_CONFIG when new environments are provisioned.
 */

// `hcaptchaSiteKey` is the PUBLIC hCaptcha site key for each environment. It is
// safe to expose in client code (unlike the secret key, which must stay on the
// servlet). Fill in the prod/stage keys as those environments are provisioned.
const ENV_CONFIG = [
  {
    env: 'prod',
    publishUrl: 'https://publish-p000000-e0000000.adobeaemcloud.com',
    hostnames: [],
    hcaptchaSiteKey: '',
  },
  {
    env: 'stage',
    publishUrl: 'https://publish-p000000-e0000000.adobeaemcloud.com',
    hostnames: [],
    hcaptchaSiteKey: '',
  },
  {
    env: 'dev',
    publishUrl: 'https://publish-p152536-e1620746.adobeaemcloud.com',
    hostnames: [
      'localhost',
      'author-p152536-e1620746.adobeaemcloud.com',
      'main--capella-hotels--capella-hotel-group.aem.page',
      'main--capella-hotels--capella-hotel-group.aem.live',
    ],
    hcaptchaSiteKey: '740c6c8a-6f1e-4a52-9ce0-069ce33451fc',
  },
  {
    // Fallback: unknown hostname → warn and use RDE publish
    env: 'dev',
    publishUrl: 'https://publish-p152536-e1620746.adobeaemcloud.com',
    hostnames: [],
    hcaptchaSiteKey: '740c6c8a-6f1e-4a52-9ce0-069ce33451fc',
  },
];

// Cache publish base URL — hostname doesn't change during a page session
let publishBaseUrlCache;

export function getPublishBaseUrl() {
  if (publishBaseUrlCache) return publishBaseUrlCache;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const entry = ENV_CONFIG.find((e) => e.hostnames.length && e.hostnames.includes(hostname))
    ?? ENV_CONFIG[ENV_CONFIG.length - 1];
  publishBaseUrlCache = entry.publishUrl;
  return publishBaseUrlCache;
}

/**
 * Returns the base path/origin for server-side API calls (e.g. AEM `/bin`
 * servlets), selected based on the current environment. No trailing slash.
 * @returns {string} Base URL, e.g. `https://publish-p152536-e1620746.adobeaemcloud.com`
 */
export function getBasePathBasedOnEnv() {
  return getPublishBaseUrl();
}

export function getEnv() {
  if (typeof window === 'undefined') return 'rde';
  const { hostname } = window.location;
  const match = ENV_CONFIG.find((e) => e.hostnames.includes(hostname));
  if (match) return match.env;
  return ENV_CONFIG[ENV_CONFIG.length - 1].env;
}

/**
 * Returns the PUBLIC hCaptcha site key for the current environment, resolved by
 * hostname (falls back to the last ENV_CONFIG entry). Empty string when the
 * environment has no key configured, in which case callers may fall back to the
 * `hcaptcha-site-key` <meta> tag.
 * @returns {string}
 */
export function getHCaptchaSiteKey() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const entry = ENV_CONFIG.find((e) => e.hostnames.length && e.hostnames.includes(hostname))
    ?? ENV_CONFIG[ENV_CONFIG.length - 1];
  return entry.hcaptchaSiteKey ?? '';
}

export function resolveDAMUrl(src) {
  const base = getPublishBaseUrl();
  try {
    const url = new URL(src);
    return `${new URL(base).origin}${url.pathname}${url.search}`;
  } catch {
    return `${base}${src}`;
  }
}

export function isUniversalEditor() {
  return typeof window !== 'undefined' && window.self !== window.top;
}
