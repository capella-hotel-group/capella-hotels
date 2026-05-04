import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

// Detect touch capability and add class to <html> for CSS hooks
if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
  document.documentElement.classList.add('no-touch');
}

function closeLangDropdown(trigger, dropdown) {
  trigger.setAttribute('aria-expanded', 'false');
  dropdown.classList.remove('is-open');
}

/**
 * Builds the language selector dropdown from a <ul> of language options.
 * Returns [zone (div.header-lang), dropdown (ul.header-lang-dropdown)].
 * Dropdown is appended to body by the caller so it escapes header stacking context.
 */
function buildLangZone(sourceList) {
  const sourceItems = [...sourceList.querySelectorAll('li')];
  const firstLabel = sourceItems[0]?.textContent?.trim() ?? 'ENGLISH';

  const trigger = document.createElement('button');
  trigger.className = 'header-lang-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.textContent = firstLabel;

  const dropdown = document.createElement('ul');
  dropdown.className = 'header-lang-dropdown';
  dropdown.setAttribute('role', 'listbox');
  moveInstrumentation(sourceList, dropdown);

  sourceItems.forEach((srcItem, i) => {
    const srcA = srcItem.querySelector('a');
    const label = (srcA?.textContent ?? srcItem.textContent)?.trim() ?? '';

    const item = document.createElement('li');
    item.setAttribute('role', 'option');
    item.setAttribute('tabindex', '0');
    if (i === 0) item.setAttribute('aria-selected', 'true');
    moveInstrumentation(srcItem, item);

    if (srcA) {
      const a = document.createElement('a');
      a.href = srcA.href;
      a.textContent = label;
      moveInstrumentation(srcA, a);
      item.append(a);
    } else {
      item.textContent = label;
    }

    item.addEventListener('click', () => {
      trigger.textContent = label;
      dropdown.querySelectorAll('li').forEach((li) => li.removeAttribute('aria-selected'));
      item.setAttribute('aria-selected', 'true');
      closeLangDropdown(trigger, dropdown);
    });

    dropdown.append(item);
  });

  const zone = document.createElement('div');
  zone.className = 'header-lang';
  zone.append(trigger, dropdown);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trigger.getAttribute('aria-expanded') === 'true') {
      closeLangDropdown(trigger, dropdown);
    } else {
      dropdown.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLangDropdown(trigger, dropdown);
  });

  document.addEventListener('click', (e) => {
    if (!zone.contains(e.target)) closeLangDropdown(trigger, dropdown);
  });

  return zone;
}

/**
 * Builds a mega-menu dropdown for a nav item that has nested sub-categories.
 * Structure:
 *   div.header-nav-item
 *   ├── button.header-nav-link.header-nav-drop-trigger  (tab switcher)
 *   └── div.header-nav-dropdown
 *       └── div.header-nav-dropdown-inner
 *           ├── div.header-nav-dropdown-categories  (left column: category tabs)
 *           └── div.header-nav-dropdown-panels      (right column: destination lists)
 */
function buildDropdown(srcItem) {
  const label = srcItem.querySelector(':scope > p')?.textContent?.trim() ?? '';
  const subItems = [...(srcItem.querySelector(':scope > ul')?.querySelectorAll(':scope > li') ?? [])];

  const wrapper = document.createElement('div');
  wrapper.className = 'header-nav-item';

  const trigger = document.createElement('button');
  trigger.className = 'header-nav-link header-nav-drop-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.textContent = label;

  const dropdown = document.createElement('div');
  dropdown.className = 'header-nav-dropdown';

  const inner = document.createElement('div');
  inner.className = 'header-nav-dropdown-inner';

  const categories = document.createElement('div');
  categories.className = 'header-nav-dropdown-categories';

  const panels = document.createElement('div');
  panels.className = 'header-nav-dropdown-panels';

  subItems.forEach((subItem, i) => {
    const catLabel = subItem.querySelector(':scope > p')?.textContent?.trim() ?? '';
    const catLinks = [...(subItem.querySelector(':scope > ul')?.querySelectorAll('li') ?? [])];

    const catBtn = document.createElement('button');
    catBtn.className = 'header-nav-dropdown-cat';
    catBtn.textContent = catLabel;
    if (i === 0) catBtn.classList.add('is-active');
    categories.append(catBtn);

    const panel = document.createElement('ul');
    panel.className = 'header-nav-dropdown-panel';
    if (i === 0) panel.classList.add('is-active');

    catLinks.forEach((srcLi) => {
      const srcA = srcLi.querySelector('a');
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = srcA?.href ?? '#';
      a.textContent = (srcA?.textContent ?? srcLi.textContent).trim();
      if (srcA) moveInstrumentation(srcA, a);
      li.append(a);
      panel.append(li);
    });

    panels.append(panel);

    catBtn.addEventListener('click', () => {
      categories.querySelectorAll('.header-nav-dropdown-cat').forEach((b) => b.classList.remove('is-active'));
      panels.querySelectorAll('.header-nav-dropdown-panel').forEach((p) => p.classList.remove('is-active'));
      catBtn.classList.add('is-active');
      panel.classList.add('is-active');
    });
  });

  inner.append(categories, panels);
  dropdown.append(inner);

  wrapper.append(trigger, dropdown);

  function openDropdown() {
    trigger.setAttribute('aria-expanded', 'true');
    dropdown.classList.add('is-open');
  }

  function closeDropdown() {
    trigger.setAttribute('aria-expanded', 'false');
    dropdown.classList.remove('is-open');
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'header-nav-dropdown-close';
  closeBtn.setAttribute('aria-label', 'Close menu');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeDropdown();
  });
  dropdown.append(closeBtn);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (trigger.getAttribute('aria-expanded') === 'true') {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  return wrapper;
}

