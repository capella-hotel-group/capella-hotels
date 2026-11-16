import { LANG_MAP, VALID_LANG_PRIMARIES } from '@/app/scripts.js';

const AUTHOR_ROOT = '/content/capella-hotels';

export interface PagePath {
  segments: string[];
  isAuthor: boolean;
}

export function parsePagePath(pathname: string): PagePath {
  const isAuthor =
    pathname === AUTHOR_ROOT || pathname.startsWith(`${AUTHOR_ROOT}/`) || pathname === `${AUTHOR_ROOT}.html`;
  const path = (isAuthor ? pathname.slice(AUTHOR_ROOT.length) : pathname).replace(/\.html$/i, '');
  return { segments: path.split('/').filter(Boolean), isAuthor };
}

function isLanguage(segment: string): boolean {
  const lower = segment.toLowerCase();
  return Boolean(LANG_MAP[lower]) || VALID_LANG_PRIMARIES.has(lower.split('-')[0] ?? '');
}

export function rootDepth(segments: string[]): number {
  if (!segments.length) return 0;
  const index = segments.findIndex(isLanguage);
  return index === -1 ? 1 : index + 1;
}

const HOME_SEGMENT = 'home';

// The site's landing page lives at `{root}/home`; the root crumb stands for it,
// so the home page shows no trail and is never listed as a separate ancestor.
export function trailPaths(page: PagePath): string[][] {
  const root = rootDepth(page.segments);
  if (page.segments.length <= root) return [];
  const isUnderHome = page.segments[root]?.toLowerCase() === HOME_SEGMENT;
  if (isUnderHome && page.segments.length === root + 1) return [];
  const trail = page.segments.slice(root - 1).map((_, index) => page.segments.slice(0, root + index));
  return isUnderHome ? trail.filter((_, index) => index !== 1) : trail;
}

export function homeOf(root: string[]): string[] {
  return [...root, HOME_SEGMENT];
}

export function toHref(segments: string[], isAuthor: boolean): string {
  const path = `/${segments.join('/')}`;
  return isAuthor ? `${AUTHOR_ROOT}${path}.html` : path;
}

export function deslug(segment: string): string {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
