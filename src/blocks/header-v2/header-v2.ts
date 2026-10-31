// Header v2: renders the site header from structured /nav content (nav-top block, nav-category
// sections, nav-region blocks). Self-contained; reuses only the existing header CSS class names.
import { createOptimizedPicture, loadCSS } from '@/app/aem.js';
import { getPageLang, LANG_MAP, moveInstrumentation, VALID_LANG_PRIMARIES } from '@/app/scripts.js';
import { resolveDAMUrl } from '@/utils/env';

interface Link {
  label: string;
  note: string;
  href: string;
  newTab: boolean;
}

interface Region {
  label: string;
  merge: boolean;
  links: Link[];
  source: Element;
}

interface Promo {
  picture: HTMLPictureElement | null;
  ctaLabel: string;
  ctaHref: string;
  newTab: boolean;
}

interface Category {
  label: string;
  href: string;
  regions: Region[];
  promo: Promo | null;
  source: Element;
}

interface Language {
  label: string;
  short: string;
  code: string;
  href: string;
  newTab: boolean;
}

interface HeaderModel {
  languages: Language[];
  active: Language;
  categories: Category[];
  logo: { src: string; activeSrc: string; alt: string; href: string; newTab: boolean };
  cta: { label: string; href: string; newTab: boolean };
  menu: { open: string; close: string };
  back: { label: string; href: string } | null;
  source: Element;
}

const NEW_TAB_LABEL = 'opens in a new tab';
const MAIN_NAV_LABEL = 'Main navigation';
const LANGUAGE_LABEL = 'Language';
const PANEL_ID = 'header-menu-panel';
const BACK_LABEL = 'BACK';
// A merge-columns region joins the next one only when both fit in one row of this many slots.
const MERGE_ROW_COLUMNS = 4;
// Matches the promo opacity transition in header.css.
const PROMO_SWAP_MS = 150;
// nav-top row order, fixed by the model (empty fields keep their row in delivered markup).
const TOP_ROW = { logo: 0, logoActive: 1, logoSimple: 2, home: 3, menu: 4, cta: 5, back: 6, languages: 7 };
const AUE_CONTENT_EVENTS = [
  'aue:content-patch',
  'aue:content-update',
  'aue:content-add',
  'aue:content-move',
  'aue:content-remove',
  'aue:content-copy',
];

/* ---------- reading ---------- */

function textOf(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? '';
}

function isTrue(el: Element | null | undefined): boolean {
  if (!el) return false;
  const checkbox = el.matches('input[type="checkbox"]') ? el : el.querySelector('input[type="checkbox"]');
  if (checkbox) return (checkbox as HTMLInputElement).checked;
  return textOf(el).toLowerCase() === 'true';
}

// Leaf text elements of a cell/entry, excluding link text.
function plainTexts(el: Element): Element[] {
  return [...el.querySelectorAll('p, div')].filter(
    (node) => !node.querySelector('p, div, a, picture') && !node.closest('a') && textOf(node),
  );
}

function boolText(el: Element | null | undefined): Element | undefined {
  if (!el) return undefined;
  return plainTexts(el).find((node) => ['true', 'false'].includes(textOf(node).toLowerCase()));
}

// A link authored without text is delivered with its URL/AEM path as the text.
function anchorLabel(anchor: Element | null | undefined): string {
  const text = textOf(anchor);
  return /^(\/|https?:)/.test(text) ? '' : text;
}

// Composite multi-field entries: groups separated by <hr>, or <li> items when each entry is one element.
function multiFieldEntries(field: Element | null | undefined): Element[] {
  if (!field) return [];
  const firstHr = field.querySelector('hr');
  if (!firstHr) return [...field.querySelectorAll('li')];
  const groups: Element[] = [];
  let group = document.createElement('div');
  [...(firstHr.parentElement ?? field).childNodes].forEach((node) => {
    if (node instanceof HTMLElement && node.tagName === 'HR') {
      if (textOf(group)) groups.push(group);
      group = document.createElement('div');
    } else {
      group.append(node.cloneNode(true));
    }
  });
  if (textOf(group)) groups.push(group);
  return groups;
}

