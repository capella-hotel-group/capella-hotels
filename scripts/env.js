/**
 * Environment detection and AEM asset URL resolution.
 * Update ENV_CONFIG when new environments are provisioned.
 */

const ENV_CONFIG = [
  {
    env: 'prod',
    publishUrl: 'https://publish-p000000-e0000000.adobeaemcloud.com',
    hostnames: [],
  },
  {
    env: 'stage',
    publishUrl: 'https://publish-p000000-e0000000.adobeaemcloud.com',
    hostnames: [],
  },
  {
    env: 'dev',
    publishUrl: 'https://publish-p152536-e1620746.adobeaemcloud.com',
    hostnames: [
      'localhost',
    ],
  },
  {
    env: 'rde',
    publishUrl: 'https://publish-p152536-e1620746.adobeaemcloud.com',
    hostnames: [
      'author-p152536-e1620746.adobeaemcloud.com',
      'main--capella-hotel-group-poc--capella-hotel-group.aem.live',
      'main--capella-hotel-group-poc--capella-hotel-group.aem.page',
    ],
  },
  {
    // Fallback: unknown hostname → warn and use RDE publish
    env: 'rde',
    publishUrl: 'https://publish-p152536-e1620746.adobeaemcloud.com',
    hostnames: [],
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

export function getEnv() {
  if (typeof window === 'undefined') return 'rde';
  const { hostname } = window.location;
  const match = ENV_CONFIG.find((e) => e.hostnames.includes(hostname));
  if (match) return match.env;
  return ENV_CONFIG[ENV_CONFIG.length - 1].env;
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
