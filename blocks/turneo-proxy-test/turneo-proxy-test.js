import { fetchExperiencesViaAppBuilder } from './turneo-appbuilder-api.js';

// ─── DOMPurify ────────────────────────────────────────────────────────────────

/** Lazy-load DOMPurify (UMD sets window.DOMPurify as a side-effect). */
async function loadDOMPurify() {
  if (!window.DOMPurify) {
    await import('../../scripts/dompurify.min.js');
  }
  return window.DOMPurify;
}

// ─── Error state ──────────────────────────────────────────────────────────────

/**
 * @param {unknown} error
 * @returns {HTMLElement}
 */
function buildError(error) {
  const box = document.createElement('div');
  box.className = 'turneo-proxy-test-error';

  const msg = document.createElement('p');
  msg.textContent = 'Could not load experiences from the App Builder API.';

  const detail = document.createElement('pre');
  detail.className = 'turneo-proxy-test-error-detail';
  detail.textContent = error instanceof Error ? error.message : String(error);

  box.append(msg, detail);
  return box;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} exp
 * @param {object|null} purify
 * @returns {HTMLElement}
 */
function buildCard(exp, purify) {
  const card = document.createElement('article');
  card.className = 'turneo-proxy-test-card';

  // Thumbnail
  const thumbnail = document.createElement('div');
  thumbnail.className = 'turneo-proxy-test-card-thumbnail';
  if (exp.image) {
    const img = document.createElement('img');
    img.src = exp.image;
    img.alt = exp.title;
    img.loading = 'lazy';
    img.onerror = () => {
      img.onerror = null;
      thumbnail.removeChild(img);
    };
    thumbnail.append(img);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'turneo-proxy-test-card-body';

  const titleEl = document.createElement('h3');
  titleEl.className = 'turneo-proxy-test-card-title';
  titleEl.textContent = exp.title;

  const desc = document.createElement('p');
  desc.className = 'turneo-proxy-test-card-desc';
  const rawHtml = exp.highlight || exp.description || '';
  desc.innerHTML = purify ? purify.sanitize(rawHtml) : '';

  const footer = document.createElement('div');
  footer.className = 'turneo-proxy-test-card-footer';

  if (exp.minPrice) {
    const price = document.createElement('span');
    price.className = 'turneo-proxy-test-card-price';
    price.textContent = `From ${exp.minPrice.currency} ${exp.minPrice.amount} / ${exp.minPrice.unit}`;
    footer.append(price);
  }

  body.append(titleEl, desc, footer);
  card.append(thumbnail, body);
  return card;
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────

/**
 * @param {Array} experiences
 * @param {object|null} purify  DOMPurify instance
 * @returns {HTMLElement[]}
 */
function buildGridChildren(experiences, purify) {
  if (!experiences.length) {
    const empty = document.createElement('p');
    empty.className = 'turneo-proxy-test-empty';
    empty.textContent = 'No experiences returned.';
    return [empty];
  }
  return experiences.map((exp) => buildCard(exp, purify));
}

/** @param {HTMLElement} gridEl */
function setGridLoading(gridEl) {
  gridEl.innerHTML = '';
  for (let i = 0; i < 8; i += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = 'turneo-proxy-test-skeleton';
    gridEl.append(skeleton);
  }
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

/**
 * @param {string} id
 * @param {string} label
 * @returns {HTMLElement}
 */
function buildDateField(id, label) {
  const group = document.createElement('div');
  group.className = 'turneo-proxy-test-filter-field';

  const lbl = document.createElement('label');
  lbl.className = 'turneo-proxy-test-filter-label';
  lbl.htmlFor = `tpt-${id}`;
  lbl.textContent = label;

  const inputWrap = document.createElement('div');
  inputWrap.className = 'turneo-proxy-test-filter-input-wrap';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 20 20');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('aria-hidden', 'true');
  // eslint-disable-next-line max-len
  icon.innerHTML = '<rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 8h16" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v4M14 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';

  const input = document.createElement('input');
  input.type = 'date';
  input.id = `tpt-${id}`;
  input.className = 'turneo-proxy-test-filter-input';
  input.min = new Date().toISOString().slice(0, 10);

  inputWrap.append(icon, input);
  group.append(lbl, inputWrap);
  return group;
}

/**
 * @param {function(string, string): Promise<void>} onSearch
 * @returns {HTMLElement}
 */
function buildFilter(onSearch) {
  const bar = document.createElement('div');
  bar.className = 'turneo-proxy-test-filter';

  const fromGroup = buildDateField('from', 'Check-in');
  const toGroup = buildDateField('to', 'Check-out');

  const fromInput = fromGroup.querySelector('input');
  const toInput = toGroup.querySelector('input');

  fromInput.addEventListener('change', () => {
    if (fromInput.value) toInput.min = fromInput.value;
  });
  toInput.addEventListener('change', () => {
    if (toInput.value) fromInput.max = toInput.value;
  });

  const btn = document.createElement('button');
  btn.className = 'turneo-proxy-test-filter-btn';
  btn.type = 'button';
  btn.textContent = 'Search';
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Searching\u2026';
    await onSearch(fromInput.value, toInput.value);
    btn.disabled = false;
    btn.textContent = 'Search';
  });

  bar.append(fromGroup, toGroup, btn);
  return bar;
}

// ─── Block entry point ────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  // Pre-load DOMPurify and initial data in parallel
  const [purifyResult, experiencesResult] = await Promise.allSettled([
    loadDOMPurify(),
    fetchExperiencesViaAppBuilder(),
  ]);

  const purify = purifyResult.status === 'fulfilled' ? purifyResult.value : null;

  const wrapper = document.createElement('div');
  wrapper.className = 'turneo-proxy-test-wrapper';

  const gridEl = document.createElement('div');
  gridEl.className = 'turneo-proxy-test-grid';

  const filterBar = buildFilter(async (from, to) => {
    setGridLoading(gridEl);
    try {
      const params = from || to ? { from: from || undefined, until: to || undefined } : undefined;
      const experiences = await fetchExperiencesViaAppBuilder(params);
      gridEl.replaceChildren(...buildGridChildren(experiences, purify));
    } catch (err) {
      gridEl.replaceChildren(buildError(err));
    }
  });

  // Render initial results
  if (experiencesResult.status === 'fulfilled') {
    gridEl.replaceChildren(...buildGridChildren(experiencesResult.value, purify));
  } else {
    gridEl.replaceChildren(buildError(experiencesResult.reason));
  }

  wrapper.append(filterBar, gridEl);
  block.replaceChildren(wrapper);
}
