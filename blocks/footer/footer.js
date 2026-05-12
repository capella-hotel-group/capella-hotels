import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import {
  moveInstrumentation, SUPPORTED_SITES, LANG_MAP, VALID_LANG_PRIMARIES,
} from '../../scripts/scripts.js';

function getFragmentBasePath() {
  const segments = window.location.pathname.split('/').filter(Boolean);
  const siteIdx = segments.findIndex((s) => SUPPORTED_SITES.includes(s));
  const site = siteIdx !== -1 ? segments[siteIdx] : 'global';
  const afterSite = siteIdx !== -1 ? segments.slice(siteIdx + 1) : segments;
  const rawLang = afterSite[0]?.toLowerCase() ?? '';
  const isLang = rawLang && (LANG_MAP[rawLang] || VALID_LANG_PRIMARIES.has(rawLang.split('-')[0]));
  const lang = isLang ? rawLang : '';
  const parts = [site, lang].filter(Boolean);
  return parts.length ? `/${parts.join('/')}` : '';
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location.href).pathname : null;

  // Option 1: metadata-driven path. Option 2: compute from URL site + lang segments.
  let fragment = footerPath ? await loadFragment(footerPath) : null;
  if (!fragment) fragment = await loadFragment(`${getFragmentBasePath()}/footer`);
  if (!fragment) return;

  // Collect all <ul> elements from every section in the fragment
  const lists = [...fragment.querySelectorAll('ul')];

  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  lists.forEach((srcList) => {
    moveInstrumentation(srcList, inner);

    // Each <li> becomes a .footer-item
    const items = [...srcList.querySelectorAll('li')];
    items.forEach((srcItem) => {
      const srcA = srcItem.querySelector('a');

      const item = document.createElement('p');
      item.className = 'footer-item';
      moveInstrumentation(srcItem, item);

      if (srcA) {
        const a = document.createElement('a');
        a.href = srcA.href;
        if (srcA.target) a.target = srcA.target;
        a.rel = 'noopener noreferrer';
        a.textContent = srcA.textContent.trim();
        moveInstrumentation(srcA, a);
        item.append(a);
      } else {
        item.textContent = srcItem.textContent.trim();
      }

      inner.append(item);
    });
  });

  block.replaceChildren(inner);
}
