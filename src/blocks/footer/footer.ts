import { getMetadata } from '@/app/aem.js';
import { loadFragment } from '@/blocks/fragment/fragment.js';
import {
  moveInstrumentation,
  SUPPORTED_SITES,
  DEFAULT_SITE_SEGMENT,
  LANG_MAP,
  VALID_LANG_PRIMARIES,
} from '@/app/scripts.js';

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

/** Rebuilds a single authored link, preserving href/target/rel and full child markup (icons included). */
function buildLink(srcItem: Element): HTMLAnchorElement | null {
  const srcA = srcItem.matches('a') ? (srcItem as HTMLAnchorElement) : srcItem.querySelector<HTMLAnchorElement>('a');
  if (!srcA) return null;
  const a = document.createElement('a');
  a.href = srcA.href;
  if (srcA.target) a.target = srcA.target;
  a.rel = 'noopener noreferrer';
  moveInstrumentation(srcA, a);
  return a;
}

/** Builds one nav link column (`.footer-nav-col`) from a source `<ul>`. */
function buildNavColumn(sourceList: Element): HTMLDivElement {
  const col = document.createElement('div');
  col.className = 'footer-nav-col';
  moveInstrumentation(sourceList, col);
  [...sourceList.querySelectorAll(':scope > li')].forEach((srcItem) => {
    const item = document.createElement('p');
    item.className = 'footer-nav-link';
    moveInstrumentation(srcItem, item);
    const a = buildLink(srcItem);
    if (a) {
      a.textContent = srcItem.querySelector('a')?.textContent?.trim() ?? '';
      item.append(a);
    } else {
      item.textContent = srcItem.textContent?.trim() ?? '';
    }
    col.append(item);
  });
  return col;
}

/** Section 1: exactly 2 nav link lists, rendered side by side. */
function buildNavColumnsGroup(section: Element | undefined): HTMLDivElement | null {
  const lists = [...(section?.querySelectorAll(':scope .default-content-wrapper > ul') ?? [])];
  if (!lists.length) return null;
  const group = document.createElement('div');
  group.className = 'footer-nav-columns';
  lists.slice(0, 2).forEach((list) => group.append(buildNavColumn(list)));
  return group;
}

/** Section 2: the already-decorated `newsletter-form` block, relocated (not rebuilt). */
function buildNewsletterGroup(section: Element | undefined): HTMLDivElement | null {
  const newsletterBlock = section?.querySelector(':scope .newsletter-form');
  if (!newsletterBlock) return null;
  const group = document.createElement('div');
  group.className = 'footer-newsletter';
  group.append(newsletterBlock);
  return group;
}

/** Rebuilds a social link, preserving the full decorated icon markup (not reduced to text). */
function buildSocialLink(srcItem: Element): HTMLLIElement {
  const item = document.createElement('li');
  moveInstrumentation(srcItem, item);
  const srcA = srcItem.matches('a') ? (srcItem as HTMLAnchorElement) : srcItem.querySelector<HTMLAnchorElement>('a');
  if (srcA) {
    const a = buildLink(srcItem);
    if (a) {
      a.append(...[...srcA.childNodes].map((node) => node.cloneNode(true)));
      item.append(a);
    }
  } else {
    item.append(...[...srcItem.childNodes].map((node) => node.cloneNode(true)));
  }
  return item;
}