// Entry = label text + optional link + optional note + new-tab boolean.
// (Languages use link + linkText, which collapse into one <a>.)
function readLink(entry: Element): Link {
  const anchor = entry.querySelector('a[href]');
  const flag = boolText(entry);
  const texts = plainTexts(entry)
    .filter((node) => node !== flag)
    .map(textOf);
  const label = anchorLabel(anchor) || texts.shift() || '';
  return { label, note: texts[0] ?? '', href: anchor?.getAttribute('href') ?? '', newTab: isTrue(flag) };
}

// BCP 47 tag from the first language segment of a URL (mirrors getPageLang).
function langFromHref(href: string): string {
  const segment = (href.split(/[?#]/)[0] ?? '')
    .split('/')
    .map((part) => part.toLowerCase())
    .find((part) => LANG_MAP[part] || VALID_LANG_PRIMARIES.has(part.split('-')[0] ?? ''));
  if (!segment) return '';
  const mapped = LANG_MAP[segment];
  if (mapped) return mapped;
  const [primary = '', region] = segment.split('-');
  return region ? `${primary}-${region.toUpperCase()}` : primary;
}

function readLanguages(field: Element | null | undefined): Language[] {
  return multiFieldEntries(field)
    .map(readLink)
    .filter((link) => link.href && link.label)
    .map(({ label, note: shortLabel, href, newTab }) => {
      const code = langFromHref(href);
      const short = shortLabel || (code.split('-')[0] || label.slice(0, 2)).toUpperCase();
      return { label, href, newTab, code, short };
    });
}

function findActiveLanguage(languages: Language[]): Language | undefined {
  const pageLang = getPageLang().toLowerCase();
  const codes = languages.map((lang) => lang.code.toLowerCase());
  const exact = codes.indexOf(pageLang);
  const index = exact !== -1 ? exact : codes.findIndex((code) => code && code.split('-')[0] === pageLang.split('-')[0]);
  return languages[index];
}

// nav-region-rte: one list item (or paragraph) per link, default RTE (delivery keeps only text, href and title).
function readRteLinks(field: Element | null | undefined): Link[] {
  if (!field) return [];
  const items = field.querySelector('li') ? [...field.querySelectorAll('li')] : [...field.querySelectorAll('p')];
  return items
    .map((item) => ({
      label: textOf(item),
      note: '',
      href: item.querySelector('a[href]')?.getAttribute('href') ?? '',
      newTab: false,
    }))
    .filter((link) => link.label);
}

function readRegion(block: Element): Region {
  const cells = [...block.children].map((row) => row.firstElementChild);
  return {
    label: textOf(cells[0]),
    merge: isTrue(cells[1]),
    links: block.classList.contains('nav-region-rte')
      ? readRteLinks(cells[2])
      : multiFieldEntries(cells[2])
          .map(readLink)
          .filter((link) => link.label),
    source: block,
  };
}

// DAM references (Universal Editor) can't use the EDS image optimizer; delivered media can.
function buildPromoPicture(src: string, alt: string): HTMLPictureElement {
  let picture: HTMLPictureElement;
  if (src.includes('/content/dam/')) {
    picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = resolveDAMUrl(src);
    img.alt = alt;
    picture.append(img);
  } else {
    picture = createOptimizedPicture(src, alt);
  }
  // A detached <img> with src still downloads; the src is restored when the category is shown.
  picture.querySelectorAll('img').forEach((img) => {
    img.dataset.src = img.getAttribute('src') ?? '';
    img.removeAttribute('src');
  });
  return picture;
}

// Section metadata arrives as lowercased data-* attributes (see decorateSections).
function readCategory(section: HTMLElement): Category {
  const data = section.dataset;
  const imageSrc = data.promoimage ?? '';
  const ctaLabel = data.promoctalabel ?? '';
  const ctaHref = data.promolink ?? '';
  return {
    label: data.title ?? '',
    href: data.link ?? '',
    regions: [...section.querySelectorAll('.nav-region, .nav-region-rte')].map(readRegion),
    promo:
      imageSrc || (ctaLabel && ctaHref)
        ? {
            picture: imageSrc ? buildPromoPicture(imageSrc, data.promoimagedescription ?? '') : null,
            ctaLabel,
            ctaHref,
            newTab: data.promoopeninnewtab === 'true',
          }
        : null,
    source: section,
  };
}

// Authoring keeps every authored category (even empty or new ones) so each stays visible and selectable.
function readModel(root: Element, authoring: boolean): HeaderModel | null {
  const top = root.querySelector('.nav-top');
  if (!top) return null;
  const cells = [...top.children].map((row) => row.firstElementChild ?? row);
  const cell = (index: number) => cells[index] ?? null;
  const img = (index: number) => cell(index)?.querySelector('img') ?? null;

  const languages = readLanguages(cell(TOP_ROW.languages));
  const categories = [...root.querySelectorAll<HTMLElement>(':scope > .section')]
    .filter((section) => section.dataset.title || (authoring && section.dataset.aueModel === 'nav-category'))
    .map(readCategory)
    .filter((category) => authoring || category.href || category.regions.some((region) => region.links.length));
  if (authoring) {
    categories.forEach((category) => {
      category.label ||= '(Category title)';
    });
  } else if (!languages.length || !categories.length) {
    return null;
  }

  const fallbackLanguage: Language = { label: 'English', short: 'EN', code: 'en', href: '/', newTab: false };
  const active = findActiveLanguage(languages) ?? languages[0] ?? fallbackLanguage;
  const home = cell(TOP_ROW.home);
  const cta = cell(TOP_ROW.cta);
  const ctaAnchor = cta?.querySelector('a[href]');
  const backAnchor = cell(TOP_ROW.back)?.querySelector('a[href]');
  const menuTexts = cell(TOP_ROW.menu) ? plainTexts(cell(TOP_ROW.menu) as Element).map(textOf) : [];

  return {
    languages,
    active,
    categories,
    logo: {
      src: img(TOP_ROW.logo)?.getAttribute('src') ?? '',
      activeSrc: img(TOP_ROW.logoActive)?.getAttribute('src') ?? '',
      alt: img(TOP_ROW.logo)?.getAttribute('alt') ?? '',
      href: home?.querySelector('a[href]')?.getAttribute('href') || active.href,
      newTab: isTrue(boolText(home)),
    },
    cta: { label: anchorLabel(ctaAnchor), href: ctaAnchor?.getAttribute('href') ?? '', newTab: isTrue(boolText(cta)) },
    menu: { open: menuTexts[0] || 'Menu', close: menuTexts[1] || 'Close' },
    back:
      top.classList.contains('destination') && backAnchor
        ? { label: anchorLabel(backAnchor) || BACK_LABEL, href: backAnchor.getAttribute('href') ?? '' }
        : null,
    source: top,
  };
}

/* ---------- rendering ---------- */

function setNewTab(anchor: HTMLAnchorElement, newTab: boolean): void {
  anchor.querySelector(':scope > .header-sr-only')?.remove();
  if (!newTab) {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    return;
  }
  anchor.target = '_blank';
  anchor.rel = 'noopener';
  const name = anchor.getAttribute('aria-label');
  if (name) {
    anchor.setAttribute('aria-label', `${name} (${NEW_TAB_LABEL})`);
    return;
  }
  const hint = document.createElement('span');
  hint.className = 'header-sr-only';
  hint.textContent = ` (${NEW_TAB_LABEL})`;
  anchor.append(hint);
}

function link(href: string, label: string, newTab: boolean, className = ''): HTMLAnchorElement {
  const anchor = document.createElement('a');
  if (className) anchor.className = className;
  anchor.href = href;
  anchor.textContent = label;
  setNewTab(anchor, newTab);
  return anchor;
}

let langZoneCount = 0;

function buildLangZone(languages: Language[], active: Language): HTMLDivElement {
  langZoneCount += 1;
  const zone = document.createElement('div');
  zone.className = 'header-lang';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'header-lang-trigger';
  trigger.setAttribute('aria-label', `${LANGUAGE_LABEL}: ${active.short}`);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.dataset.testid = 'header-lang-trigger';
  const label = document.createElement('span');
  label.className = 'header-lang-label';
  label.textContent = active.short;
  const icon = document.createElement('span');
  icon.className = 'header-lang-icon';
  icon.setAttribute('aria-hidden', 'true');
  trigger.append(label, icon);

  const dropdown = document.createElement('ul');
  dropdown.className = 'header-lang-dropdown';
  dropdown.id = `header-lang-dropdown-${langZoneCount}`;
  trigger.setAttribute('aria-controls', dropdown.id);

  const close = () => {
    trigger.setAttribute('aria-expanded', 'false');
    dropdown.classList.remove('is-open');
  };
  const open = () => {
    trigger.setAttribute('aria-expanded', 'true');
    dropdown.classList.add('is-open');
  };
  const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';

  languages.forEach((lang) => {
    const item = document.createElement('li');
    const anchor = link(lang.href, lang.label, lang.newTab);
    anchor.dataset.testid = 'header-lang-option';
    if (lang === active) anchor.setAttribute('aria-current', 'true');
    if (lang.code) {
      anchor.lang = lang.code;
      anchor.hreflang = lang.code;
    }
    anchor.addEventListener('click', close);
    item.append(anchor);
    dropdown.append(item);
  });
  zone.append(trigger, dropdown);

  trigger.addEventListener('click', () => (isOpen() ? close() : open()));
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      close();
      trigger.focus();
      event.stopPropagation();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!isOpen()) open();
    const options = [...dropdown.querySelectorAll<HTMLAnchorElement>('a')];
    const current = options.indexOf(document.activeElement as HTMLAnchorElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next =
      current === -1 ? (step === 1 ? 0 : options.length - 1) : (current + step + options.length) % options.length;
    options[next]?.focus();
  });
  zone.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !zone.contains(event.relatedTarget as Node)) close();
  });
  document.addEventListener('click', (event) => {
    if (!zone.contains(event.target as Node)) close();
  });
  return zone;
}

