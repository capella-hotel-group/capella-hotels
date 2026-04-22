import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location.href).pathname : '/footer';

  const fragment = await loadFragment(footerPath);
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
