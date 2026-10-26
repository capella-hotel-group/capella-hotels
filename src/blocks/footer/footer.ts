import { getMetadata } from '@/app/aem.js';
import { loadFragment } from '@/blocks/fragment/fragment.js';
import {
  moveInstrumentation,
  SUPPORTED_SITES,
  DEFAULT_SITE_SEGMENT,
  LANG_MAP,
  VALID_LANG_PRIMARIES,
} from '@/app/scripts.js';

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

function getHierarchicalFooterPaths(): string[] {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const paths: string[] = [];

  const siteIndex = segments.findIndex((segment) => SUPPORTED_SITES.includes(segment));
  if (siteIndex !== -1) {
    const nextSegment = segments[siteIndex + 1]?.toLowerCase() ?? '';
    const hasLanguage = !!(LANG_MAP[nextSegment] || VALID_LANG_PRIMARIES.has(nextSegment.split('-')[0] ?? ''));
    const scopeDepth = siteIndex + 1 + Number(hasLanguage);

    // A page below its site/language root can inherit from its sibling and ancestors.
    for (let depth = segments.length - 1; depth >= scopeDepth; depth -= 1) {
      paths.push(`/${[...segments.slice(0, depth), 'footer'].join('/')}`);
    }

    // Site and language landing pages inherit from the content root, not a child footer.
    paths.push(`/${[...segments.slice(0, siteIndex), 'footer'].join('/')}`);
    return paths;
  }

  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    paths.push(`/${[...segments.slice(0, depth), 'footer'].join('/')}`);
  }
  return paths;
}

function applyBackgroundTheme(block: HTMLElement, themeBlock: Element | null): void {
  const theme = themeBlock?.children[0]?.firstElementChild?.textContent?.trim() || '';
  const isGlobalEn = getFragmentBasePath() === '/global/en';
  block.classList.toggle('footer-theme-global-en', isGlobalEn);
  block.classList.toggle('footer-theme-clean-white', !isGlobalEn && theme === 'clean-white');
}

function footerField(block: Element, name: string, rowIndex: number): Element | null {
  const instrumentedField = block.querySelector(`[data-aue-prop="${name}"]`);
  if (instrumentedField) return instrumentedField;
  const row = block.children[rowIndex];
  return row?.lastElementChild || row || null;
}

function buildBrandLogo(footerBlock: Element | null): HTMLElement | null {
  if (!footerBlock) return null;
  const showValue = footerField(footerBlock, 'showBrandLogo', 1)?.textContent?.trim().toLowerCase();
  if (showValue !== 'true') return null;

  const assetField = footerField(footerBlock, 'brandLogo', 2);
  const picture = assetField?.querySelector('picture') || (assetField?.matches('picture') ? assetField : null);
  if (!picture) return null;

  const altText = footerField(footerBlock, 'brandLogoAltText', 3)?.textContent?.trim() || '';
  const image = picture.querySelector('img');
  if (image) image.alt = altText;

  const logo = document.createElement('div');
  logo.className = 'footer-brand-logo';
  if (assetField) moveInstrumentation(assetField, logo);
  logo.append(picture);
  return logo;
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

  const footerPaths = new Set([
    footerPath,
    ...getHierarchicalFooterPaths(),
    `${getFragmentBasePath()}/footer`,
    '/footer',
  ]);
  let fragment: HTMLElement | null = null;
  for (const path of footerPaths) {
    if (path) fragment = await loadFragment(path);
    if (fragment) break;
  }
  if (!fragment) return;

  applyBackgroundTheme(block.closest('footer') as HTMLElement, fragment.querySelector('.footer'));
  const brandLogo = buildBrandLogo(fragment.querySelector('.footer'));

  // Each footer-* block decorates itself into the leaf class footer.css expects (see its own
  // .ts file); this only assembles the already-built pieces into the shared layout groups.
  const navGroup = fragment.querySelector('.footer-nav-columns');
  const contactInfo = fragment.querySelector('.footer-contact-info');
  const social = fragment.querySelector('.footer-social');
  const legalGroup = fragment.querySelector('.footer-legal');
  const newsletterBlock = fragment.querySelector('.newsletter-form');

  const contactGroup = buildGroup('footer-contact', [contactInfo]);
  const newsletterGroup = buildGroup('footer-newsletter', [newsletterBlock]);

  const inner = document.createElement('div');
  inner.className = 'footer-inner';
  if (brandLogo) {
    inner.classList.add('footer-inner-has-logo');
    inner.append(brandLogo);
  }

  // DOM order = screen reader + Tab order: contact, social, key links, newsletter, legal.
  // Visual placement at every breakpoint is set by footer.css (grid areas / flex order).
  const groups: Array<{ name: string; element: Element | null }> = [
    { name: 'contact', element: contactGroup },
    { name: 'social', element: social },
    { name: 'nav', element: navGroup },
    { name: 'newsletter', element: newsletterGroup },
    { name: 'legal', element: legalGroup },
  ];

  // Dividers keep their visual-order meaning (data-after) that footer.css keys on:
  // contact | nav | newsletter | social | legal.
  const visualOrder = ['contact', 'nav', 'newsletter', 'social', 'legal'];
  const presentNames = visualOrder.filter((name) => groups.find((group) => group.name === name)?.element);
  const dividerAfter = new Set(presentNames.slice(0, -1));

  groups.forEach(({ name, element }) => {
    if (!element) return;
    inner.append(element);
    if (dividerAfter.has(name)) {
      const divider = document.createElement('div');
      divider.className = 'footer-divider';
      divider.dataset.after = name;
      inner.append(divider);
    }
  });

  block.replaceChildren(inner);
}
