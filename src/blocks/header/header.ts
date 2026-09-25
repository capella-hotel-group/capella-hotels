import { getMetadata } from '@/app/aem.js';
import { loadFragment } from '@/blocks/fragment/fragment.js';
import {
  moveInstrumentation,
  SUPPORTED_SITES,
  DEFAULT_SITE_SEGMENT,
  LANG_MAP,
  VALID_LANG_PRIMARIES,
} from '@/app/scripts.js';

if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
  document.documentElement.classList.add('no-touch');
}

interface NavLanguage {
  label: string;
  shortLabel: string;
  href: string;
  source: Element;
}

interface NavLink {
  label: string;
  href: string;
  source: Element;
}

interface NavRegion {
  label: string;
  links: NavLink[];
  source: Element;
}

interface NavPromo {
  picture: Element | null;
  ctaLabel: string;
  ctaHref: string;
}

interface NavCategory {
  label: string;
  href: string;
  regions: NavRegion[];
  promo: NavPromo | null;
  source: Element;
}

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

// Text of an element excluding any nested <ul>/<ol>, so a label wrapped in a <p>
// (e.g. <li><p>Label</p><ul>...</ul></li>, produced by the rich text editor) is still read.
function directText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('ul, ol').forEach((list) => list.remove());
  return (clone.textContent ?? '').trim();
}

function readLanguages(chromeSection: Element): NavLanguage[] {
  const outerItem = chromeSection.querySelector(':scope .default-content-wrapper > ul > li');
  const innerList = outerItem?.querySelector(':scope > ul');
  if (!innerList) return [];
  return [...innerList.children].map((item) => {
    const anchor = item.querySelector('a');
    const label = anchor?.textContent?.trim() ?? '';
    return {
      label,
      shortLabel: label.slice(0, 2).toUpperCase(),
      href: anchor?.getAttribute('href') ?? '#',
      source: item,
    };
  });
}

function readLinkItem(item: Element): NavLink {
  const anchor = item.querySelector<HTMLAnchorElement>('a');
  return {
    label: anchor?.textContent?.trim() || directText(item),
    href: anchor?.getAttribute('href') ?? '',
    source: item,
  };
}

// A <li> with its own nested <ul> is a labeled region; a <li> with no nested <ul> is a
// flat link directly under the category. Consecutive flat links are grouped into one
// unlabeled region so they still render through the existing region-based UI.
function readCategoryRegions(topItem: Element): NavRegion[] {
  const nestedList = topItem.querySelector(':scope > ul');
  if (!nestedList) return [];
  const regions: NavRegion[] = [];
  let flatLinks: NavLink[] = [];
  const flushFlatLinks = () => {
    if (flatLinks.length) {
      regions.push({ label: '', links: flatLinks, source: nestedList });
      flatLinks = [];
    }
  };
  [...nestedList.children].forEach((item) => {
    const childList = item.querySelector(':scope > ul');
    if (childList) {
      flushFlatLinks();
      regions.push({
        label: directText(item),
        links: [...childList.children].map((linkItem) => readLinkItem(linkItem)),
        source: item,
      });
    } else {
      flatLinks.push(readLinkItem(item));
    }
  });
  flushFlatLinks();
  return regions;
}

function readPromo(heroBlock: Element): NavPromo | null {
  const picture = heroBlock.querySelector('picture');
  const cta = heroBlock.querySelector<HTMLAnchorElement>('a');
  if (!picture && !cta) return null;
  const img = picture?.querySelector('img');
  const src = img?.getAttribute('src');
  // Defer the promo image request until its category is actually shown (see
  // setActiveCategory, which restores src from data-src only for the active category).
  if (img && src) {
    img.removeAttribute('src');
    img.dataset.src = src;
  }
  return {
    picture,
    ctaLabel: cta?.textContent?.trim() ?? '',
    ctaHref: cta?.getAttribute('href') ?? '',
  };
}

function readCategoryFromList(rootList: Element): NavCategory | null {
  const topItem = rootList.querySelector(':scope > li');
  if (!topItem) return null;
  const anchor = topItem.querySelector<HTMLAnchorElement>(':scope > a');
  return {
    label: anchor?.textContent?.trim() || directText(topItem),
    href: anchor?.getAttribute('href') ?? '',
    regions: readCategoryRegions(topItem),
    promo: null,
    source: topItem,
  };
}

