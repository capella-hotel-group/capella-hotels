import { getPublishBaseUrl } from '../../scripts/env.js';

const CARD_LIST_QUERY = '/graphql/execute.json/capella-hotels/CardList';

function getAuthoredCfPath(block) {
  const firstRow = block.querySelector(':scope > div');
  const cell = firstRow?.querySelector(':scope > div:last-child') || firstRow?.querySelector(':scope > div');
  if (!cell) return '';
  const link = cell.querySelector('a');
  const rawPath = (link?.getAttribute('href') || cell.textContent || '').trim();
  if (!rawPath) return '';

  try {
    return new URL(rawPath).pathname;
  } catch (e) {
    return rawPath;
  }
}

function normalizePath(path) {
  return (path || '').trim().replace(/\.json$/, '');
}

function isAssetPath(value) {
  return typeof value === 'string' && value.startsWith('/content/dam/');
}

function scoreAssetPath(path) {
  let score = 0;
  if (/\.(png|jpe?g|gif|webp|svg|avif|mp4|webm|pdf)$/i.test(path)) score += 5;
  if (!path.includes('/fragments/')) score += 3;
  if (path.includes('/home/')) score += 1;
  return score;
}

function collectAssetPathCandidates(node, out = []) {
  if (!node) return out;

  if (typeof node === 'string') {
    if (isAssetPath(node)) out.push(node);
    return out;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectAssetPathCandidates(item, out));
    return out;
  }

  if (typeof node === 'object') {
    const directKeyOrder = ['assetPath', '_path', 'path', 'fileReference', 'imagePath', 'url'];
    directKeyOrder.forEach((key) => {
      const value = node[key];
      if (isAssetPath(value)) out.push(value);
    });

    Object.values(node).forEach((value) => collectAssetPathCandidates(value, out));
  }

  return out;
}

function extractAssetPath(graphqlData) {
  const candidates = collectAssetPathCandidates(graphqlData?.data || graphqlData)
    .map((candidate) => candidate.trim())
    .filter(Boolean);

  if (!candidates.length) return null;

  const ranked = [...new Set(candidates)]
    .sort((a, b) => scoreAssetPath(b) - scoreAssetPath(a));

  return ranked[0] || null;
}

async function fetchCardListData(cfPath) {
  const publishBaseUrl = getPublishBaseUrl();
  const normalizedCfPath = normalizePath(cfPath);
  const url = `${publishBaseUrl}${CARD_LIST_QUERY};path=${normalizedCfPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('CardList request failed');
  }

  return response.json();
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
  const preferredKeys = ['dc:title', 'dc:description', 'dc:format', 'dam:size', 'tiff:ImageWidth', 'tiff:ImageLength', 'imageMap'];
  const rows = [];

  preferredKeys.forEach((key) => {
    const value = metadata?.[key];
    if (value == null || value === '') return;
    const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    rows.push({ key, value: displayValue });
  });

  return rows;
}

function renderInteractiveAsset(block, assetPath, metadata) {
  const publishBaseUrl = getPublishBaseUrl();

  const wrapper = document.createElement('div');
  wrapper.className = 'text-interactive-asset-wrapper';

  const media = document.createElement('img');
  media.className = 'text-interactive-asset-image';
  media.src = `${publishBaseUrl}${assetPath}`;
  media.alt = metadata?.['dc:title'] || metadata?.['dc:description'] || 'Interactive asset';
  wrapper.append(media);

  const content = document.createElement('div');
  content.className = 'text-interactive-asset-content';

  const title = document.createElement('h3');
  title.className = 'text-interactive-asset-title';
  title.textContent = metadata?.['dc:title'] || 'Interactive Asset';
  content.append(title);

  if (metadata?.['dc:description']) {
    const description = document.createElement('p');
    description.className = 'text-interactive-asset-description';
    description.textContent = metadata['dc:description'];
    content.append(description);
  }

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
  const cfPath = getAuthoredCfPath(block);
  if (!cfPath) {
    renderFailure(block, 'Interactive asset path is not authored.');
    return;
  }

  try {
    const graphqlData = await fetchCardListData(cfPath);
    const assetPath = extractAssetPath(graphqlData);

    if (!assetPath) {
      renderFailure(block, 'No asset was found for the authored Content Fragment path.');
      return;
    }

    try {
      const metadata = await fetchAssetMetadata(assetPath);
      renderInteractiveAsset(block, assetPath, metadata);
    } catch (e) {
      renderInteractiveAsset(block, assetPath, {});
    }
  } catch (e) {
    renderFailure(block, 'Unable to load interactive asset content right now.');
  }
}