/** Section 3: one contact-info text block + one social links list, under static headings. */
function buildContactGroup(section: Element | undefined): HTMLDivElement | null {
  const wrapper = section?.querySelector(':scope .default-content-wrapper');
  if (!wrapper) return null;

  const socialList = wrapper.querySelector(':scope > ul');
  const socialParagraph = [...wrapper.children].find(
    (el) => el.tagName === 'P' && el.querySelector(':scope > a span.icon'),
  );
  const socialSource = socialList || socialParagraph;
  const contactEls = [...wrapper.children].filter((el) => el !== socialSource);

  const group = document.createElement('div');
  group.className = 'footer-contact';
  moveInstrumentation(wrapper, group);

  if (contactEls.length) {
    const contact = document.createElement('div');
    contact.className = 'footer-contact-info';
    const heading = document.createElement('p');
    heading.className = 'footer-heading';
    heading.textContent = 'Contact Us';
    contact.append(heading, ...contactEls);
    group.append(contact);
  }

  if (socialSource) {
    const social = document.createElement('div');
    social.className = 'footer-social';
    const heading = document.createElement('p');
    heading.className = 'footer-heading';
    heading.textContent = 'Follow Us On';
    const list = document.createElement('ul');
    list.className = 'footer-social-list';
    moveInstrumentation(socialSource, list);
    const socialItems = socialList ? [...socialList.children] : [...socialSource.querySelectorAll(':scope > a')];
    socialItems.forEach((srcItem) => list.append(buildSocialLink(srcItem)));
    social.append(heading, list);
    group.append(social);
  }

  return group.childElementCount ? group : null;
}

/** Section 4: one legal links list + one copyright paragraph. */
function buildLegalGroup(section: Element | undefined): HTMLDivElement | null {
  const wrapper = section?.querySelector(':scope .default-content-wrapper');
  if (!wrapper) return null;

  const legalList = wrapper.querySelector(':scope > ul');
  const legalParagraph = [...wrapper.children].find((el) => el.tagName === 'P' && el.querySelector(':scope > a'));
  const copyright = [...wrapper.children].find((el) => el.tagName === 'P' && el !== legalParagraph);
  if (!legalList && !legalParagraph && !copyright) return null;

  const group = document.createElement('div');
  group.className = 'footer-legal';
  moveInstrumentation(wrapper, group);

  const legalSource = legalList || legalParagraph;
  if (legalSource) {
    const list = document.createElement('ul');
    list.className = 'footer-legal-list';
    moveInstrumentation(legalSource, list);
    const legalItems = legalList ? [...legalList.children] : [...legalSource.querySelectorAll(':scope > a')];
    legalItems.forEach((srcItem) => {
      const item = document.createElement('li');
      moveInstrumentation(srcItem, item);
      const a = buildLink(srcItem);
      if (a) {
        const sourceLink = srcItem.matches('a') ? srcItem : srcItem.querySelector('a');
        a.textContent = sourceLink?.textContent?.trim() ?? '';
        item.append(a);
      } else {
        item.textContent = srcItem.textContent?.trim() ?? '';
      }
      list.append(item);
    });
    group.append(list);
  }

  if (copyright) {
    const p = document.createElement('p');
    p.className = 'footer-copyright';
    moveInstrumentation(copyright, p);
    p.append(...[...copyright.childNodes].map((node) => node.cloneNode(true)));
    group.append(p);
  }

  return group;
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block: HTMLElement): Promise<void> {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location.href).pathname : null;

  // Option 1: metadata-driven path. Option 2: compute from URL site + lang segments.
  let fragment = footerPath ? await loadFragment(footerPath) : null;
  if (!fragment) fragment = await loadFragment(`${getFragmentBasePath()}/footer`);
  if (!fragment) return;

  // The `/footer` fragment has 4 fixed sections in order: nav link columns,
  // newsletter, contact + social, legal + copyright. A missing or malformed
  // section is skipped rather than throwing (see docs/footer-authoring-guide.md).
  const [navSection, newsletterSection, contactSection, legalSection] = [
    ...fragment.querySelectorAll(':scope > div.section'),
  ];

  const slots: Array<{ name: string; build: () => HTMLDivElement | null }> = [
    { name: 'nav', build: () => buildNavColumnsGroup(navSection) },
    { name: 'newsletter', build: () => buildNewsletterGroup(newsletterSection) },
    { name: 'contact', build: () => buildContactGroup(contactSection) },
    { name: 'legal', build: () => buildLegalGroup(legalSection) },
  ];

  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  let lastSlot: string | null = null;
  slots.forEach(({ name, build }) => {
    const group = build();
    if (!group) return;
    if (lastSlot) {
      const divider = document.createElement('div');
      divider.className = 'footer-divider';
      divider.dataset.after = lastSlot;
      inner.append(divider);
    }
    inner.append(group);
    lastSlot = name;
  });

  block.replaceChildren(inner);
}
