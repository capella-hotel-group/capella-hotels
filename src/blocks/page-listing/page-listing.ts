import { applyBlockIdentity } from '@/utils/block-identity.js';
import { getPublishBaseUrl } from '@/utils/env.js';

type ListingType = 'offers' | 'wellness' | 'experience' | 'dining' | 'accommodations';

interface ListingRecord {
  path?: string;
  title?: string;
  description?: string;
  listHtml?: string;
}

interface ListingIndex {
  data?: ListingRecord[];
}

const INDEX_PATHS: Record<ListingType, string> = {
  offers: '/offers/list-index.json',
  wellness: '/wellness/list-index.json',
  experience: '/experience/list-index.json',
  dining: '/dining/list-index.json',
  accommodations: '/en/accommodations/list-index.json',
};

const textOf = (element?: Element | null): string => element?.textContent?.trim() || '';

const tagTitles = new Map<string, Promise<string>>();

function normalizeTag(value: string): string {
  const tag = value.trim();
  if (!tag.startsWith('/content/cq:tags/')) return tag;
  const [namespace, ...segments] = tag.slice('/content/cq:tags/'.length).split('/');
  return `${namespace}:${segments.join('/')}`;
}

function readTags(row?: Element): string[] {
  if (!row) return [];
  const items = row.querySelectorAll('li');
  return [
    ...new Set(
      (items.length ? Array.from(items, (item) => textOf(item)) : textOf(row).split(','))
        .map(normalizeTag)
        .filter(Boolean),
    ),
  ];
}

