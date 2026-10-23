import type { HCaptchaApi } from '@/types/hcaptcha.js';
import { loadHCaptcha } from './hcaptcha';

describe('loadHCaptcha', () => {
  afterEach(() => {
    document.head.querySelector('script[src*="hcaptcha.com/1/api.js"]')?.remove();
    delete window.hcaptcha;
    delete window.capellaHCaptchaOnLoad;
  });

  it('resolves only after hCaptcha invokes its explicit onload callback', async () => {
    const api: HCaptchaApi = {
      render: jest.fn(() => 'widget-id'),
      reset: jest.fn(),
    };

    const result = loadHCaptcha();
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="hcaptcha.com/1/api.js"]');

    expect(script?.src).toContain('onload=capellaHCaptchaOnLoad');
    expect(script?.src).toContain('render=explicit');

    window.hcaptcha = api;
    window.capellaHCaptchaOnLoad?.();

    await expect(result).resolves.toBe(api);
    await expect(loadHCaptcha()).resolves.toBe(api);
  });
});