function readCategories(menuSection: Element): NavCategory[] {
  const categories: NavCategory[] = [];
  [...menuSection.children].forEach((wrapper) => {
    // decorateSections groups consecutive default content into ONE wrapper, so two
    // category lists with no Hero between them (a category with no promo) share a
    // wrapper — read every top-level <ul>, not just the first.
    const rootLists = [...wrapper.querySelectorAll(':scope > ul')];
    if (rootLists.length) {
      rootLists.forEach((rootList) => {
        const category = readCategoryFromList(rootList);
        if (category) categories.push(category);
      });
      return;
    }
    const heroBlock = wrapper.querySelector(':scope > div.hero');
    const lastCategory = categories[categories.length - 1];
    if (heroBlock && lastCategory && !lastCategory.promo) {
      lastCategory.promo = readPromo(heroBlock);
    }
  });
  return categories.filter((category) => category.href || category.regions.some((region) => region.links.length));
}

function getActiveLang(languages: NavLanguage[]): NavLanguage {
  const currentPath = window.location.pathname;
  const fallback: NavLanguage = {
    label: 'English',
    shortLabel: 'EN',
    href: `${getFragmentBasePath()}/`,
    source: document.createElement('li'),
  };
  return (
    languages.find((lang) => currentPath === lang.href || currentPath.startsWith(`${lang.href}/`)) ??
    languages[0] ??
    fallback
  );
}

function closeLangDropdown(trigger: HTMLElement, dropdown: HTMLElement): void {
  trigger.setAttribute('aria-expanded', 'false');
  dropdown.classList.remove('is-open');
}

function buildLangZone(languages: NavLanguage[], activeLabel: string): HTMLDivElement {
  const trigger = document.createElement('button');
  trigger.className = 'header-lang-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'listbox');

  const label = document.createElement('span');
  label.className = 'header-lang-label';
  label.textContent = activeLabel;
  trigger.append(label);

  const icon = document.createElement('span');
  icon.className = 'header-lang-icon';
  icon.setAttribute('aria-hidden', 'true');
  trigger.append(icon);

  const dropdown = document.createElement('ul');
  dropdown.className = 'header-lang-dropdown';
  dropdown.setAttribute('role', 'listbox');

  languages.forEach((lang) => {
    const item = document.createElement('li');
    item.setAttribute('role', 'option');
    item.setAttribute('tabindex', '0');
    if (lang.shortLabel === activeLabel) item.setAttribute('aria-selected', 'true');
    moveInstrumentation(lang.source, item);

    const anchor = document.createElement('a');
    anchor.href = lang.href;
    anchor.textContent = lang.shortLabel;
    item.append(anchor);

    item.addEventListener('click', () => {
      label.textContent = lang.shortLabel;
      dropdown.querySelectorAll('li').forEach((li) => li.removeAttribute('aria-selected'));
      item.setAttribute('aria-selected', 'true');
      closeLangDropdown(trigger, dropdown);
    });

    dropdown.append(item);
  });

  const zone = document.createElement('div');
  zone.className = 'header-lang';
  zone.append(trigger, dropdown);

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    if (trigger.getAttribute('aria-expanded') === 'true') closeLangDropdown(trigger, dropdown);
    else {
      dropdown.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLangDropdown(trigger, dropdown);
  });
  document.addEventListener('click', (event) => {
    if (!zone.contains(event.target as Node)) closeLangDropdown(trigger, dropdown);
  });

  return zone;
}

function buildLogo(
  pictureSrc: string,
  pictureAlt: string,
  darkSrc: string,
  darkAlt: string,
  href: string,
): HTMLAnchorElement {
  const logo = document.createElement('a');
  logo.className = 'header-logo';
  logo.href = href;
  logo.setAttribute('aria-label', 'Capella Hotels - Home');

  if (pictureSrc) {
    const img = document.createElement('img');
    img.className = 'header-logo-img-default';
    img.src = pictureSrc;
    img.alt = pictureAlt || 'Capella';
    logo.append(img);

    // Optional second Image authored in /nav is the dark/active variant shown while
    // the menu is open; without one, the default logo is reused in both states.
    if (darkSrc && darkSrc !== pictureSrc) {
      const darkImg = document.createElement('img');
      darkImg.className = 'header-logo-img-active';
      darkImg.src = darkSrc;
      darkImg.alt = darkAlt || pictureAlt || 'Capella';
      darkImg.setAttribute('aria-hidden', 'true');
      logo.append(darkImg);
    }
    return logo;
  }

  const mark = document.createElement('span');
  mark.className = 'header-logo-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '*';

  const word = document.createElement('span');
  word.className = 'header-logo-word';
  word.textContent = 'CAPELLA';

  logo.append(mark, word);
  return logo;
}

function buildCtaZone(label: string, href: string): HTMLAnchorElement | null {
  if (!label || !href) return null;
  const cta = document.createElement('a');
  cta.className = 'header-cta';
  cta.href = href;
  cta.textContent = label;
  return cta;
}

