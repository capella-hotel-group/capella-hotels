import { getPublishBaseUrl } from './env.js';

interface TagChild {
  name: string;
  title?: string;
  path?: string;
}

interface ChildTagsResponse {
  results: TagChild[];
}

const tagChildrenCache = new Map<string, Promise<Map<string, string>>>();

export function normalizeTag(value: string): string {
  const tag = value.trim();
  if (!tag.startsWith('/content/cq:tags/')) return tag;
  const [namespace, ...segments] = tag.slice('/content/cq:tags/'.length).split('/');
  return `${namespace}:${segments.join('/')}`;
}

function extractLastSegment(tag: string): string {
  return (tag.split('/').pop()?.split(':').pop() || tag).replace(/[-_]/g, ' ');
}

export function fetchTagChildren(parentPath: string): Promise<Map<string, string>> {
  const cached = tagChildrenCache.get(parentPath);
  if (cached) return cached;

  const lookup = async (): Promise<Map<string, string>> => {
    const titleMap = new Map<string, string>();

    // Normalize parent path: handle both "locations" and "/content/cq:tags/locations"
    let servletPath = parentPath.trim();
    if (!servletPath.startsWith('/content/cq:tags/')) {
      servletPath = `/content/cq:tags/${servletPath}`;
    }

    // Validate path for safety
    if (!/^\/content\/cq:tags\/[\w/:-]+$/.test(servletPath)) {
      return titleMap;
    }

    try {
      const response = await fetch(
        `${getPublishBaseUrl()}/content/servlet.childtags.json?tag=${encodeURIComponent(servletPath)}`,
        {
          headers: { Accept: 'application/json' },
        },
      );

      if (!response.ok) {
        return titleMap;
      }

      const data = (await response.json()) as ChildTagsResponse;

      // Build a map of tag path to title
      if (Array.isArray(data.results)) {
        data.results.forEach((tag: TagChild) => {
          if (tag.name && tag.title) {
            // Reconstruct the full tag path from parent and child name
            const fullPath = `${parentPath}:${tag.name}`.replace(/\/content\/cq:tags\//g, '').replace(/\//g, ':');
            titleMap.set(fullPath, tag.title);
          }
        });
      }
    } catch {
      // If fetch fails, return empty map (fallback will be used)
    }

    return titleMap;
  };

  const promise = lookup();
  tagChildrenCache.set(parentPath, promise);
  return promise;
}

export async function getTagTitle(tag: string, childTitlesMap: Map<string, string>): Promise<string> {
  const fallback = extractLastSegment(tag);

  // Try to find the tag in the cached children map
  const title = childTitlesMap.get(tag);
  if (title) {
    return title;
  }

  // Also try matching without namespace prefix if it's a normalized tag
  if (tag.includes(':')) {
    const pathOnly = tag.split(':').slice(1).join(':');
    for (const [key, value] of childTitlesMap) {
      if (key.endsWith(pathOnly) || key === tag) {
        return value;
      }
    }
  }

  return fallback;
}

export function setTagTitle(element: HTMLElement, tag: string, childTitlesMap: Map<string, string>): void {
  element.textContent = extractLastSegment(tag);
  void getTagTitle(tag, childTitlesMap).then((title) => {
    element.textContent = title;
  });
}