function buildLogo(logo: HeaderModel['logo']): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.className = 'header-logo';
  anchor.href = logo.href;
  anchor.setAttribute('aria-label', logo.alt || 'Capella Hotels - Home');
  [
    [logo.src, 'header-logo-img-default'],
    [logo.activeSrc !== logo.src ? logo.activeSrc : '', 'header-logo-img-active'],
  ].forEach(([src, className]) => {
    if (!src) return;
    const img = document.createElement('img');
    img.className = className as string;
    img.src = src as string;
    img.alt = '';
    anchor.append(img);
  });
  setNewTab(anchor, logo.newTab);
  return anchor;
}

function buildToggle(menu: HeaderModel['menu']): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'header-menu-toggle';
  button.setAttribute('aria-label', menu.open);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', PANEL_ID);
  button.dataset.testid = 'header-menu-toggle';
  const icon = document.createElement('span');
  icon.className = 'header-menu-icon';
  icon.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'header-menu-toggle-label';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = menu.close;
  button.append(icon, label);
  return button;
}

// A link with no URL renders as a disabled item, never dropped.
function buildNavLink(item: Link): HTMLElement {
  const el = item.href ? link(item.href, '', false) : document.createElement('span');
  if (!item.href) el.className = 'nav-link is-disabled';
  const label = document.createElement('span');
  label.className = 'nav-link-label';
  label.textContent = item.label;
  el.prepend(label);
  if (item.note) {
    const note = document.createElement('span');
    note.className = 'nav-link-note';
    note.textContent = item.note;
    label.after(note);
  }
  if (item.href) setNewTab(el as HTMLAnchorElement, item.newTab);
  return el;
}

