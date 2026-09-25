import { fetchExperiencesViaAppBuilder, APP_BUILDER_ORIGIN, type TurneoExperience } from './turneo-appbuilder-api.js';
import { buildWidgetExperienceParam, mountWidgetDetail } from '@/utils/turneo-widget-api';

/** Opens the connection to the App Builder host early, in parallel with page/JS parsing. */
function preconnectAppBuilder(): void {
  if (document.head.querySelector(`link[href="${APP_BUILDER_ORIGIN}"]`)) return;

  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = APP_BUILDER_ORIGIN;
  preconnect.crossOrigin = 'anonymous';
  document.head.append(preconnect);
}

// ─── DOMPurify ────────────────────────────────────────────────────────────────

/** Lazy-load DOMPurify so it stays in its own code-split chunk. */
async function loadDOMPurify() {
  const { default: DOMPurify } = await import('dompurify');
  return DOMPurify;
}

// ─── Error state ──────────────────────────────────────────────────────────────

function buildError(error: unknown): HTMLElement {
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

// ─── Detail actions (redirect vs. in-place) ──────────────────────────────────

/** Swaps this block's own content for the real turneo-widget, without a page reload. */
function showDetailInPlace(block: HTMLElement, exp: TurneoExperience): void {
  const param = buildWidgetExperienceParam(exp.id, exp.title);
  const url = new URL(window.location.href);
  url.searchParams.set('turneoExperience', param);
  window.history.pushState({ turneoExperience: param }, '', url);

  block.replaceChildren();
  mountWidgetDetail(block);

  window.addEventListener(
    'popstate',
    () => {
      window.location.reload();
    },
    { once: true },
  );
}

function buildDetailActions(block: HTMLElement, exp: TurneoExperience, detailPagePath: string): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'turneo-proxy-test-card-actions';

  const param = buildWidgetExperienceParam(exp.id, exp.title);

  if (detailPagePath) {
    const redirectLink = document.createElement('a');
    redirectLink.className = 'turneo-proxy-test-card-action turneo-proxy-test-card-action--redirect';
    redirectLink.textContent = 'View Detail (New Page)';
    const detailUrl = new URL(detailPagePath, window.location.origin);
    detailUrl.searchParams.set('turneoExperience', param);
    redirectLink.href = detailUrl.toString();
    actions.append(redirectLink);
  }

  const inPlaceBtn = document.createElement('button');
  inPlaceBtn.type = 'button';
  inPlaceBtn.className = 'turneo-proxy-test-card-action turneo-proxy-test-card-action--inplace';
  inPlaceBtn.textContent = 'View Detail (This Page)';
  inPlaceBtn.addEventListener('click', () => showDetailInPlace(block, exp));
  actions.append(inPlaceBtn);

  return actions;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function buildCard(
  block: HTMLElement,
  exp: TurneoExperience,
  purify: { sanitize: (html: string) => string } | null,
  detailPagePath: string,
): HTMLElement {
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

  footer.append(buildDetailActions(block, exp, detailPagePath));

  body.append(titleEl, desc, footer);
  card.append(thumbnail, body);
  return card;
}

// ─── Grid helpers ─────────────────────────────────────────────────────────────

function buildGridChildren(
  block: HTMLElement,
  experiences: TurneoExperience[],
  purify: { sanitize: (html: string) => string } | null,
  detailPagePath: string,
): HTMLElement[] {
  if (!experiences.length) {
    const empty = document.createElement('p');
    empty.className = 'turneo-proxy-test-empty';
    empty.textContent = 'No experiences returned.';
    return [empty];
  }
  return experiences.map((exp) => buildCard(block, exp, purify, detailPagePath));
}

function setGridLoading(gridEl: HTMLElement): void {
  gridEl.innerHTML = '';
  for (let i = 0; i < 8; i += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = 'turneo-proxy-test-skeleton';
    gridEl.append(skeleton);
  }
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function buildDateField(id: string, label: string): HTMLDivElement {
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

  icon.innerHTML =
    '<rect x="2" y="4" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 8h16" stroke="currentColor" stroke-width="1.5"/><path d="M6 2v4M14 2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';

  const input = document.createElement('input');
  input.type = 'date';
  input.id = `tpt-${id}`;
  input.className = 'turneo-proxy-test-filter-input';
  const today = new Date();
  input.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  inputWrap.append(icon, input);
  group.append(lbl, inputWrap);
  return group;
}

function buildFilter(onSearch: (from: string, to: string) => Promise<void>): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'turneo-proxy-test-filter';

  const fromGroup = buildDateField('from', 'Check-in');
  const toGroup = buildDateField('to', 'Check-out');

  const fromInput = fromGroup.querySelector<HTMLInputElement>('input')!;
  const toInput = toGroup.querySelector<HTMLInputElement>('input')!;

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
    try {
      await onSearch(fromInput.value, toInput.value);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Search';
    }
  });

  bar.append(fromGroup, toGroup, btn);
  return bar;
}

