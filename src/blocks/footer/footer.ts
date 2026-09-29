import { getMetadata } from '@/app/aem.js';
import { loadFragment } from '@/blocks/fragment/fragment.js';
import { SUPPORTED_SITES, DEFAULT_SITE_SEGMENT, LANG_MAP, VALID_LANG_PRIMARIES } from '@/app/scripts.js';

function getFragmentBasePath(): string {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const siteIdx = segments.findIndex((s) => SUPPORTED_SITES.includes(s));
  const site = siteIdx !== -1 ? segments[siteIdx] : DEFAULT_SITE_SEGMENT;
  const afterSite = siteIdx !== -1 ? segments.slice(siteIdx + 1) : segments;
  const rawLang = afterSite[0]?.toLowerCase() ?? '';
  const isLang = rawLang && (LANG_MAP[rawLang] || VALID_LANG_PRIMARIES.has(rawLang.split('-')[0] ?? ''));
  const lang = isLang ? rawLang : '';
  const parts = [site, lang].filter(Boolean);
  return parts.length ? `/${parts.join('/')}` : '';
}

function applyBackgroundTheme(block: HTMLElement, themeBlock: Element | null): void {
  const theme = themeBlock?.children[0]?.firstElementChild?.textContent?.trim() || '';
  block.classList.toggle('footer-theme-clean-white', theme === 'clean-white');
}

/** Wraps whichever of the given (already-decorated) pieces are present under one group class. */
function buildGroup(className: string, parts: Array<Element | null>): HTMLDivElement | null {
  const present = parts.filter((part): part is Element => !!part);
  if (!present.length) return null;
  const group = document.createElement('div');
  group.className = className;
  group.append(...present);
  return group;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block: HTMLElement): Promise<void> {
  // The site-wide synthetic wrapper (scripts.ts's loadFooter) lives inside a real <footer>
  // landmark; an authored "Footer" (theme) block placed inside the /footer fragment itself
  // shares the same block name and would otherwise recurse back into loadFragment('/footer').
  // Only the real page wrapper builds the fragment UI — the nested one is read, not decorated.
  if (!block.closest('footer')) return;

  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location.href).pathname : null;

  let fragment = footerPath ? await loadFragment(footerPath) : null;
  if (!fragment) fragment = await loadFragment(`${getFragmentBasePath()}/footer`);
  if (!fragment) return;

  applyBackgroundTheme(block.closest('footer') as HTMLElement, fragment.querySelector('.footer'));

  // Each footer-* block decorates itself into the leaf class footer.css expects (see its own
  // .ts file); this only assembles the already-built pieces into the shared layout groups.
  const navGroup = fragment.querySelector('.footer-nav-columns');
  const contactInfo = fragment.querySelector('.footer-contact-info');
  const social = fragment.querySelector('.footer-social');
  const legalGroup = fragment.querySelector('.footer-legal');
  const newsletterBlock = fragment.querySelector('.newsletter-form');

  const contactGroup = buildGroup('footer-contact', [contactInfo, social]);
  const newsletterGroup = buildGroup('footer-newsletter', [newsletterBlock]);

  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  const groups: Array<{ name: string; element: Element | null }> = [
    { name: 'nav', element: navGroup },
    { name: 'newsletter', element: newsletterGroup },
    { name: 'contact', element: contactGroup },
    { name: 'legal', element: legalGroup },
  ];

  let lastSlot: string | null = null;
  groups.forEach(({ name, element }) => {
    if (!element) return;
    if (lastSlot) {
      const divider = document.createElement('div');
      divider.className = 'footer-divider';
      divider.dataset.after = lastSlot;
      inner.append(divider);
    }
    inner.append(element);
    lastSlot = name;
  });

  block.replaceChildren(inner);
}