let regionLabelCount = 0;

function buildRegion(region: Region, authoring: boolean): HTMLElement {
  // In authoring the authored block itself becomes the region, so the content tree is unchanged.
  const el = authoring ? (region.source as HTMLElement) : document.createElement('div');
  if (authoring) el.replaceChildren();
  else moveInstrumentation(region.source, el);
  el.classList.add('header-menu-region', 'header-menu-block');
  const grid = document.createElement('ul');
  grid.className = 'header-menu-link-grid';
  if (region.label) {
    regionLabelCount += 1;
    const heading = document.createElement('p');
    heading.className = 'header-menu-region-label';
    heading.id = `header-menu-region-label-${regionLabelCount}`;
    heading.textContent = region.label;
    grid.setAttribute('aria-labelledby', heading.id);
    el.append(heading);
  }
  region.links.forEach((item) => {
    const li = document.createElement('li');
    li.append(buildNavLink(item));
    grid.append(li);
  });
  el.append(grid);
  return el;
}

interface MergeSlot {
  region: Region;
  label: string;
  link: Link | null;
}

// A merged region pair flows as fixed-width slots: label + first link, then link-only slots.
function mergeSlots(regions: Region[]): MergeSlot[] {
  return regions.flatMap((region): MergeSlot[] =>
    region.links.length
      ? region.links.map((item, i) => ({ region, label: i === 0 ? region.label : '', link: item }))
      : [{ region, label: region.label, link: null }],
  );
}