// ─── Block entry point ────────────────────────────────────────────────────────

export default async function decorate(block: HTMLElement): Promise<void> {
  preconnectAppBuilder();

  // Model fields → cell indices:
  //   cells[0] = storeId (text)
  //   cells[1] = detailPagePath (text)
  const row = block.children[0] as HTMLElement | undefined;
  const cells = row ? ([...row.children] as HTMLElement[]) : [];
  const storeId = cells[0]?.querySelector('p')?.textContent?.trim() || '';
  const detailPagePath = cells[1]?.querySelector('p')?.textContent?.trim() || '';

  // Detail route (`?turneoExperience=<id>_<slug>`) — hand off to the real turneo-widget to render it.
  if (new URLSearchParams(window.location.search).get('turneoExperience')) {
    block.replaceChildren();
    mountWidgetDetail(block);
    return;
  }

  // Render the shell (filter bar + a "Load Experiences" CTA) synchronously with zero network
  // dependency. The App Builder fetch only fires once the user explicitly asks for it — nothing
  // loads automatically, so initial paint never waits on the third-party API.
  let purify: { sanitize: (html: string) => string } | null = null;

  const wrapper = document.createElement('div');
  wrapper.className = 'turneo-proxy-test-wrapper';

  const gridEl = document.createElement('div');
  gridEl.className = 'turneo-proxy-test-grid';

  const loadSection = document.createElement('div');
  loadSection.className = 'turneo-proxy-test-load';
  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.className = 'turneo-proxy-test-load-btn';
  loadBtn.textContent = 'Load Experiences';
  loadSection.append(loadBtn);

  let loaded = false;

  async function loadExperiences(params?: { from?: string; until?: string }): Promise<void> {
    if (!loaded) {
      loaded = true;
      loadSection.replaceWith(gridEl);
    }
    setGridLoading(gridEl);
    try {
      const [purifyResult, experiencesResult] = await Promise.allSettled([
        purify ? Promise.resolve(purify) : loadDOMPurify(),
        fetchExperiencesViaAppBuilder({ storeId: storeId || undefined, ...params }),
      ]);
      purify = purifyResult.status === 'fulfilled' ? purifyResult.value : purify;
      if (experiencesResult.status === 'fulfilled') {
        gridEl.replaceChildren(...buildGridChildren(block, experiencesResult.value, purify, detailPagePath));
      } else {
        gridEl.replaceChildren(buildError(experiencesResult.reason));
      }
    } catch (err) {
      gridEl.replaceChildren(buildError(err));
    }
  }

  loadBtn.addEventListener('click', () => loadExperiences(), { once: true });

  const filterBar = buildFilter(async (from, to) => {
    await loadExperiences({ from: from || undefined, until: to || undefined });
  });

  wrapper.append(filterBar, loadSection);
  block.replaceChildren(wrapper);
}