/**
 * Builds the desktop center nav from a list of <li> items.
 * Items with a nested <ul> get a mega-menu dropdown; others become plain links.
 */
function buildNavZone(navItems) {
  const nav = document.createElement('nav');
  nav.className = 'header-nav';
  nav.setAttribute('aria-label', 'Primary navigation');

  navItems.forEach((srcItem) => {
    if (srcItem.querySelector(':scope > ul')) {
      nav.append(buildDropdown(srcItem));
    } else {
      const directP = srcItem.querySelector(':scope > p');
      const srcA = directP?.querySelector('a');
      const a = document.createElement('a');
      a.className = 'header-nav-link';
      a.href = srcA?.href ?? '#';
      a.textContent = (srcA?.textContent ?? directP?.textContent)?.trim() ?? '';
      moveInstrumentation(srcA ?? srcItem, a);
      nav.append(a);
    }
  });

  return nav;
}

/**
 * Builds the desktop CTA anchor (right zone).
 */
function buildCtaZone(sourceAnchor) {
  const cta = document.createElement('a');
  cta.className = 'header-cta';
  cta.href = sourceAnchor?.href ?? '/book';
  cta.textContent = sourceAnchor?.textContent?.trim() ?? 'BOOK YOUR STAY';
  if (sourceAnchor) moveInstrumentation(sourceAnchor, cta);
  return cta;
}

/** Mobile MENU toggle button. */
function buildMobileToggle() {
  const btn = document.createElement('button');
  btn.className = 'header-menu-toggle';
  btn.textContent = 'MENU';
  btn.setAttribute('aria-label', 'Open navigation menu');
  return btn;
}

/** Mobile CTA (BOOK — shortened text). */
function buildMobileCta(sourceAnchor) {
  const cta = document.createElement('a');
  cta.className = 'header-mobile-cta';
  cta.href = sourceAnchor?.href ?? '/book';
  cta.textContent = 'BOOK';
  if (sourceAnchor) moveInstrumentation(sourceAnchor, cta);
  return cta;
}

/**
 * Builds the slide-down mobile panel:
 *   - plain nav links (items without nested ul)
 *   - accordion toggles for items WITH nested ul (e.g. Destinations) + Languages
 *   - close button
 *
 * Opening one accordion closes the other (mutual exclusion via CSS classes on panel).
 */
