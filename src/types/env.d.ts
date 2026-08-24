declare module '*/scripts/env.js' {
  export function getPublishBaseUrl(): string;
  export function getBasePathBasedOnEnv(): string;
  export function getEnv(): string;
  export function getHCaptchaSiteKey(): string;
  export function resolveDAMUrl(src: string): string;
  export function isUniversalEditor(): boolean;
}
