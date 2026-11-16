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

// The root page is always the second URL level: `/en/capella-singapore` in
// production, `/singapore/en` in the current dev content.
const ROOT_DEPTH = 2;
const HOME_SEGMENT = 'home';

// Some sites keep their landing page at `{root}/home`; the root crumb stands for it,
// so the home page shows no trail and is never listed as a separate ancestor.
export function trailPaths(page: PagePath): string[][] {
  const root = ROOT_DEPTH;
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