function buildMergedRows(regions: Region[]): HTMLDivElement[] {
  const slots = mergeSlots(regions);
  const rows: HTMLDivElement[] = [];
  for (let i = 0; i < slots.length; i += MERGE_ROW_COLUMNS) {
    const row = document.createElement('div');
    row.className = 'header-menu-merged-row header-menu-block';
    slots.slice(i, i + MERGE_ROW_COLUMNS).forEach((slot) => {
      const cell = document.createElement('div');
      cell.className = 'header-menu-merged-cell';
      const heading = document.createElement('p');
      heading.className = 'header-menu-region-label';
      // A non-breaking space keeps label-less cells aligned with labelled ones.
      heading.textContent = slot.label || '\u00A0';
      if (!slot.label) heading.setAttribute('aria-hidden', 'true');
      else moveInstrumentation(slot.region.source, cell);
      cell.append(heading);
      if (slot.link) cell.append(buildNavLink(slot.link));
      row.append(cell);
    });
    rows.push(row);
  }
  return rows;
}

function buildCategoryContent(category: Category, authoring: boolean): HTMLDivElement {
  const content = document.createElement('div');
  content.className = 'header-menu-category-content';
  content.inert = true;
  const inner = document.createElement('div');
  inner.className = 'header-menu-category-content-inner';
  const { regions } = category;
  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i] as Region;
    const next = regions[i + 1];
    // Merging two blocks into shared rows would hide one of them from selection, so authoring keeps them apart.
    if (!authoring && region.merge && next && mergeSlots([region, next]).length <= MERGE_ROW_COLUMNS) {
      inner.append(...buildMergedRows([region, next]));
      i += 1;
    } else {
      inner.append(buildRegion(region, authoring));
    }
  }
  content.append(inner);
  return content;
}

interface PromoView {
  root: HTMLDivElement;
  image: HTMLDivElement;
  cta: HTMLAnchorElement;
}

function buildPromoView(): PromoView {
  const root = document.createElement('div');
  root.className = 'header-menu-promo';
  const image = document.createElement('div');
  image.className = 'header-menu-promo-image';
  const cta = document.createElement('a');
  cta.className = 'header-menu-promo-cta';
  cta.dataset.testid = 'header-menu-promo-cta';
  root.append(image, cta);
  return { root, image, cta };
}

