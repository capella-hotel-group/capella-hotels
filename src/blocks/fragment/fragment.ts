/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import { decorateMain } from '@/app/scripts.js';
import { loadSections } from '@/app/aem.js';

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path: string | null): Promise<HTMLElement | null> {
  let fragmentPath = path;
  if (fragmentPath && fragmentPath.startsWith('/')) {
    fragmentPath = fragmentPath.replace(/(\.plain)?\.html/, '');
    const resp = await fetch(`${fragmentPath}.plain.html`);
    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();

      // reset base path for media to fragment base
      const resetAttributeBase = (tag: string, attr: 'src' | 'srcset') => {
        main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
          const value = elem.getAttribute(attr);
          if (value) {
            (elem as unknown as Record<string, string>)[attr] = new URL(
              value,
              new URL(fragmentPath as string, window.location.href),
            ).href;
          }
        });
      };
      resetAttributeBase('img', 'src');
      resetAttributeBase('source', 'srcset');

      decorateMain(main);
      await loadSections(main);
      return main;
    }
  }
  return null;
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent?.trim() ?? null;
  const fragment = await loadFragment(path);
  if (fragment) {
    const fragmentSection = fragment.querySelector(':scope .section');
    if (fragmentSection) {
      block.classList.add(...fragmentSection.classList);
      block.classList.remove('section');
      block.replaceChildren(...fragmentSection.childNodes);
    }
  }
}