function buildMenuToggle(closeLabel: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'header-menu-toggle';
  button.type = 'button';
  button.setAttribute('aria-label', 'Open navigation menu');
  button.setAttribute('aria-expanded', 'false');

  const icon = document.createElement('span');
  icon.className = 'header-menu-icon';
  icon.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.className = 'header-menu-toggle-label';
  label.textContent = closeLabel;
  label.setAttribute('aria-hidden', 'true');

  button.append(icon, label);
  return button;
}

function buildLinkGrid(links: NavLink[]): HTMLUListElement {
  const grid = document.createElement('ul');
  grid.className = 'header-menu-link-grid';
  links.forEach((link) => {
    const li = document.createElement('li');
    if (link.href) {
      const anchor = document.createElement('a');
      anchor.href = link.href;
      anchor.textContent = link.label;
      moveInstrumentation(link.source, anchor);
      li.append(anchor);
    } else {
      const span = document.createElement('span');
      span.className = 'nav-link is-disabled';
      span.textContent = link.label;
      moveInstrumentation(link.source, span);
      li.append(span);
    }
    grid.append(li);
  });
  return grid;
}

function buildCategoryContent(category: NavCategory): HTMLDivElement {
  const content = document.createElement('div');
  content.className = 'header-menu-category-content';
  content.inert = true;

  const inner = document.createElement('div');
  inner.className = 'header-menu-category-content-inner';

  category.regions.forEach((region) => {
    const regionEl = document.createElement('div');
    regionEl.className = 'header-menu-region';
    if (region.label) {
      const heading = document.createElement('p');
      heading.className = 'header-menu-region-label';
      heading.textContent = region.label;
      regionEl.append(heading);
    }
    regionEl.append(buildLinkGrid(region.links));
    inner.append(regionEl);
  });

  content.append(inner);
  return content;
}

// Matches the .header-menu-promo-image/-cta opacity transition duration in header.css.
const PROMO_SWAP_MS = 150;

function setActiveCategory(
  categories: { category: NavCategory; li: HTMLLIElement; content: HTMLDivElement; trigger: HTMLElement }[],
  promo: { imageContainer: HTMLDivElement; cta: HTMLAnchorElement; root: HTMLDivElement },
  index: number,
): void {
  categories.forEach(({ li, content, trigger }, i) => {
    const isActive = i === index;
    li.dataset.active = String(isActive);
    content.dataset.expanded = String(isActive);
    content.inert = !isActive;
    if (trigger.tagName === 'BUTTON') trigger.setAttribute('aria-expanded', String(isActive));
  });

  const active = categories[index]?.category.promo;
  if (!active) {
    promo.root.classList.remove('is-visible');
    return;
  }

  const applyPromo = () => {
    promo.imageContainer.replaceChildren();
    if (active.picture) {
      const picture = active.picture.cloneNode(true) as Element;
      const img = picture.querySelector('img');
      if (img) {
        if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
        // restore the src that readPromo deferred to data-src, now that this category is actually shown
        const dataSrc = img.dataset.src;
        if (dataSrc) {
          img.src = dataSrc;
          delete img.dataset.src;
        }
      }
      promo.imageContainer.append(picture);
    }
    promo.cta.href = active.ctaHref;
    promo.cta.textContent = active.ctaLabel;
    promo.cta.hidden = !(active.ctaHref && active.ctaLabel);
    promo.root.classList.remove('is-swapping');
  };

  const wasVisible = promo.root.classList.contains('is-visible');
  promo.root.classList.add('is-visible');
  if (wasVisible) {
    // Cross-fade: fade the current image/CTA out, swap content, then fade back in.
    promo.root.classList.add('is-swapping');
    window.setTimeout(applyPromo, PROMO_SWAP_MS);
  } else {
    applyPromo();
  }
}

function buildMenuPromo(): { root: HTMLDivElement; imageContainer: HTMLDivElement; cta: HTMLAnchorElement } {
  const root = document.createElement('div');
  root.className = 'header-menu-promo';

  const imageContainer = document.createElement('div');
  imageContainer.className = 'header-menu-promo-image';

  const cta = document.createElement('a');
  cta.className = 'header-menu-promo-cta';

  root.append(imageContainer, cta);
  return { root, imageContainer, cta };
}