function showPromo(view: PromoView, promo: Promo | null): void {
  if (!promo) {
    view.root.classList.remove('is-visible');
    return;
  }
  const apply = () => {
    view.image.replaceChildren();
    if (promo.picture) {
      const picture = promo.picture.cloneNode(true) as HTMLPictureElement;
      picture.querySelectorAll('img').forEach((img) => {
        img.loading = 'lazy';
        if (img.dataset.src) img.src = img.dataset.src;
        delete img.dataset.src;
      });
      view.image.append(picture);
    }
    view.cta.href = promo.ctaHref;
    view.cta.textContent = promo.ctaLabel;
    setNewTab(view.cta, promo.newTab);
    view.cta.hidden = !(promo.ctaHref && promo.ctaLabel);
    view.root.classList.remove('is-swapping');
  };
  const wasVisible = view.root.classList.contains('is-visible');
  view.root.classList.add('is-visible');
  if (wasVisible) {
    view.root.classList.add('is-swapping');
    window.setTimeout(apply, PROMO_SWAP_MS);
  } else {
    apply();
  }
}

function buildPanel(model: HeaderModel, authoring: boolean): { panel: HTMLElement; activateFirst: () => void } {
  const panel = document.createElement('nav');
  panel.className = 'header-menu-panel';
  panel.id = PANEL_ID;
  panel.setAttribute('aria-label', MAIN_NAV_LABEL);
  panel.inert = true;
  panel.tabIndex = -1;

  const body = document.createElement('div');
  body.className = 'header-menu-body';
  const list = document.createElement('ul');
  list.className = 'header-menu-categories';
  const promo = buildPromoView();
  const desktop = window.matchMedia('(min-width: 1200px)');

  if (model.back) {
    const item = document.createElement('li');
    item.className = 'header-menu-back';
    const anchor = link(model.back.href, model.back.label, false);
    anchor.dataset.testid = 'header-menu-back';
    item.append(anchor);
    list.append(item);
  }

  const entries = model.categories.map((category, index) => {
    const li = document.createElement('li');
    li.className = 'header-menu-category';
    // Authoring keeps the authored section as the category's wrapper (inside the <li>) instead of moving its instrumentation.
    const holder = authoring ? (category.source as HTMLElement) : li;
    if (authoring) {
      holder.style.display = '';
      li.append(holder);
    } else {
      moveInstrumentation(category.source, li);
    }
    list.append(li);
    if (!category.regions.length) {
      holder.replaceChildren(link(category.href || '#', category.label, false, 'header-menu-category-trigger'));
      return { category, li, trigger: null, content: null };
    }
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'header-menu-category-trigger';
    trigger.textContent = category.label;
    const content = buildCategoryContent(category, authoring);
    content.id = `header-menu-category-content-${index}`;
    trigger.setAttribute('aria-controls', content.id);
    trigger.setAttribute('aria-expanded', 'false');
    holder.replaceChildren(trigger, content);
    return { category, li, trigger, content };
  });

  const setActive = (index: number) => {
    entries.forEach(({ li, trigger, content }, i) => {
      if (!trigger || !content) return;
      const isActive = i === index;
      li.dataset.active = String(isActive);
      trigger.setAttribute('aria-expanded', String(isActive));
      content.dataset.expanded = String(isActive);
      content.inert = !isActive;
    });
    showPromo(promo, entries[index]?.category.promo ?? null);
  };

  const first = entries.findIndex((entry) => entry.trigger);
  let lastActive = first;
  entries.forEach(({ li, trigger }, index) => {
    trigger?.addEventListener('click', () => {
      const isActive = li.dataset.active === 'true';
      // The desktop rail always shows one category; only the mobile/tablet accordion collapses.
      if (isActive && desktop.matches) return;
      if (!isActive) lastActive = index;
      setActive(isActive ? -1 : index);
    });
  });
  desktop.addEventListener('change', () => {
    const anyActive = entries.some(({ li }) => li.dataset.active === 'true');
    if (desktop.matches && !anyActive && lastActive !== -1 && entries.some(({ li }) => li.dataset.active)) {
      setActive(lastActive);
    }
  });

  const bottomLang = document.createElement('div');
  bottomLang.className = 'header-menu-bottom-lang';
  bottomLang.append(buildLangZone(model.languages, model.active));
  body.append(list, promo.root, bottomLang);
  panel.append(body);
  return { panel, activateFirst: () => first !== -1 && setActive(first) };
}

