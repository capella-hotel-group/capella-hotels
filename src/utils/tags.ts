import { getPublishBaseUrl } from './env.js';

const tagTitles = new Map<string, Promise<string>>();

export function normalizeTag(value: string): string {
  const tag = value.trim();
  if (!tag.startsWith('/content/cq:tags/')) return tag;
  const [namespace, ...segments] = tag.slice('/content/cq:tags/'.length).split('/');
  return `${namespace}:${segments.join('/')}`;
}

export function tagTitle(tag: string): Promise<string> {
  const cached = tagTitles.get(tag);
  if (cached) return cached;

  const lookup = async (): Promise<string> => {
    if (!tag.includes(':')) return tag;
    const fallback = (tag.split('/').pop()?.split(':').pop() || tag).replace(/[-_]/g, ' ');
    const [namespace, ...segments] = tag.split(':');
    const tagPath = `${namespace}/${segments.join(':')}`;
    if (!/^[\w/-]+$/.test(tagPath) || tagPath.split('/').includes('..')) return fallback;
    try {
      const response = await fetch(`${getPublishBaseUrl()}/content/cq:tags/${tagPath}.json`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return fallback;
      const data = (await response.json()) as Record<string, unknown>;
      const title = data[`jcr:title.${document.documentElement.lang || 'en'}`] || data['jcr:title'];
      return typeof title === 'string' && title.trim() ? title.trim() : fallback;
    } catch {
      return fallback;
    }
  };

  const title = lookup();
  tagTitles.set(tag, title);
  return title;
}

export function setTagTitle(element: HTMLElement, tag: string): void {
  element.textContent = (tag.split('/').pop()?.split(':').pop() || tag).replace(/[-_]/g, ' ');
  void tagTitle(tag).then((title) => {
    element.textContent = title;
  });
}
