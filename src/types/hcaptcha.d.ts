export interface HCaptchaRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
}

export interface HCaptchaApi {
  render: (container: HTMLElement, options: HCaptchaRenderOptions) => string;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

export {};