function render(block: HTMLElement, model: HeaderModel, authoring: boolean): { openMenu: () => void } {
  const toggle = buildToggle(model.menu);
  const { panel, activateFirst } = buildPanel(model, authoring);

  const tools = document.createElement('div');
  tools.className = 'header-tools';
  tools.append(buildLangZone(model.languages, model.active));
  if (model.cta.label && model.cta.href) {
    const cta = link(model.cta.href, model.cta.label, model.cta.newTab, 'header-cta');
    cta.dataset.testid = 'header-cta';
    tools.append(cta);
  }

  const inner = authoring ? (model.source as HTMLElement) : document.createElement('div');
  inner.classList.add('header-inner');
  if (authoring) {
    // Render inside main, in content order: nav-top's section first, then the category sections in the panel.
    // The wrapper elements carry no instrumentation, so the content tree still shows main > section > block.
    inner.replaceChildren(toggle, buildLogo(model.logo), tools);
    const shell = document.createElement('header');
    shell.className = 'header-v2-authoring';
    const main = inner.closest('main');
    main?.prepend(shell);
    shell.append(inner.closest('.section') ?? inner, panel);
    (block.closest('header') ?? block).hidden = true;
  } else {
    moveInstrumentation(model.source, inner);
    inner.append(toggle, buildLogo(model.logo), tools);
    block.replaceChildren(inner, panel);
  }

  const setPageInert = (inert: boolean) => {
    if (authoring) return;
    document.querySelectorAll<HTMLElement>('body > main, body > footer').forEach((el) => {
      el.inert = inert;
    });
  };
  let previousOverflow = '';
  let activated = false;
  const openMenu = () => {
    if (!activated) {
      activated = true;
      activateFirst();
    }
    panel.classList.add('is-open');
    panel.inert = false;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', model.menu.close);
    setPageInert(true);
    previousOverflow = document.body.style.overflow;
    if (!authoring) document.body.style.overflow = 'hidden';
    panel.focus();
  };
  const closeMenu = () => {
    if (!panel.classList.contains('is-open')) return;
    const hadFocus = panel.contains(document.activeElement);
    panel.classList.remove('is-open');
    panel.inert = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', model.menu.open);
    setPageInert(false);
    document.body.style.overflow = previousOverflow;
    if (hadFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => (panel.classList.contains('is-open') ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.isConnected) closeMenu();
  });
  return { openMenu };
}

// Universal Editor on the /nav page itself: the in-place rendered header is the editing surface.
function enableAuthoring(openMenu: () => void): void {
  openMenu();
  // The header is rendered from the authored content, so any change needs a fresh render; capturing on
  // window runs before editor-support's main listener, which would re-decorate the raw markup.
  AUE_CONTENT_EVENTS.forEach((type) =>
    window.addEventListener(
      type,
      (event) => {
        event.stopImmediatePropagation();
        window.location.reload();
      },
      true,
    ),
  );
  // Selecting a component in the content tree reveals its category.
  document.addEventListener('aue:ui-select', (event) => {
    const { resource, selected } = (event as CustomEvent).detail ?? {};
    if (!selected || !resource) return;
    const category = document
      .querySelector(`[data-aue-resource="${resource}"]`)
      ?.closest<HTMLElement>('.header-menu-category');
    if (category && category.dataset.active !== 'true') {
      category.querySelector<HTMLButtonElement>('button.header-menu-category-trigger')?.click();
    }
  });
}

export default async function decorateHeaderV2(
  block: HTMLElement,
  root: HTMLElement,
  authoring: boolean,
): Promise<boolean> {
  const model = readModel(root, authoring);
  if (!model) {
    console.warn('[header-v2] Nav structure invalid. Check /nav document.');
    return false;
  }
  loadCSS(`${window.hlx.codeBasePath}/blocks/header-v2/header-v2.css`);
  const { openMenu } = render(block, model, authoring);
  if (authoring) enableAuthoring(openMenu);
  return true;
}
