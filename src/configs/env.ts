/**
 * Environment detection and AEM asset URL resolution.
 * Update ENV_CONFIG when new environments are provisioned.
 */

export interface EnvConfigEntry {
  env: string;
  publishUrl: string;
  hostnames: string[];
  hcaptchaSiteKey: string;
}

// `hcaptchaSiteKey` is the PUBLIC hCaptcha site key for each environment. It is
// safe to expose in client code (unlike the secret key, which must stay on the
// servlet). Fill in the prod/stage keys as those environments are provisioned.
export const ENV_CONFIG: EnvConfigEntry[] = [
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