function buildMenuCategories(
  categories: NavCategory[],
  promo: { root: HTMLDivElement; imageContainer: HTMLDivElement; cta: HTMLAnchorElement },
): { list: HTMLUListElement; activateInitial: () => void } {
  const list = document.createElement('ul');
  list.className = 'header-menu-categories';

  const entries: { category: NavCategory; li: HTMLLIElement; content: HTMLDivElement; trigger: HTMLElement }[] = [];

  categories.forEach((category) => {
    const li = document.createElement('li');
    li.className = 'header-menu-category';
    moveInstrumentation(category.source, li);

    let trigger: HTMLElement;
    let content: HTMLDivElement;

    if (category.regions.length) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'header-menu-category-trigger';
      button.textContent = category.label;
      trigger = button;
      content = buildCategoryContent(category);
      li.append(trigger, content);
    } else {
      const anchor = document.createElement('a');
      anchor.className = 'header-menu-category-trigger';
      anchor.href = category.href || '#';
      anchor.textContent = category.label;
      trigger = anchor;
      content = document.createElement('div');
      content.hidden = true;
      li.append(trigger);
    }

    entries.push({ category, li, content, trigger });
    list.append(li);
  });

  entries.forEach(({ trigger }, index) => {
    if (trigger.tagName !== 'BUTTON') return;
    trigger.addEventListener('click', () => {
      const isActive = entries[index]?.li.dataset.active === 'true';
      setActiveCategory(entries, promo, isActive ? -1 : index);
    });
  });

  const firstExpandable = entries.findIndex((entry) => entry.category.regions.length);
  // Deferred until the menu is first opened, so the promo <picture> isn't inserted (and its
  // image requested) on every page load while the panel is still closed.
  const activateInitial = () => {
    if (firstExpandable !== -1) setActiveCategory(entries, promo, firstExpandable);
  };

  return { list, activateInitial };
}

function buildMenuPanel(
  categories: NavCategory[],
  languages: NavLanguage[],
  activeLangLabel: string,
): { panel: HTMLDivElement; activateInitial: () => void } {
  const panel = document.createElement('div');
  panel.className = 'header-menu-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.tabIndex = -1;

  const body = document.createElement('div');
  body.className = 'header-menu-body';

  const promo = buildMenuPromo();
  const { list: categoryList, activateInitial } = buildMenuCategories(categories, promo);
  body.append(categoryList, promo.root);

  const bottomLang = document.createElement('div');
  bottomLang.className = 'header-menu-bottom-lang';
  bottomLang.append(buildLangZone(languages, activeLangLabel));
  body.append(bottomLang);

  panel.append(body);
  return { panel, activateInitial };
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location.href).pathname : null;
  const hide = () => {
    const headerElement = (block.closest('header') ?? block.closest('.header-wrapper') ?? block) as HTMLElement;
    headerElement.style.display = 'none';
  };

  let fragment = navPath ? await loadFragment(navPath) : null;
  if (!fragment) fragment = await loadFragment(`${getFragmentBasePath()}/nav`);
  if (!fragment) fragment = await loadFragment('/nav');
  if (!fragment) {
    hide();
    return;
  }

  const [chromeSection, menuSection] = fragment.querySelectorAll(':scope > div.section');
  if (!chromeSection || !menuSection) {
    console.warn('[header] Nav structure invalid. Check /nav document.');
    hide();
    return;
  }

  const languages = readLanguages(chromeSection);
  const categories = readCategories(menuSection);
  if (!languages.length || !categories.length) {
    console.warn('[header] Nav structure invalid. Check /nav document.');
    hide();
    return;
  }

  const [logoImg, logoImgDark] = chromeSection.querySelectorAll('picture img');
  const chromeLinks = [...chromeSection.querySelectorAll<HTMLAnchorElement>('.default-content-wrapper > p > a')];
  const ctaAnchor = chromeLinks[0];
  const closeMenuLabel = chromeLinks[1]?.textContent?.trim() || 'CLOSE';
  const activeLang = getActiveLang(languages);

  const logo = buildLogo(
    logoImg?.getAttribute('src') ?? '',
    logoImg?.getAttribute('alt') ?? '',
    logoImgDark?.getAttribute('src') ?? '',
    logoImgDark?.getAttribute('alt') ?? '',
    activeLang.href,
  );
  const menuToggle = buildMenuToggle(closeMenuLabel);
  const langZone = buildLangZone(languages, activeLang.shortLabel);
  const cta = buildCtaZone(ctaAnchor?.textContent?.trim() ?? '', ctaAnchor?.getAttribute('href') ?? '');
  const { panel, activateInitial } = buildMenuPanel(categories, languages, activeLang.shortLabel);

  const closeMenu = () => {
    const hadFocusInPanel = panel.contains(document.activeElement);
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation menu');
    document.body.style.overflow = '';
    if (hadFocusInPanel) menuToggle.focus();
  };

  let menuActivated = false;
  const openMenu = () => {
    if (!menuActivated) {
      menuActivated = true;
      activateInitial();
    }
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Close navigation menu');
    document.body.style.overflow = 'hidden';
    panel.focus();
  };

  menuToggle.addEventListener('click', () => {
    if (panel.classList.contains('is-open')) closeMenu();
    else openMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  const tools = document.createElement('div');
  tools.className = 'header-tools';
  tools.append(langZone);
  if (cta) tools.append(cta);

  const inner = document.createElement('div');
  inner.className = 'header-inner';
  inner.append(menuToggle, logo, tools);

  block.replaceChildren(inner, panel);
}
