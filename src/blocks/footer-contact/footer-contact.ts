import { moveInstrumentation } from '@/app/scripts.js';

const cellOf = (row?: Element | null) => row?.firstElementChild ?? null;

/**
 * loads and decorates the "Footer Contact" block
 * @param {Element} block The footer-contact block element
 */
export default function decorate(block: HTMLElement): void {
  // Own field order: title (row 0), contactContent (row 1, richtext).
  const rows = [...block.children];
  const titleCell = cellOf(rows[0]);
  const contentCell = cellOf(rows[1]);

  const heading = document.createElement('p');
  heading.className = 'footer-heading';
  heading.textContent = titleCell?.textContent?.trim() || 'Contact Us';
  if (titleCell) moveInstrumentation(titleCell, heading);

  const copy = document.createElement('div');
  if (contentCell) {
    moveInstrumentation(contentCell, copy);
    [...contentCell.childNodes].forEach((node) => copy.append(node.cloneNode(true)));
  }

  // renamed from `footer-contact` (the xwalk block name) to the leaf class footer.css expects —
  // footer.ts wraps this together with `.footer-social` under its own `.footer-contact` group
  block.className = 'footer-contact-info';
  block.replaceChildren(heading, copy);
}
