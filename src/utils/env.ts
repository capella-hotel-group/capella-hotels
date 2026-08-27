import { ENV_CONFIG, type EnvConfigEntry } from '@/configs/env.js';

// Cache publish base URL — hostname doesn't change during a page session
let publishBaseUrlCache: string | undefined;

function matchEnvEntry(): EnvConfigEntry {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return (
    ENV_CONFIG.find((entry) => entry.hostnames.length && entry.hostnames.includes(hostname)) ??
    (ENV_CONFIG[ENV_CONFIG.length - 1] as EnvConfigEntry)
  );
}

export function getPublishBaseUrl(): string {
  if (publishBaseUrlCache) return publishBaseUrlCache;
  publishBaseUrlCache = matchEnvEntry().publishUrl;
  return publishBaseUrlCache;
}

/**
 * Returns the base path/origin for server-side API calls (e.g. AEM `/bin`
 * servlets), selected based on the current environment. No trailing slash.
 * @returns Base URL, e.g. `https://publish-p152536-e1620746.adobeaemcloud.com`
 */
export function getBasePathBasedOnEnv(): string {
  return getPublishBaseUrl();
}

export function getEnv(): string {
  if (typeof window === 'undefined') return 'rde';
  const { hostname } = window.location;
  const match = ENV_CONFIG.find((entry) => entry.hostnames.includes(hostname));
  if (match) return match.env;
  return (ENV_CONFIG[ENV_CONFIG.length - 1] as EnvConfigEntry).env;
}

/**
 * Returns the PUBLIC hCaptcha site key for the current environment, resolved by
 * hostname (falls back to the last ENV_CONFIG entry). Empty string when the
 * environment has no key configured, in which case callers may fall back to the
 * `hcaptcha-site-key` <meta> tag.
 */
export function getHCaptchaSiteKey(): string {
  return matchEnvEntry().hcaptchaSiteKey ?? '';
}

export function resolveDAMUrl(src: string): string {
  const base = getPublishBaseUrl();
  try {
    const url = new URL(src);
    return `${new URL(base).origin}${url.pathname}${url.search}`;
  } catch {
    return `${base}${src}`;
  }
}

export function isUniversalEditor(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
}