function tagTitle(tag: string): Promise<string> {
  const cached = tagTitles.get(tag);
  if (cached) return cached;
  const lookup = async (): Promise<string> => {
    if (!tag.includes(':')) return tag;
    const fallback = (tag.split('/').pop()?.split(':').pop() || tag).replace(/[-_]/g, ' ');
    const [namespace, ...segments] = tag.split(':');
    const tagPath = `${namespace}/${segments.join(':')}`;
    if (!/^[\w/-]+$/.test(tagPath) || tagPath.split('/').includes('..')) return fallback;
    try {
      const response = await fetch(`${getPublishBaseUrl()}/content/cq:tags/${tagPath}.json`, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return fallback;
      const data = (await response.json()) as Record<string, unknown>;
      const title = data[`jcr:title.${document.documentElement.lang || 'en'}`] || data['jcr:title'];
      return typeof title === 'string' && title.trim() ? title.trim() : fallback;
    } catch {
      return fallback;
    }
  };
  const title = lookup();
  tagTitles.set(tag, title);
  return title;
}

function setTagTitle(element: HTMLElement, tag: string): void {
  element.textContent = (tag.split('/').pop()?.split(':').pop() || tag).replace(/[-_]/g, ' ');
  void tagTitle(tag).then((title) => {
    element.textContent = title;
  });
}

function readListingType(row?: HTMLElement): ListingType {
  const field = row?.querySelector('[data-aue-prop="listingType"]') || row?.firstElementChild || row;
  const value = textOf(field).toLowerCase();
  return value === 'wellness' || value === 'experience' || value === 'dining' || value === 'accommodations'
    ? value
    : 'offers';
}

function locationFromPath(path?: string): string {
  const segments = (path || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  const languageIndex = segments.lastIndexOf('en');
  if (languageIndex < 1) return '';

  const location = segments[languageIndex - 1] || '';
  return location === 'capella-hotels' || location === 'content' ? '' : location;
}

function getPageUrl(path?: string): URL | null {
  if (!path) return null;
  try {
    const url = new URL(path, window.location.origin);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
}

function createMedia(record: ListingRecord, parsed: Document): HTMLElement | null {
  const pageUrl = getPageUrl(record.path);
  if (!pageUrl) return null;
  const media = document.createElement('div');
  media.className = 'page-listing-card-media';
  const slides: HTMLImageElement[] = [];
  parsed.querySelectorAll<HTMLImageElement>('img[src]').forEach((source) => {
    if (
      source.closest('dl') ||
      source.closest('[data-detail-icon]') ||
      source.parentElement?.closest('[data-detail-icon]')
    )
      return;
    const url = new URL(source.getAttribute('src') || '', new URL('.', pageUrl));
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const image = document.createElement('img');
    image.src = url.href;
    image.alt = source.alt || record.title || '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.hidden = slides.length > 0;
    slides.push(image);
    media.append(image);
  });
  if (!slides.length) return null;
  if (slides.length > 1) {
    media.setAttribute('role', 'region');
    media.setAttribute('aria-roledescription', 'carousel');
    media.setAttribute('aria-label', `${record.title || 'Offer'} images`);
    const controls = document.createElement('div');
    controls.className = 'page-listing-carousel-controls';
    let active = 0;
    const control = (label: string, direction: number): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = direction < 0 ? '<' : '>';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.dataset.testid = `page-listing-${direction < 0 ? 'previous' : 'next'}`;
      button.addEventListener('click', () => {
        slides[active]!.hidden = true;
        active = (active + direction + slides.length) % slides.length;
        slides[active]!.hidden = false;
      });
      return button;
    };
    controls.append(control('Previous image', -1), control('Next image', 1));
    media.append(controls);
  }
  return media;
}

function createActions(parsed: Document, record: ListingRecord): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'page-listing-card-actions';
  const base = getPageUrl(record.path);
  if (!base) return actions;
  parsed.querySelectorAll('div').forEach((cell) => {
    if (!Array.from(cell.children).some((child) => child.tagName === 'HR')) return;
    let group: Element[] = [];
    const appendAction = (): void => {
      const anchor = group.flatMap((element) => [...element.querySelectorAll('a[href]')])[0];
      if (!anchor) return;
      const href = new URL(anchor.getAttribute('href') || '', base);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(href.protocol)) return;
      const label = group.find(
        (element) => !element.querySelector('a') && !['true', 'false'].includes(textOf(element)),
      );
      const link = document.createElement('a');
      link.href = href.href;
      link.textContent = textOf(label) || textOf(anchor);
      link.dataset.testid = 'page-listing-cta';
      if (anchor.getAttribute('target') === '_blank' || group.some((element) => textOf(element) === 'true')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      actions.append(link);
    };
    Array.from(cell.children).forEach((element) => {
      if (element.tagName === 'HR') {
        appendAction();
        group = [];
      } else group.push(element);
    });
    appendAction();
  });
  return actions;
}

function markDetailImages(parsed: Document): void {
  parsed.querySelectorAll('div').forEach((cell) => {
    if (cell.querySelector('a') || !Array.from(cell.children).some((child) => child.tagName === 'HR')) return;
    // This is a detail cell, mark all images as detail icons
    cell.querySelectorAll('picture, img').forEach((img) => {
      img.setAttribute('data-detail-icon', 'true');
    });
  });
}

function createDetails(parsed: Document): HTMLElement {
  const details = document.createElement('dl');
  details.className = 'page-listing-card-details';
  parsed.querySelectorAll('div').forEach((cell) => {
    if (cell.querySelector('a') || !Array.from(cell.children).some((child) => child.tagName === 'HR')) return;
    let group: Element[] = [];
    const appendDetail = (): void => {
      const values = group.map((element) => textOf(element)).filter(Boolean);
      if (values.length < 1) return;
      const label = document.createElement('dt');
      const value = document.createElement('dd');

      // Look for picture/image element in the first group item
      const firstElement = group[0];
      const picture = firstElement?.querySelector('picture');
      const img = firstElement?.querySelector('img');

      if (picture || img) {
        if (picture) {
          const clonedPicture = picture.cloneNode(true) as HTMLElement;
          label.append(clonedPicture);
        } else if (img) {
          const clonedImg = img.cloneNode(true) as HTMLImageElement;
          label.append(clonedImg);
        }
        // Use all text values for the detail value
        value.textContent = values.join(' ');
        label.className = 'page-listing-card-detail-label';
        label.setAttribute('data-detail-icon', 'true');
        details.append(label, value);
      }
    };
    Array.from(cell.children).forEach((element) => {
      if (element.tagName === 'HR') {
        appendDetail();
        group = [];
      } else group.push(element);
    });
    appendDetail();
  });
  return details;
}

function createCard(record: ListingRecord, enableCompare: boolean = false): HTMLElement {
  const card = document.createElement('article');
  card.className = 'page-listing-card';
  const parsed = new DOMParser().parseFromString(record.listHtml || '', 'text/html');
  const rows = Array.from(parsed.body.children);
  const cardTitle = textOf(rows[3]);
  const cardDescription = textOf(rows[4]);
  const category = readTags(rows[2])[0] || '';
  card.dataset.category = category;
  const tags = readTags(rows[5]);

  // Mark detail images BEFORE creating media so carousel skips them
  markDetailImages(parsed);

  const media = createMedia({ ...record, title: cardTitle }, parsed);
  if (media) card.append(media);

  const content = document.createElement('div');
  content.className = 'page-listing-card-content';

  if (category) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'page-listing-card-eyebrow';
    setTagTitle(eyebrow, category);
    content.append(eyebrow);
  }

  const title = document.createElement('h2');
  title.className = 'page-listing-card-title';
  title.textContent = cardTitle || 'Explore';

  const pageUrl = getPageUrl(record.path);
  if (pageUrl) {
    const link = document.createElement('a');
    link.href = pageUrl.href;
    link.textContent = title.textContent;
    title.replaceChildren(link);
  }
  content.append(title);

  if (cardDescription) {
    const description = document.createElement('p');
    description.className = 'page-listing-card-description';
    description.textContent = cardDescription;
    content.append(description);
  }

  if (tags.length) {
    const tagList = document.createElement('ul');
    tagList.className = 'page-listing-card-tags';
    tagList.setAttribute('aria-label', 'Tags');
    tags.forEach((tag) => {
      const item = document.createElement('li');
      setTagTitle(item, tag);
      tagList.append(item);
    });
    content.append(tagList);
  }

  const details = createDetails(parsed);
  if (details.childElementCount || enableCompare) {
    const detailsRow = document.createElement('div');
    detailsRow.className = 'page-listing-card-details-row';
    if (details.childElementCount) detailsRow.append(details);

    if (enableCompare) {
      const compareCheckbox = document.createElement('div');
      compareCheckbox.className = 'page-listing-card-compare';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'page-listing-compare-checkbox';
      checkbox.dataset.testid = 'page-listing-compare-checkbox';
      checkbox.setAttribute('aria-label', `Compare ${cardTitle}`);
      const label = document.createElement('label');
      label.className = 'page-listing-compare-label';
      label.append(checkbox);
      label.append(document.createTextNode('COMPARE'));
      compareCheckbox.append(label);
      detailsRow.append(compareCheckbox);
    }

    content.append(detailsRow);
  }

  const actions = createActions(parsed, record);
  if (actions.childElementCount) content.append(actions);

  card.append(content);
  return card;
}

