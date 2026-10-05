import { moveInstrumentation } from '@/app/scripts.js';

export interface LinkFields {
  label: HTMLElement | null;
  url: HTMLElement | null;
  openInNewTab: HTMLElement | null;
}

export interface DecoratedLink {
  anchor: HTMLAnchorElement | null;
  content: Node;
}

export function textOf(element?: Element | null): string {
  return element?.textContent?.trim() || '';
}

export function fieldOf(scope: Element, name: string, fallbackIndex: number): HTMLElement | null {
  return (
    scope.querySelector<HTMLElement>(`[data-aue-prop="${name}"]`) ||
    (scope.children[fallbackIndex]?.firstElementChild as HTMLElement | null) ||
    (scope.children[fallbackIndex] as HTMLElement | null) ||
    null
  );
}

export function propertyOf(scope: Element, name: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(`[data-aue-prop="${name}"]`);
}

export function isEnabled(field: Element | null): boolean {
  return textOf(field).toLowerCase() === 'true';
}

export function hasAuthoringInstrumentation(element: Element | null): element is HTMLElement {
  return !!element && [...element.attributes].some(({ name }) => name.startsWith('data-aue-'));
}

export function decorateLinkFields(fields: LinkFields, fallbackLabel = 'Link'): DecoratedLink {
  const authoredAnchor = fields.url?.matches('a')
    ? (fields.url as HTMLAnchorElement)
    : fields.url?.querySelector<HTMLAnchorElement>('a');
  const href = authoredAnchor?.getAttribute('href')?.trim() || '';
  const labelText = textOf(fields.label) || textOf(authoredAnchor) || fallbackLabel;

  if (fields.openInNewTab) fields.openInNewTab.hidden = true;
  if (!href) return { anchor: null, content: document.createTextNode(labelText) };

  const anchor = authoredAnchor || document.createElement('a');
  const opensNewTab = isEnabled(fields.openInNewTab);
  anchor.setAttribute('href', href);
  anchor.setAttribute('target', opensNewTab ? '_blank' : '_self');
  if (opensNewTab) anchor.setAttribute('rel', 'noopener noreferrer');
  else anchor.removeAttribute('rel');

  if (fields.label && fields.label !== fields.url) moveInstrumentation(fields.label, anchor);
  anchor.textContent = labelText;

  let content: HTMLElement = anchor;
  if (fields.url && fields.url !== anchor) {
    fields.url.replaceChildren(anchor);
    content = fields.url;
  }
  return { anchor, content };
}
