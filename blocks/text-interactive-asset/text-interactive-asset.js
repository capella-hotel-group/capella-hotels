import { getPublishBaseUrl } from '../../scripts/env.js';

const TAB_LIST_QUERY = '/graphql/execute.json/capella-hotels/TabList';

function normalizePath(path) {
  return (path || '')
    .trim()
    .replace(/(\.plain)?\.html$/i, '')
    .replace(/\.json$/i, '')
    .replace(/\/$/, '');
}

function normalizeAssetCandidate(value) {
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

function getAuthoredAssetPath(block) {
  const rows = block.querySelectorAll(':scope > div');
  const row = [...rows].find((candidate) => candidate.querySelector('a, img'));
  const cell = row?.querySelector(':scope > div:last-child') || row?.querySelector(':scope > div');
  const link = cell?.querySelector('a');
  const image = cell?.querySelector('img');
  const authoredPath = link?.getAttribute('href') || image?.getAttribute('src') || '';
  return normalizeAssetCandidate(authoredPath).replace(/[#?].*$/, '').replace(/\/$/, '');
}

function getAuthoredImageMapPath(block) {
  const row = block.querySelectorAll(':scope > div')[1];
  const cell = row?.querySelector(':scope > div:last-child') || row?.querySelector(':scope > div');
  return cell?.textContent || '';
}

async function fetchTabDetailsData(cfPath) {
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

async function fetchAssetMetadata(assetPath) {
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

function createMetadataRows(metadata) {
  const preferredKeys = ['imageMap'];
  const rows = [];

  preferredKeys.forEach((key) => {
    const value = metadata?.[key];
    if (value == null || value === '') return;
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    rows.push({ key, value: displayValue });
  });

  return rows;
}

function parseImageMap(imageMapValue) {
  if (!imageMapValue) return [];
  const raw = typeof imageMapValue === 'string' ? imageMapValue : JSON.stringify(imageMapValue);
  if (!raw) return [];

  const pattern = /\[\s*circle\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*"([^"]+)"\s*\|\s*"([^"]*)"\s*\|\s*"([^"]*)"\s*\]/gi;
  const hotspots = [];
  let match = pattern.exec(raw);

  while (match) {
    hotspots.push({
      x: Number(match[1]),
      y: Number(match[2]),
      radius: Number(match[3]),
      href: match[4],
      target: match[5] || '_self',
      label: match[6] || 'Hotspot',
    });
    match = pattern.exec(raw);
  }

  return hotspots.filter((spot) => Number.isFinite(spot.x)
    && Number.isFinite(spot.y)
    && Number.isFinite(spot.radius)
    && !!spot.href);
}

function resolveHotspotHref(href) {
  const value = normalizePath(href);
  if (!value) return '#';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return `${getPublishBaseUrl()}${value}`;
  return value;
}

function resolveAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${getPublishBaseUrl()}${path}`;
}

function buildHotspotModal(block) {
  const existing = block.querySelector('.text-interactive-asset-modal');
  if (existing) {
    return {
      modal: existing,
      panel: existing.querySelector('.text-interactive-asset-modal-panel'),
      body: existing.querySelector('.text-interactive-asset-modal-body'),
    };
  }

  const modal = document.createElement('div');
  modal.className = 'text-interactive-asset-modal';
  modal.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'text-interactive-asset-modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'text-interactive-asset-modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close popup');
  closeBtn.textContent = 'x';

  const body = document.createElement('div');
  body.className = 'text-interactive-asset-modal-body';

  const closeModal = () => {
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

function renderModalLoading(body, label) {
  body.innerHTML = '';
  const loading = document.createElement('p');
  loading.className = 'text-interactive-asset-modal-loading';
  loading.textContent = `Loading ${label || 'details'}...`;
  body.append(loading);
}

function renderModalError(body, message) {
  body.innerHTML = '';
  const error = document.createElement('p');
  error.className = 'text-interactive-asset-modal-error';
  error.textContent = message;
  body.append(error);
}

function renderModalContent(body, cfData, fallbackLabel) {
  body.innerHTML = '';

  const title = document.createElement('h4');
  title.className = 'text-interactive-asset-modal-title';
  title.textContent = cfData?.name || fallbackLabel || 'Details';
  body.append(title);

  const { _path: imagePath } = cfData?.image || {};
  if (imagePath) {
    const image = document.createElement('img');
    image.className = 'text-interactive-asset-modal-image';
    image.src = resolveAssetUrl(imagePath);
    image.alt = cfData?.name || fallbackLabel || 'Popup image';
    body.append(image);
  }

  if (cfData?.quote?.html) {
    const quote = document.createElement('blockquote');
    quote.className = 'text-interactive-asset-modal-quote';
    quote.innerHTML = cfData.quote.html;
    body.append(quote);
  }

  if (cfData?.description?.html) {
    const description = document.createElement('div');
    description.className = 'text-interactive-asset-modal-description';
    description.innerHTML = cfData.description.html;
    body.append(description);
  }

  if (!imagePath && !cfData?.quote?.html && !cfData?.description?.html) {
    const empty = document.createElement('p');
    empty.className = 'text-interactive-asset-modal-empty';
    empty.textContent = 'No detail content found for this hotspot.';
    body.append(empty);
  }
}

async function openHotspotModal(block, hotspot) {
  const { modal, body } = buildHotspotModal(block);
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  renderModalLoading(body, hotspot?.label);

  try {
    const cfData = await fetchTabDetailsData(hotspot?.href || '');
    if (!cfData) {
      renderModalError(body, 'No detail content found for this hotspot.');
      return;
    }
    renderModalContent(body, cfData, hotspot?.label);
  } catch (e) {
    renderModalError(body, 'Unable to load hotspot details right now.');
  }
}

function applyHotspotLayout(hotspotLayer, hotspots, sourceWidth, sourceHeight, onHotspotClick) {
  if (!sourceWidth || !sourceHeight) return;

  hotspotLayer.replaceChildren();
  hotspots.forEach((spot) => {
    const anchor = document.createElement('a');
    anchor.className = 'text-interactive-asset-hotspot';
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
      onHotspotClick(spot);
    });

    const label = document.createElement('span');
    label.className = 'text-interactive-asset-hotspot-label';
    label.textContent = spot.label;
    anchor.append(label);

    hotspotLayer.append(anchor);
  });
}

function renderInteractiveAsset(block, assetPath, metadata, imageMapPathText) {
  const publishBaseUrl = getPublishBaseUrl();
  const hotspots = parseImageMap(metadata?.imageMap);

  const wrapper = document.createElement('div');
  wrapper.className = 'text-interactive-asset-wrapper';

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'text-interactive-asset-media-wrap';

  const media = document.createElement('img');
  media.className = 'text-interactive-asset-image';
  media.src = `${publishBaseUrl}${assetPath}`;
  media.alt = metadata?.['dc:title'] || metadata?.['dc:description'] || 'Interactive asset';

  const assetLink = document.createElement('a');
  assetLink.className = 'text-interactive-asset-link';
  assetLink.href = resolveAssetUrl(assetPath);
  assetLink.target = '_blank';
  assetLink.rel = 'noopener noreferrer';
  assetLink.append(media);
  mediaWrap.append(assetLink);

  if (hotspots.length) {
    const hotspotLayer = document.createElement('div');
    hotspotLayer.className = 'text-interactive-asset-hotspot-layer';
    mediaWrap.append(hotspotLayer);

    const fallbackWidth = Number(metadata?.['tiff:ImageWidth']) || Number(metadata?.['exif:PixelXDimension']) || 0;
    const fallbackHeight = Number(metadata?.['tiff:ImageLength']) || Number(metadata?.['exif:PixelYDimension']) || 0;

    const syncHotspots = () => {
      const sourceWidth = media.naturalWidth || fallbackWidth;
      const sourceHeight = media.naturalHeight || fallbackHeight;
      applyHotspotLayout(hotspotLayer, hotspots, sourceWidth, sourceHeight, (spot) => {
        openHotspotModal(block, spot);
      });
    };

    if (media.complete) {
      syncHotspots();
    } else {
      media.addEventListener('load', syncHotspots, { once: true });
    }
  }

  wrapper.append(mediaWrap);

  const content = document.createElement('div');
  content.className = 'text-interactive-asset-content';

  const imageMapPath = document.createElement('p');
  imageMapPath.className = 'text-interactive-asset-image-map-path';
  imageMapPath.textContent = imageMapPathText;
  content.append(imageMapPath);

  const metadataRows = createMetadataRows(metadata);
  if (metadataRows.length) {
    const list = document.createElement('dl');
    list.className = 'text-interactive-asset-metadata';

    metadataRows.forEach(({ key, value }) => {
      const dt = document.createElement('dt');
      dt.textContent = key;

      const dd = document.createElement('dd');
      dd.textContent = value;

      list.append(dt, dd);
    });

    content.append(list);
  }

  wrapper.append(content);
  block.replaceChildren(wrapper);
}

function renderFailure(block, message) {
  const error = document.createElement('p');
  error.className = 'text-interactive-asset-error';
  error.textContent = message;
  block.replaceChildren(error);
}

export default async function decorate(block) {
  const authoredAssetPath = getAuthoredAssetPath(block);
  const imageMapPathText = getAuthoredImageMapPath(block);
  const imageMapPath = imageMapPathText.trim();
  if (!authoredAssetPath) {
    renderFailure(block, 'Asset path is not authored.');
    return;
  }

  if (!imageMapPath) {
    renderFailure(block, 'Image map asset path is not authored.');
    return;
  }

  try {
    const metadata = await fetchAssetMetadata(imageMapPath);
    renderInteractiveAsset(block, authoredAssetPath, metadata, imageMapPathText);
  } catch (e) {
    renderInteractiveAsset(block, authoredAssetPath, {}, imageMapPathText);
  }
}
