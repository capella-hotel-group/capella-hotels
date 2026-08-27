import { getPublishBaseUrl } from '@/utils/env.js';

const TAB_LIST_QUERY = '/graphql/execute.json/capella-hotels/TabList';
const PATH_KEY = '_path';

interface Hotspot {
  x: number;
  y: number;
  radius: number;
  href: string;
  target: string;
  label: string;
}

interface ContentData {
  subtitle: string;
  title: string;
  description: string;
}

interface ModalRefs {
  modal: ModalElement;
  panel: HTMLElement | null;
  body: HTMLElement | null;
}

interface ModalElement extends HTMLDivElement {
  repositionHandler?: (() => void) | null;
}

function normalizePath(path?: string | null): string {
  return (path || '')
    .trim()
    .replace(/(\.plain)?\.html$/i, '')
    .replace(/\.json$/i, '')
    .replace(/\/$/, '');
}

function normalizeAssetCandidate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    return url.pathname;
  } catch (e) {
    return trimmed;
  }
}

function getAuthoredCfPath(block: HTMLElement): string {
  const row = block.querySelectorAll(':scope > div')[0];
  const cell = row?.querySelector(':scope > div:last-child') || row?.querySelector(':scope > div');
  const link = cell?.querySelector('a');
  return (link?.getAttribute('href') || cell?.textContent || '').trim();
}

function getAuthoredField(block: HTMLElement, index: number, richText = false): string {
  const row = block.querySelectorAll(':scope > div')[index];
  const cell = row?.querySelector(':scope > div:last-child') || row?.querySelector(':scope > div');
  return richText ? cell?.innerHTML?.trim() || '' : cell?.textContent?.trim() || '';
}

