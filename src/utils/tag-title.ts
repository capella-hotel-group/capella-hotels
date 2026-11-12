import { getPublishBaseUrl } from '@/utils/env.js';

const requests = new Map<string, Promise<Map<string, string>>>();

function tagPath(tag: string): string {
  const value = tag.trim();
  const path = value.startsWith('/content/cq:tags/') ? value : `/content/cq:tags/${value.replace(':', '/')}`;
  return /^\/content\/cq:tags\/[\w/-]+$/.test(path) && !path.split('/').includes('..') ? path : '';
}

export async function resolveTagTitle(tag: string): Promise<string> {
  const path = tagPath(tag);
  if (!path) return '';
  const parent = path.slice(0, path.lastIndexOf('/'));
  const url = new URL('/content/servlet.childtags.json', getPublishBaseUrl());
  url.searchParams.set('tag', parent);
  const key = `${url.href}:${document.documentElement.lang}`;
  let request = requests.get(key);
  if (!request) {
    request = (async () => {
      try {
        const response = await fetch(url.href, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Tag request failed (${response.status}).`);
        const payload = await response.json();
        if (!Array.isArray(payload.data)) throw new Error('Invalid tag response.');
        const titles = new Map<string, string>();
        for (const item of payload.data) {
          if (typeof item?.path !== 'string' || typeof item?.title !== 'string') continue;
          if (item.path.slice(0, item.path.lastIndexOf('/')) !== parent || !item.title.trim()) continue;
          titles.set(item.path, item.title.trim());
        }
        return titles;
      } catch {
        requests.delete(key);
        return new Map<string, string>();
      }
    })();
    requests.set(key, request);
  }
  return (await request).get(path) || '';
}

export function setTagTitle(element: HTMLElement, tag: string, resolved?: (title: string) => void): void {
  if (!tag) return;
  void resolveTagTitle(tag).then((title) => {
    if (!title) return;
    element.textContent = title;
    resolved?.(title);
  });
}