function buildMobilePanel(navItems, langList) {
  const panel = document.createElement('div');
  panel.className = 'header-mobile-panel';

  const menuCard = document.createElement('div');
  menuCard.className = 'header-mobile-menu';

  // Track all accordion { toggle, listEl, expandedClass } for mutual exclusion
  const accordions = [];

  navItems.filter((li) => li.textContent?.trim()).forEach((srcItem) => {
    const directP = srcItem.querySelector(':scope > p');
    const srcA = directP?.querySelector('a');
    const label = (srcA?.textContent ?? directP?.textContent)?.trim() ?? '';
    const subUl = srcItem.querySelector(':scope > ul');

    if (subUl) {
      // Accordion toggle for items with sub-categories (e.g. Destinations)
      const toggle = document.createElement('button');
      toggle.className = 'header-mobile-nav-toggle';
      toggle.textContent = label;
      menuCard.append(toggle);

      // Build flat list: category heading + links beneath it
      const list = document.createElement('ul');
      list.className = 'header-mobile-nav-list';

      [...subUl.querySelectorAll(':scope > li')].forEach((catItem) => {
        const catLabel = catItem.querySelector(':scope > p')?.textContent?.trim() ?? '';
        const catLinks = [...(catItem.querySelector(':scope > ul')?.querySelectorAll('li') ?? [])];

        const heading = document.createElement('li');
        heading.className = 'header-mobile-nav-list-heading';
        heading.textContent = catLabel;
        list.append(heading);

        catLinks.forEach((srcLi) => {
          const li = document.createElement('li');
          const srcLiA = srcLi.querySelector('a');
          const a = document.createElement('a');
          a.href = srcLiA?.href ?? '#';
          a.textContent = (srcLiA?.textContent ?? srcLi.textContent).trim();
          if (srcLiA) moveInstrumentation(srcLiA, a);
          li.append(a);
          list.append(li);
        });
      });

      const expandedClass = `is-${label.toLowerCase().replace(/\s+/g, '-')}-expanded`;
      accordions.push({ toggle, list, expandedClass });
      panel.append(list);
    } else {
      // Plain link
      const a = document.createElement('a');
      a.className = 'header-mobile-nav-link';
      a.href = srcA?.href ?? '#';
      a.textContent = label;
      menuCard.append(a);
    }
  });

  // Languages accordion
  const langToggle = document.createElement('button');
  langToggle.className = 'header-mobile-lang-toggle';
  langToggle.textContent = 'LANGUAGES';
  menuCard.append(langToggle);

  const langUl = document.createElement('ul');
  langUl.className = 'header-mobile-lang-list';
  [...langList.querySelectorAll('li')].forEach((srcItem) => {
    const li = document.createElement('li');
    li.textContent = srcItem.textContent?.trim() ?? '';
    li.addEventListener('click', () => panel.classList.remove('is-lang-expanded'));
    langUl.append(li);
  });

  accordions.push({ toggle: langToggle, list: langUl, expandedClass: 'is-lang-expanded' });
  panel.append(langUl);

  // Wire up mutual exclusion for all accordions
  accordions.forEach(({ toggle, expandedClass }) => {
    toggle.addEventListener('click', () => {
      const isOpen = panel.classList.contains(expandedClass);
      // Close all
      accordions.forEach(({ expandedClass: cls }) => panel.classList.remove(cls));
      // Open this one if it was closed
      if (!isOpen) panel.classList.add(expandedClass);
    });
  });

  // Insert menu card before any lists (panel.prepend so lists come after)
  panel.prepend(menuCard);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'header-mobile-close';
  closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 14"><polyline points="38.7,12.7 20,1.5 1.3,12.7" fill="none" stroke="#242F3A" stroke-width="1.75"/></svg>';
  closeBtn.setAttribute('aria-label', 'Close navigation menu');
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('is-open');
    accordions.forEach(({ expandedClass: cls }) => panel.classList.remove(cls));
    document.body.style.overflow = '';
  });

  panel.append(closeBtn);
  return panel;
}

/**
 * Decorates the three-zone sticky header:
 *   [language selector]  [nav links | emblem | nav links]  [BOOK YOUR STAY]
 *
 * Fragment sections expected (from /nav document):
 *   sections[0] — combined nav UL:
 *     li[0]  = Languages  (nested <ul> with language options)
 *     li[1+] = Nav items  (Destinations, Experiences, …)
 *   sections[1] — CTA link  (Book Your Stay)
 *   sections[2] — Logo      (<picture>)
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location.href).pathname : '/nav';
  const hide = () => {
    const headerEl = block.closest('header') ?? block.closest('.header-wrapper') ?? block;
    headerEl.style.display = 'none';
  };

  const fragment = await loadFragment(navPath);
  if (!fragment) { hide(); return; }

  const sections = [...fragment.children];

  // Parse section 0: extract language list and nav items
  const outerList = sections[0]?.querySelector('ul');
  const topLevelItems = outerList ? [...outerList.querySelectorAll(':scope > li')] : [];
  const langList = topLevelItems[0]?.querySelector('ul'); // nested ul inside Languages li
  const navItems = topLevelItems.slice(1); // Destinations, Experiences, …

  // Parse section 1: CTA anchor
  const ctaAnchor = sections[1]?.querySelector('a') ?? null;

  // Parse section 2: logo picture
  const logoPicture = sections[2]?.querySelector('picture');

  if (!langList || !navItems.length) { hide(); return; }

  const langZone = buildLangZone(langList);

  // Emblem: direct <img> absolutely centered
  const emblem = document.createElement('img');
  emblem.className = 'header-emblem';
  emblem.src = (logoPicture?.querySelector('img')?.src) ?? '/icons/capella-emblem.svg';
  emblem.alt = '';

  const mobileToggle = buildMobileToggle();
  const mobileCta = buildMobileCta(ctaAnchor);
  const mobilePanel = buildMobilePanel(navItems, langList);

  mobileToggle.addEventListener('click', () => {
    const opening = !mobilePanel.classList.contains('is-open');
    mobilePanel.classList.toggle('is-open');
    document.body.style.overflow = opening ? 'hidden' : '';
  });

  const inner = document.createElement('div');
  inner.className = 'header-inner';
  inner.append(
    langZone,
    buildNavZone(navItems),
    emblem,
    buildCtaZone(ctaAnchor),
    mobileToggle,
    mobileCta,
  );

  block.replaceChildren(inner, mobilePanel);

  // If a hero-banner block exists on the page, move <header> into <main>
  // right after the hero-banner section so masthead renders above the header.
  const heroBannerSection = document.querySelector('main > div:has(.hero-banner)');
  if (heroBannerSection) {
    const headerEl = block.closest('header');
    if (headerEl) heroBannerSection.after(headerEl);
  }
}
