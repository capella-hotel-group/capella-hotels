import { deslug, homeOf, toHref } from './path';

export interface Crumb {
  label: string;
  href: string;
  current: boolean;
}

function metaContent(doc: Document, name: string): string {
  return doc.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content.trim() ?? '';
}

export function labelFromDocument(doc: Document): string {
  return metaContent(doc, 'breadcrumbtitle') || doc.title.trim();
}

const FETCH_TIMEOUT_MS = 5000;

async function fetchLabel(href: string, fetchImpl: typeof fetch): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(href, { signal: controller.signal });
    if (!response.ok) return '';
    return labelFromDocument(new DOMParser().parseFromString(await response.text(), 'text/html'));
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

async function ancestorCrumb(segments: string[], isAuthor: boolean, fetchImpl: typeof fetch): Promise<Crumb> {
  const href = toHref(segments, isAuthor);
  return { label: await fetchLabel(href, fetchImpl), href, current: false };
}

async function rootCrumb(root: string[], isAuthor: boolean, fetchImpl: typeof fetch): Promise<Crumb> {
  const home = await ancestorCrumb(homeOf(root), isAuthor, fetchImpl);
  return home.label ? home : ancestorCrumb(root, isAuthor, fetchImpl);
}

export async function resolveTrail(
  trail: string[][],
  isAuthor: boolean,
  doc: Document = document,
  fetchImpl: typeof fetch = fetch,
): Promise<Crumb[]> {
  const ancestors = trail.slice(0, -1);
  const current = trail[trail.length - 1];
  if (!current) return [];

  const ancestorCrumbs = await Promise.all(
    ancestors.map((segments, index) =>
      index === 0 ? rootCrumb(segments, isAuthor, fetchImpl) : ancestorCrumb(segments, isAuthor, fetchImpl),
    ),
  );
  const currentCrumb: Crumb = {
    label: labelFromDocument(doc) || deslug(current[current.length - 1] ?? ''),
    href: toHref(current, isAuthor),
    current: true,
  };
  return [...ancestorCrumbs.filter((crumb) => crumb.label), currentCrumb];
}