interface CategoryTag {
  id: string;
  title: string;
}

async function loadCategories(rootTag: string): Promise<CategoryTag[]> {
  const normalized = normalizeTag(rootTag);
  const separator = normalized.indexOf(':');
  if (separator < 1) return [];
  const tagPath = `/content/cq:tags/${normalized.slice(0, separator)}/${normalized.slice(separator + 1)}`;
  const url = new URL('/content/servlet.childtags.json', getPublishBaseUrl());
  url.searchParams.set('tag', tagPath);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Category request failed: ${response.status}`);
    const payload = (await response.json()) as { data?: Array<{ path?: string; title?: string }> };
    const categories: CategoryTag[] = [];
    for (const child of payload.data || []) {
      if (typeof child.path !== 'string' || typeof child.title !== 'string') continue;
      if (!child.path.startsWith(`${tagPath}/`) || child.path.slice(tagPath.length + 1).includes('/')) continue;
      const id = normalizeTag(child.path);
      if (categories.some((category) => category.id === id)) continue;
      categories.push({ id, title: child.title });
      tagTitles.set(id, Promise.resolve(child.title));
    }
    return categories;
  } catch (error) {
    console.warn('[page-listing] Could not load category tags.', error);
    return [];
  }
}

interface LoadMoreConfig {
  enabled: boolean;
  batchSize: number;
  label: string;
}

function createCardVisibility(
  cards: HTMLElement[],
  results: HTMLElement,
  config: LoadMoreConfig,
): (category: string) => void {
  let selectedCategory = '';
  let visibleCount = config.batchSize;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'page-listing-load-more';
  button.dataset.testid = 'page-listing-load-more';
  button.textContent = config.label;
  const update = (): void => {
    let matched = 0;
    cards.forEach((card) => {
      const matches = !selectedCategory || card.dataset.category === selectedCategory;
      card.hidden = !matches || (config.enabled && matched >= visibleCount);
      if (matches) matched += 1;
    });
    button.hidden = !config.enabled || matched <= visibleCount;
  };
  button.addEventListener('click', () => {
    const firstHidden = cards.find(
      (card) => card.hidden && (!selectedCategory || card.dataset.category === selectedCategory),
    );
    visibleCount += config.batchSize;
    update();
    if (button.hidden) firstHidden?.querySelector<HTMLElement>('a, button')?.focus();
  });
  if (config.enabled) results.after(button);
  update();
  return (category: string): void => {
    selectedCategory = category;
    visibleCount = config.batchSize;
    update();
  };
}

function createFilters(
  cards: HTMLElement[],
  categories: CategoryTag[],
  selectCategory: (category: string) => void,
  filtersContainer: HTMLElement,
): void {
  if (!categories.length) return;
  const filters = document.createElement('div');
  filters.className = 'page-listing-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Filter by category');
  const buttons: HTMLButtonElement[] = [];
  const addFilter = (category: string, count: number, title: string): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.testid = 'page-listing-category-filter';
    button.setAttribute('aria-pressed', String(!category));
    const label = document.createElement('span');
    label.textContent = title;
    button.append(label, ` (${count})`);
    button.addEventListener('click', () => {
      buttons.forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button)));
      selectCategory(category);
    });
    buttons.push(button);
    filters.append(button);
  };
  addFilter('', cards.length, 'All');
  categories.forEach((category) => {
    const count = cards.filter((card) => card.dataset.category === category.id).length;
    addFilter(category.id, count, category.title);
  });
  filtersContainer.append(filters);
}

async function loadListings(
  type: ListingType,
  location: string,
  enableCategoryFilters: boolean,
  categoryRootTag: string,
  loadMore: LoadMoreConfig,
  enableCompare: boolean,
  status: HTMLElement,
  results: HTMLElement,
  filtersContainer: HTMLElement,
): Promise<void> {
  if (!location) {
    status.textContent = 'Location could not be determined from this page URL.';
    return;
  }

  status.textContent = 'Loading listings...';
  results.replaceChildren();

  try {
    const response = await fetch(`${window.location.origin}${INDEX_PATHS[type]}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Listing index request failed: ${response.status}`);

    const index = (await response.json()) as ListingIndex;
    const records = Array.isArray(index.data) ? index.data : [];
    const matchingRecords = records.filter(
      (record) => locationFromPath(record.path) === location && record.title?.trim() && record.listHtml?.trim(),
    );
    const categories = enableCategoryFilters ? await loadCategories(categoryRootTag) : [];
    const cards = matchingRecords.map((record) => createCard(record, enableCompare));
    results.append(...cards);
    const selectCategory = createCardVisibility(cards, results, loadMore);
    if (enableCategoryFilters) createFilters(cards, categories, selectCategory, filtersContainer);
    status.textContent = matchingRecords.length ? '' : `No listings are available for ${location}.`;
  } catch {
    status.textContent = 'Listings for this type are not available right now.';
  }
}

export default async function decorate(block: HTMLElement): Promise<void> {
  if (block.querySelector(':scope > .page-listing-results')) return;

  const rows = [...block.children] as HTMLElement[];

  // Count how many non-empty rows we have at the start (eyebrow, title, description)
  let headerRowCount = 0;
  for (let i = 0; i < Math.min(3, rows.length); i += 1) {
    if (textOf(rows[i]).trim()) {
      headerRowCount += 1;
    } else {
      break;
    }
  }

  const configRows = applyBlockIdentity(block, rows, {
    contentRows: Math.max(1, rows.length - 2 - headerRowCount),
    hiddenClass: 'page-listing-config',
  });

  const headerRows = configRows.slice(0, headerRowCount);
  const otherRows = configRows.slice(headerRowCount);
  const [typeRow, filterRow, rootRow, loadMoreRow, countRow, labelRow, compareRow] = otherRows;

  const type = readListingType(typeRow);
  configRows.forEach((row) => row.classList.add('page-listing-config'));
  const enableCategoryFilters = textOf(filterRow).toLowerCase() !== 'false';
  const categoryRootTag = readTags(rootRow)[0] || '/content/cq:tags/capella-hotels/accommodations';
  const count = Number(textOf(countRow));
  const loadMore: LoadMoreConfig = {
    enabled: textOf(loadMoreRow).toLowerCase() === 'true',
    batchSize: Number.isFinite(count) && count >= 1 ? Math.floor(count) : 6,
    label: textOf(labelRow) || 'Load More',
  };
  const enableCompare = textOf(compareRow).toLowerCase() === 'true';
  const location = locationFromPath(window.location.pathname);

  const header = document.createElement('div');
  header.className = 'page-listing-header';

  for (let i = 0; i < headerRows.length; i += 1) {
    const row = headerRows[i];
    const text = textOf(row);
    if (!text) continue;

    if (i === 0) {
      // Eyebrow
      const eyebrowEl = document.createElement('p');
      eyebrowEl.className = 'page-listing-eyebrow';
      eyebrowEl.textContent = text;
      header.append(eyebrowEl);
    } else if (i === 1) {
      // Title - supports richtext HTML
      const titleEl = document.createElement('h2');
      titleEl.className = 'page-listing-title';
      // Check if text contains HTML tags
      if (text.includes('<') && text.includes('>')) {
        // For richtext, use innerHTML after sanitizing
        const { default: DOMPurify } = await import('dompurify');
        titleEl.innerHTML = DOMPurify.sanitize(text);
      } else {
        // Plain text
        titleEl.textContent = text;
      }
      header.append(titleEl);
    } else if (i === 2) {
      // Description
      const descEl = document.createElement('p');
      descEl.className = 'page-listing-description';
      descEl.textContent = text;
      header.append(descEl);
    }
  }

  const status = document.createElement('p');
  status.className = 'page-listing-status';
  status.setAttribute('role', 'status');

  const filters = document.createElement('div');
  filters.className = 'page-listing-filters-container';

  const results = document.createElement('div');
  results.className = 'page-listing-results';

  if (header.childElementCount) block.append(header);
  block.append(filters, status, results);
  void loadListings(
    type,
    location,
    enableCategoryFilters,
    categoryRootTag,
    loadMore,
    enableCompare,
    status,
    results,
    filters,
  );
}
