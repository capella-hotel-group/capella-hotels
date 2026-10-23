import { getPageLang } from '@/app/scripts.js';
import { getBasePathBasedOnEnv } from '@/utils/env.js';
import { getAlpha2Code, registerLocale } from 'i18n-iso-countries';
import englishCountryNames from 'i18n-iso-countries/langs/en.json';

registerLocale(englishCountryNames);

const API_ENDPOINT = `${getBasePathBasedOnEnv()}/content/servlet.newslettersubscription.json`;
const OPTIONS_GRAPHQL_QUERY = '/graphql/execute.json/capella-hotels/ListCF';
const OPTION_KEYS = ['options', 'items', 'elements', 'values', 'list', 'salutations', 'countries'];
const GROUP_PROPERTY_CODE = 'CHG';
const NON_HOTEL_PROPERTY_CODE = 'CHR';
const REQUIRED_FIELDS = ['salutation', 'firstName', 'lastName', 'email', 'country'];
const FORM_SOURCE = 'Newsletter';

interface NormalizedProperty {
  keys: string[];
  code: string;
}

export interface NewsletterSubmissionOptions {
  property: string;
  captchaEnabled: boolean;
  captchaToken: string;
}

export type NewsletterSubmissionResult =
  'success' | 'missing-fields' | 'invalid-country' | 'captcha-required' | 'request-failed';

function collectRawItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, any>;

  if (obj.data && typeof obj.data === 'object') {
    const node = Object.values(obj.data).find((value) => value && typeof value === 'object');
    const items = Array.isArray((node as any)?.items)
      ? (node as any).items
      : Object.values(obj.data).find((value) => Array.isArray(value));
    if (Array.isArray(items)) {
      return items.flatMap((item: unknown) => {
        if (item && typeof item === 'object') {
          const nested = Object.values(item as Record<string, unknown>).find((value) => Array.isArray(value));
          if (nested) return nested;
        }
        return item;
      });
    }
  }

  const master = obj['jcr:content']?.data?.master ?? obj.data?.master ?? obj;
  const arrayKey = OPTION_KEYS.find((key) => Array.isArray(master[key]));
  if (arrayKey) return master[arrayKey];

  const multiline = Object.values(master).find((value) => typeof value === 'string' && value.includes('\n'));
  if (multiline) return (multiline as string).split('\n');

  return (Object.values(master).find((value) => Array.isArray(value)) as unknown[]) ?? [];
}

async function fetchRawList(path: string): Promise<unknown[]> {
  if (!path) return [];
  try {
    const cfPath = path.replace(/\.json$/, '');
    const url = `${getBasePathBasedOnEnv()}${OPTIONS_GRAPHQL_QUERY};path=${cfPath}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return [];
    return collectRawItems(await response.json());
  } catch (error) {
    console.error('Newsletter property mapping fetch error:', path, error);
    return [];
  }
}

function normalizeProperty(item: unknown): NormalizedProperty | null {
  let keysRaw: unknown;
  let name = '';
  let code: unknown;
  if (typeof item === 'string') {
    const parts = item.split('|').map((part) => part.trim());
    if (parts.length >= 3) {
      [keysRaw, , code] = parts;
    } else {
      [keysRaw, code] = parts;
    }
  } else if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    keysRaw = obj.keys ?? obj.key ?? obj.location ?? obj.slug;
    name = String(obj.name ?? obj.property ?? obj.title ?? obj.label ?? '');
    code = obj.code ?? obj.source ?? obj.value;
  }
  if (!code) return null;
  const keysText = Array.isArray(keysRaw) ? keysRaw.join(' ') : String(keysRaw ?? name);
  const keys = keysText
    .toLowerCase()
    .split(/[ ,\s/_-]+/)
    .filter(Boolean);
  return keys.length ? { keys, code: String(code).trim() } : null;
}

function fallbackPropertyCode(): string {
  const path = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();
  const tokens = path.split(/[/_-]+/).filter(Boolean);
  if (tokens.includes('residences') || tokens.includes('residence')) return NON_HOTEL_PROPERTY_CODE;
  const host = (typeof window !== 'undefined' ? window.location.hostname : '').toLowerCase();
  return host.includes('capellahotelgroup') ? GROUP_PROPERTY_CODE : NON_HOTEL_PROPERTY_CODE;
}

export async function resolveNewsletterProperty(path: string): Promise<string> {
  const properties = (await fetchRawList(path))
    .map(normalizeProperty)
    .filter((property): property is NormalizedProperty => !!property);
  const pagePath = (typeof window !== 'undefined' ? window.location.pathname : '').toLowerCase();
  const tokens = pagePath.split(/[/_-]+/).filter(Boolean);
  const property = properties.find(({ keys }) => keys.some((key) => tokens.includes(key)));
  return property?.code ?? fallbackPropertyCode();
}

/** Builds and submits the common Newsletter Form API request. */
export async function submitNewsletterForm(
  form: HTMLFormElement,
  { property, captchaEnabled, captchaToken }: NewsletterSubmissionOptions,
): Promise<NewsletterSubmissionResult> {
  const payload: Record<string, string> = Object.fromEntries(
    [...new FormData(form).entries()].map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
  ) as Record<string, string>;

  if (REQUIRED_FIELDS.some((field) => !payload[field])) return 'missing-fields';

  const countryCode = getAlpha2Code(payload.country ?? '', 'en');
  if (!countryCode) return 'invalid-country';
  payload.country = countryCode.toUpperCase();

  if (captchaEnabled && !captchaToken) return 'captcha-required';
  payload.captchaEnabled = String(captchaEnabled);
  if (captchaToken) payload.captchaValue = captchaToken;

  const langTag = document.documentElement.lang || getPageLang();
  payload.language = (langTag.split('-')[0] ?? '').toLowerCase();
  payload.property = property;
  payload.source = FORM_SOURCE;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Accept: 'application/json',
      },
      body: new URLSearchParams(payload).toString(),
    });
    if (!response.ok) throw new Error(`Submission failed: ${response.status} ${response.statusText}`);
    return 'success';
  } catch (error) {
    console.error('Newsletter submission error:', error);
    return 'request-failed';
  }
}
