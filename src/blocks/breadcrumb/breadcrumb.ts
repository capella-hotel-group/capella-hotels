import { isUniversalEditor } from '@/utils/env.js';
import { resolveTrail, type Crumb } from './lib/labels';
import { parsePagePath, trailPaths } from './lib/path';

const COLLAPSE_AFTER = 3;

function crumbItem({ label, href, current }: Crumb): HTMLLIElement {
  const item = document.createElement('li');
  if (current) {
    const text = document.createElement('span');
    text.setAttribute('aria-current', 'page');
    text.title = label;
    text.textContent = label;
    item.append(text);
  } else {
    const link = document.createElement('a');
    link.href = href;
    link.dataset.testid = 'breadcrumb-link';
    link.textContent = label;
    item.append(link);
  }
  return item;
}

function expandItem(nav: HTMLElement): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'breadcrumb-ellipsis';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '…';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Show full path');
  button.dataset.testid = 'breadcrumb-expand';
  button.addEventListener('click', () => {
    button.setAttribute('aria-expanded', 'true');
    nav.classList.add('is-expanded');
  });
  item.append(button);
  return item;
}

export function renderTrail(crumbs: Crumb[]): HTMLElement {
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');
  nav.dataset.testid = 'breadcrumb';
  const list = document.createElement('ol');
  const collapse = crumbs.length > COLLAPSE_AFTER;

  crumbs.forEach((crumb, index) => {
    const item = crumbItem(crumb);
    if (collapse && index > 0 && index < crumbs.length - 1) item.classList.add('breadcrumb-collapsible');
    list.append(item);
    if (collapse && index === 0) list.append(expandItem(nav));
  });

  nav.append(list);
  return nav;
}

function renderPlaceholder(): HTMLParagraphElement {
  const placeholder = document.createElement('p');
  placeholder.className = 'breadcrumb-placeholder';
  placeholder.textContent = 'Breadcrumb — hidden on top-level pages';
  return placeholder;
}

export default async function decorate(block: HTMLElement, pathname = window.location.pathname): Promise<void> {
  block.classList.add('is-loading');
  const page = parsePagePath(pathname);
  const trail = trailPaths(page);
  const crumbs = trail.length ? await resolveTrail(trail, page.isAuthor) : [];

  if (crumbs.length >= 2) block.replaceChildren(renderTrail(crumbs));
  else block.replaceChildren(...(isUniversalEditor() ? [renderPlaceholder()] : []));
  block.hidden = !block.childElementCount;
  block.classList.remove('is-loading');
}
