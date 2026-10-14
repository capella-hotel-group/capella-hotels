import { applyBlockIdentity } from '@/utils/block-identity.js';

type ListingType = 'offers' | 'wellness' | 'experience' | 'dining';

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
};

const textOf = (element?: Element | null): string => element?.textContent?.trim() || '';

function readListingType(row?: HTMLElement): ListingType {
  const field = row?.querySelector('[data-aue-prop="listingType"]') || row?.firstElementChild || row;
  const value = textOf(field).toLowerCase();
  return value === 'wellness' || value === 'experience' || value === 'dining' ? value : 'offers';
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

function getCardImage(record: ListingRecord): { src: string; alt: string } | null {
  if (!record.listHtml) return null;
  const pageUrl = getPageUrl(record.path);
  if (!pageUrl) return null;

  const parsed = new DOMParser().parseFromString(record.listHtml, 'text/html');
  const image = parsed.querySelector('picture img[src], img[src]');
  if (!image) return null;
  const source = image.getAttribute('src');
  if (!source) return null;

  try {
    const imageUrl = new URL(source, new URL('.', pageUrl));
    if (imageUrl.protocol !== 'https:' && imageUrl.protocol !== 'http:') return null;
    return { src: imageUrl.href, alt: image.getAttribute('alt') || record.title || '' };
  } catch {
    return null;
  }
}

function createCard(record: ListingRecord): HTMLElement {
  const card = document.createElement('article');
  card.className = 'page-listing-card';

  const imageData = getCardImage(record);
  if (imageData) {
    const media = document.createElement('div');
    media.className = 'page-listing-card-media';
    const image = document.createElement('img');
    image.src = imageData.src;
    image.alt = imageData.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    media.append(image);
    card.append(media);
  }

  const content = document.createElement('div');
  content.className = 'page-listing-card-content';

  const title = document.createElement('h2');
  title.className = 'page-listing-card-title';
  title.textContent = record.title?.trim() || 'Explore';

  const pageUrl = getPageUrl(record.path);
  if (pageUrl) {
    const link = document.createElement('a');
    link.href = pageUrl.href;
    link.textContent = title.textContent;
    title.replaceChildren(link);
  }
  content.append(title);

  if (record.description?.trim()) {
    const description = document.createElement('p');
    description.className = 'page-listing-card-description';
    description.textContent = record.description.trim();
    content.append(description);
  }

  card.append(content);
  return card;
}

async function loadListings(type: ListingType, status: HTMLElement, results: HTMLElement): Promise<void> {
  status.textContent = 'Loading listings...';
  results.replaceChildren();

  try {
    const response = await fetch(`${window.location.origin}${INDEX_PATHS[type]}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Listing index request failed: ${response.status}`);

    const index = (await response.json()) as ListingIndex;
    const records = Array.isArray(index.data) ? index.data : [];
    records.forEach((record) => results.append(createCard(record)));
    status.textContent = records.length ? '' : 'No listings are available for this type.';
  } catch {
    status.textContent = 'Listings for this type are not available right now.';
  }
}

export default function decorate(block: HTMLElement): void {
  if (block.querySelector(':scope > .page-listing-results')) return;

  const rows = [...block.children] as HTMLElement[];
  const [typeRow] = applyBlockIdentity(block, rows, {
    contentRows: 1,
    hiddenClass: 'page-listing-config',
  });
  const type = readListingType(typeRow);

  const status = document.createElement('p');
  status.className = 'page-listing-status';
  status.setAttribute('role', 'status');

  const results = document.createElement('div');
  results.className = 'page-listing-results';

  block.append(status, results);
  void loadListings(type, status, results);
}