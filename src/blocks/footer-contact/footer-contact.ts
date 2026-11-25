import { moveInstrumentation } from '@/app/scripts.js';

const cellOf = (row?: Element | null) => row?.firstElementChild ?? null;

// The domain is an inline-block (see CSS), so the browser prefers breaking before it; its
// own <wbr> before the TLD is used only when the domain alone is wider than the column.
function createDomain(domain: string): HTMLElement {
  const span = document.createElement('span');
  span.className = 'footer-contact-email-domain';
  const dot = domain.lastIndexOf('.');
  if (dot > 0) span.append(domain.slice(0, dot), document.createElement('wbr'), domain.slice(dot));
  else span.append(domain);
  return span;
}

const EMAIL_TEXT = /^(\s*)([^\s@]+)@([^\s@]+)(\s*)$/;
const PHONE_TEXT = /^[+\d\s().-]*\d[+\d\s().-]*$/;

// includes text nested in author formatting such as <strong>
function textNodesOf(link: Element): Text[] {
  const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

// The desktop contact column can be narrower than an email address. <wbr> before each "." of the
// local part, after "@" and (as a last resort) before the TLD lets it wrap at natural points
// ("reservations" / ".singapore@" / "capellahotels" / ".com"); the CSS uses
// `overflow-wrap: normal`, so words are never split mid-letter. Only link text that is exactly
// one address is touched.
function addEmailBreakOpportunities(root: Element): void {
  root.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
    textNodesOf(link).forEach((node) => {
      const match = EMAIL_TEXT.exec(node.textContent ?? '');
      if (!match) return;
      // all groups always participate in EMAIL_TEXT; defaults only satisfy noUncheckedIndexedAccess
      const [, before = '', local = '', domain = '', after = ''] = match;
      // <bdi dir="ltr"> keeps "@"/"." in place on RTL pages (docs/aem-eds-arabic-css-rtl-standards.md)
      const email = document.createElement('bdi');
      email.className = 'footer-contact-email';
      email.dir = 'ltr';
      const localParts = local
        .split('.')
        .flatMap((part, i) => (i ? [document.createElement('wbr'), `.${part}`] : [part]));
      email.append(...localParts, '@', document.createElement('wbr'), createDomain(domain));
      node.replaceWith(before, email, after);
    });
  });
}

// NBSP instead of `white-space: nowrap`: digit groups stay together, while descriptive link text
// ("Call us") still wraps normally.
function keepPhoneNumbersTogether(root: Element): void {
  root.querySelectorAll('a[href^="tel:"]').forEach((link) => {
    textNodesOf(link).forEach((node) => {
      const text = node.textContent ?? '';
      if (PHONE_TEXT.test(text.trim())) node.textContent = text.trim().replace(/\s+/g, '\u00a0');
    });
  });
}

/**
 * loads and decorates the "Footer Contact" block
 * @param {Element} block The footer-contact block element
 */
export default function decorate(block: HTMLElement): void {
  // Own field order: title (row 0), contactContent (row 1, richtext).
  const rows = [...block.children];
  const titleCell = cellOf(rows[0]);
  const contentCell = cellOf(rows[1]);

  const heading = document.createElement('h2');
  heading.className = 'footer-heading';
  heading.textContent = titleCell?.textContent?.trim() || 'Contact Us';
  if (titleCell) moveInstrumentation(titleCell, heading);

  const copy = document.createElement('div');
  if (contentCell) {
    moveInstrumentation(contentCell, copy);
    [...contentCell.childNodes].forEach((node) => copy.append(node.cloneNode(true)));
    addEmailBreakOpportunities(copy);
    keepPhoneNumbersTogether(copy);
  }

  // renamed from `footer-contact` (the xwalk block name) to the leaf class footer.css expects —
  // footer.ts wraps this together with `.footer-social` under its own `.footer-contact` group
  block.className = 'footer-contact-info';
  block.replaceChildren(heading, copy);
}
