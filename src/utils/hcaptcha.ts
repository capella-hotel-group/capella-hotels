import type { HCaptchaApi } from '@/types/hcaptcha.js';

const HCAPTCHA_API_SRC = 'https://js.hcaptcha.com/1/api.js';
const HCAPTCHA_ONLOAD_CALLBACK = 'capellaHCaptchaOnLoad';

let hcaptchaApiPromise: Promise<HCaptchaApi> | undefined;

/** Loads the hCaptcha API once and shares it across blocks on the page. */
export function loadHCaptcha(): Promise<HCaptchaApi> {
  if (window.hcaptcha) return Promise.resolve(window.hcaptcha);
  if (hcaptchaApiPromise) return hcaptchaApiPromise;

  hcaptchaApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const params = new URLSearchParams({ onload: HCAPTCHA_ONLOAD_CALLBACK, render: 'explicit' });
    script.src = `${HCAPTCHA_API_SRC}?${params.toString()}`;
    script.async = true;
    script.defer = true;

    const cleanup = (): void => {
      delete window.capellaHCaptchaOnLoad;
      hcaptchaApiPromise = undefined;
    };

    window.capellaHCaptchaOnLoad = () => {
      if (window.hcaptcha) {
        resolve(window.hcaptcha);
      } else {
        cleanup();
        reject(new Error('hCaptcha API unavailable'));
      }
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Failed to load hCaptcha API'));
    };
    document.head.append(script);
  });

  return hcaptchaApiPromise;
}
