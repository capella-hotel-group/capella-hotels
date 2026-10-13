export const NEW_TAB_LABEL = 'opens in a new tab';

export function createFooterLink(href: string, openInNewTab: boolean): HTMLAnchorElement | HTMLSpanElement {
  if (!href) return document.createElement('span');
  const anchor = document.createElement('a');
  anchor.href = href;
  if (openInNewTab) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

export function newTabHint(): HTMLSpanElement {
  const hint = document.createElement('span');
  hint.className = 'footer-sr-only';
  hint.textContent = ` (${NEW_TAB_LABEL})`;
  return hint;
}

export function createTextLink(
  label: string,
  href: string,
  openInNewTab: boolean,
): HTMLAnchorElement | HTMLSpanElement {
  const link = createFooterLink(href, openInNewTab);
  link.textContent = label;
  if (href && openInNewTab) link.append(newTabHint());
  return link;
}