function addDamPrefix(path: string): string {
  const normalizedPath = normalizeAssetCandidate(path)
    .replace(/[#?].*$/, '')
    .replace(/^\/+|\/+$/g, '');
  if (!normalizedPath) return '';
  return normalizedPath.startsWith('content/dam/') ? `/${normalizedPath}` : `/content/dam/${normalizedPath}`;
}

async function fetchTabDetailsData(cfPath: string): Promise<Record<string, any> | null> {
  const publishBaseUrl = getPublishBaseUrl();
  const normalizedCfPath = normalizePath(cfPath);
  const url = `${publishBaseUrl}${TAB_LIST_QUERY};path=${normalizedCfPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('TabList request failed');
  }

  const data = await response.json();
  return data?.data?.tabDetailsByPath?.item || null;
}

async function fetchAssetMetadata(assetPath: string): Promise<Record<string, any>> {
  const publishBaseUrl = getPublishBaseUrl();
  const normalizedAssetPath = normalizePath(assetPath);
  const metadataUrl = `${publishBaseUrl}${normalizedAssetPath}/_jcr_content/metadata.json`;

  const response = await fetch(metadataUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Metadata request failed');
  }

  return response.json();
}

function getImageMapValue(metadata: Record<string, any>): string {
  const value = metadata?.imageMap;
  if (value == null || value === '') return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function parseImageMap(imageMapValue: string): Hotspot[] {
  if (!imageMapValue) return [];
  const raw = typeof imageMapValue === 'string' ? imageMapValue : JSON.stringify(imageMapValue);
  if (!raw) return [];

  const pattern =
    /\[\s*circle\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*"([^"]+)"\s*\|\s*"([^"]*)"\s*\|\s*"([^"]*)"\s*\]/gi;
  const hotspots: Hotspot[] = [];
  let match = pattern.exec(raw);

  while (match) {
    hotspots.push({
      x: Number(match[1]),
      y: Number(match[2]),
      radius: Number(match[3]),
      href: match[4] ?? '',
      target: match[5] || '_self',
      label: match[6] || 'Hotspot',
    });
    match = pattern.exec(raw);
  }

  return hotspots.filter(
    (spot) => Number.isFinite(spot.x) && Number.isFinite(spot.y) && Number.isFinite(spot.radius) && !!spot.href,
  );
}

function resolveHotspotHref(href: string): string {
  const value = normalizePath(href);
  if (!value) return '#';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${getPublishBaseUrl()}${value}`;
  return value;
}

function resolveAssetUrl(path: string): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${getPublishBaseUrl()}${path}`;
}

function buildHotspotModal(block: HTMLElement): ModalRefs {
  const existing = block.querySelector<ModalElement>('.interactive-asset-modal');
  if (existing) {
    return {
      modal: existing,
      panel: existing.querySelector('.interactive-asset-modal-panel'),
      body: existing.querySelector('.interactive-asset-modal-body'),
    };
  }

  const modal = document.createElement('div') as ModalElement;
  modal.className = 'interactive-asset-modal';
  modal.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'interactive-asset-modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'interactive-asset-modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close popup');
  closeBtn.textContent = 'x';

  const body = document.createElement('div');
  body.className = 'interactive-asset-modal-body';

  const closeModal = () => {
    if (modal.repositionHandler) {
      window.removeEventListener('scroll', modal.repositionHandler);
      window.removeEventListener('resize', modal.repositionHandler);
      modal.repositionHandler = null;
    }
    panel.style.top = '';
    panel.style.left = '';
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  };

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  panel.append(closeBtn, body);
  modal.append(panel);
  block.append(modal);

  return { modal, panel, body };
}

function renderModalLoading(body: HTMLElement | null, label?: string): void {
  if (!body) return;
  body.innerHTML = '';
  const loading = document.createElement('p');
  loading.className = 'interactive-asset-modal-loading';
  loading.textContent = `Loading ${label || 'details'}...`;
  body.append(loading);
}

function renderModalError(body: HTMLElement | null, message: string): void {
  if (!body) return;
  body.innerHTML = '';
  const error = document.createElement('p');
  error.className = 'interactive-asset-modal-error';
  error.textContent = message;
  body.append(error);
}

function renderModalContent(
  body: HTMLElement | null,
  cfData: Record<string, any> | null,
  fallbackLabel?: string,
): void {
  if (!body) return;
  body.innerHTML = '';

  const title = document.createElement('h4');
  title.className = 'interactive-asset-modal-title';
  title.textContent = cfData?.name || fallbackLabel || 'Details';
  body.append(title);

  const imagePath = cfData?.image?.[PATH_KEY];
  if (imagePath) {
    const image = document.createElement('img');
    image.className = 'interactive-asset-modal-image';
    image.src = resolveAssetUrl(imagePath);
    image.alt = cfData?.name || fallbackLabel || 'Popup image';
    body.append(image);
  }

  if (cfData?.quote?.html) {
    const quote = document.createElement('blockquote');
    quote.className = 'interactive-asset-modal-quote';
    quote.innerHTML = cfData.quote.html;
    body.append(quote);
  }

  if (cfData?.description?.html) {
    const description = document.createElement('div');
    description.className = 'interactive-asset-modal-description';
    description.innerHTML = cfData.description.html;
    body.append(description);
  }

  if (!imagePath && !cfData?.quote?.html && !cfData?.description?.html) {
    const empty = document.createElement('p');
    empty.className = 'interactive-asset-modal-empty';
    empty.textContent = 'No detail content found for this hotspot.';
    body.append(empty);
  }
}

function positionHotspotModal(
  _modal: ModalElement,
  panel: HTMLElement | null,
  hotspotElement: HTMLElement | null,
  block: HTMLElement,
): void {
  if (!hotspotElement || !panel) return;

  const isDesktop = window.innerWidth >= 900;
  if (!isDesktop) {
    // Mobile/tablet: center in image container
    const mediaWrap = block.querySelector('.interactive-asset-media-wrap');
    if (mediaWrap) {
      const mediaRect = mediaWrap.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      panel.style.top = `${Math.max(mediaRect.top + (mediaRect.height - panelRect.height) / 2, 0)}px`;
      panel.style.left = `${Math.max(mediaRect.left + (mediaRect.width - panelRect.width) / 2, 0)}px`;
    }
  } else {
    // Desktop: position near hotspot
    const hotspotRect = hotspotElement.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gap = 0.75 * parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
    const margin = 12;
    const left = Math.min(
      Math.max(hotspotRect.left + hotspotRect.width / 2 - panelRect.width / 2, margin),
      window.innerWidth - panelRect.width - margin,
    );
    const top = Math.min(hotspotRect.bottom + gap, window.innerHeight - panelRect.height - margin);
    panel.style.left = `${Math.max(margin, left)}px`;
    panel.style.top = `${Math.max(margin, top)}px`;
  }
}

async function openHotspotModal(block: HTMLElement, hotspot: Hotspot, hotspotElement: HTMLElement): Promise<void> {
  const { modal, panel, body } = buildHotspotModal(block);
  if (modal.repositionHandler) {
    window.removeEventListener('scroll', modal.repositionHandler);
    window.removeEventListener('resize', modal.repositionHandler);
  }
  modal.repositionHandler = () => {
    positionHotspotModal(modal, panel, hotspotElement, block);
  };
  window.addEventListener('scroll', modal.repositionHandler, { passive: true });
  window.addEventListener('resize', modal.repositionHandler);
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  renderModalLoading(body, hotspot?.label);
  positionHotspotModal(modal, panel, hotspotElement, block);

  try {
    const cfData = await fetchTabDetailsData(hotspot?.href || '');
    if (!cfData) {
      renderModalError(body, 'No detail content found for this hotspot.');
      positionHotspotModal(modal, panel, hotspotElement, block);
      return;
    }
    renderModalContent(body, cfData, hotspot?.label);
    positionHotspotModal(modal, panel, hotspotElement, block);
  } catch (e) {
    renderModalError(body, 'Unable to load hotspot details right now.');
    positionHotspotModal(modal, panel, hotspotElement, block);
  }
}

function applyHotspotLayout(
  hotspotLayer: HTMLElement,
  hotspots: Hotspot[],
  sourceWidth: number,
  sourceHeight: number,
  onHotspotClick: (spot: Hotspot, hotspotElement: HTMLElement) => void,
): void {
  if (!sourceWidth || !sourceHeight) return;

  hotspotLayer.replaceChildren();
  hotspots.forEach((spot) => {
    const anchor = document.createElement('a');
    anchor.className = 'interactive-asset-hotspot';
    anchor.href = resolveHotspotHref(spot.href);
    anchor.target = spot.target || '_self';
    anchor.rel = anchor.target === '_blank' ? 'noopener noreferrer' : '';
    anchor.setAttribute('aria-label', spot.label || 'Hotspot');
    anchor.title = spot.label || 'Hotspot';
    anchor.style.left = `${(spot.x / sourceWidth) * 100}%`;
    anchor.style.top = `${(spot.y / sourceHeight) * 100}%`;
    anchor.style.width = `${((spot.radius * 2) / sourceWidth) * 100}%`;
    anchor.style.height = `${((spot.radius * 2) / sourceHeight) * 100}%`;
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      onHotspotClick(spot, anchor);
    });

    const label = document.createElement('span');
    label.className = 'interactive-asset-hotspot-label';
    label.textContent = spot.label;
    anchor.append(label);

    hotspotLayer.append(anchor);
  });
}

function renderInteractiveAsset(
  block: HTMLElement,
  assetPath: string,
  metadata: Record<string, any>,
  contentData: ContentData,
): void {
  const publishBaseUrl = getPublishBaseUrl();
  const imageMapValue = getImageMapValue(metadata);
  const hotspots = parseImageMap(imageMapValue);

  const wrapper = document.createElement('div');
  wrapper.className = 'interactive-asset-wrapper';

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'interactive-asset-media-wrap';

  const media = document.createElement('img');
  media.className = 'interactive-asset-image';
  media.src = `${publishBaseUrl}${assetPath}`;
  media.alt = metadata?.['dc:title'] || metadata?.['dc:description'] || 'Interactive asset';

  mediaWrap.append(media);

  if (hotspots.length) {
    const hotspotLayer = document.createElement('div');
    hotspotLayer.className = 'interactive-asset-hotspot-layer';
    mediaWrap.append(hotspotLayer);

    const fallbackWidth = Number(metadata?.['tiff:ImageWidth']) || Number(metadata?.['exif:PixelXDimension']) || 0;
    const fallbackHeight = Number(metadata?.['tiff:ImageLength']) || Number(metadata?.['exif:PixelYDimension']) || 0;

    const syncHotspots = () => {
      const sourceWidth = media.naturalWidth || fallbackWidth;
      const sourceHeight = media.naturalHeight || fallbackHeight;
      applyHotspotLayout(hotspotLayer, hotspots, sourceWidth, sourceHeight, (spot, hotspotElement) =>
        openHotspotModal(block, spot, hotspotElement),
      );
    };

    if (media.complete) {
      syncHotspots();
    } else {
      media.addEventListener('load', syncHotspots, { once: true });
    }
  }

  wrapper.append(mediaWrap);

  const content = document.createElement('div');
  content.className = 'interactive-asset-content';

  if (contentData.subtitle) {
    const subtitle = document.createElement('p');
    subtitle.className = 'interactive-asset-subtitle';
    subtitle.textContent = contentData.subtitle;
    content.append(subtitle);
  }

  if (contentData.title) {
    const title = document.createElement('div');
    title.className = 'interactive-asset-title';
    title.innerHTML = contentData.title;
    content.append(title);
  }

  if (contentData.description) {
    const description = document.createElement('div');
    description.className = 'interactive-asset-description';
    description.innerHTML = contentData.description;
    content.append(description);
  }

  wrapper.append(content);
  block.replaceChildren(wrapper);
}

function renderFailure(block: HTMLElement, message: string): void {
  const error = document.createElement('p');
  error.className = 'interactive-asset-error';
  error.textContent = message;
  block.replaceChildren(error);
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const cfPath = getAuthoredCfPath(block);
  const contentData: ContentData = {
    subtitle: getAuthoredField(block, 1),
    title: getAuthoredField(block, 2, true),
    description: getAuthoredField(block, 3, true),
  };
  if (!cfPath) {
    renderFailure(block, 'Content Fragment path is not authored.');
    return;
  }

  try {
    const cfData = await fetchTabDetailsData(cfPath);
    const assetPathText =
      cfData?.image?.[PATH_KEY] || cfData?.asset?.[PATH_KEY] || cfData?.assetPath || cfData?.imagePath || '';
    const assetPath = addDamPrefix(assetPathText);
    if (!assetPath) {
      renderFailure(block, 'No asset path was found in the Content Fragment.');
      return;
    }

    const metadata = await fetchAssetMetadata(assetPath);
    renderInteractiveAsset(block, assetPath, metadata, contentData);
  } catch (e) {
    renderFailure(block, 'Unable to load the interactive asset.');
  }
}
