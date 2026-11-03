import { moveInstrumentation } from '@/app/scripts.js';
import { applyBlockIdentity } from '@/utils/block-identity.js';
import { getPublishBaseUrl, resolveDAMUrl } from '@/utils/env.js';

const PERSISTED_QUERY = '/graphql/execute.json/capella-hotels/Filter-grid-card';
const PAGE_SIZE = 6;
const CATEGORY_COLORS = new Set(['dark-brown', 'light-brown', 'green', 'pink', 'blue', 'white']);
const ITEM_MODEL = 'filters-grid-tab';

const ALLOWED_RICH_TEXT_TAGS = new Set(['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote']);

interface Reference {
  _path?: string | null;
  _publishUrl?: string | null;
}

interface ModalDetails {
  modalDescription?: { html?: string | null } | null;
  modalImageAspectRatioVariant?: string | null;
  modalFeatureImageAsset?: Reference | null;
  modalFeatureImageAssetAltText?: string | null;
  carouselImages?: Array<Reference | null> | null;
  carouselImagesAltText?: Array<string | null> | null;
  modalCtaUrlType?: string | null;
  modalCtaLabel?: string | null;
  modalCtaUrlInternal?: Reference | null;
  modalCtaUrlExternal?: string | null;
  openInNewTab?: boolean | null;
}

export interface FilterGridCard {
  _path?: string;
  cardLocationTag?: string[] | null;
  cardHeadline?: string | null;
  cardBackgroundPhoto?: Reference | null;
  cardBackgroundPhotoAltText?: string | null;
  associatedFilterTags?: string[] | null;
  cardClickActionBehavior?: string | null;
  directDestinationUrlType?: string | null;
  directDestinationUrl?: Reference | null;
  directDestinationExternalUrl?: string | null;
  openInNewTab?: boolean | null;
  modalDetails?: ModalDetails | null;
}

interface AuthoredFilter {
  label: string;
  tag: string;
  backgroundColor?: string;
  isDefault?: boolean;
}

interface ModeSetting {
  key: string;
  label: string;
  rootTag: string;
  isDefault?: boolean;
  filters?: AuthoredFilter[];
  source?: HTMLElement;
  labelElement?: Element;
}

interface CategorySetting {
  tag: string;
  backgroundColor: string;
  isDefault?: boolean;
}

interface AuthoredMode extends ModeSetting {
  filters: AuthoredFilter[];
}

interface BlockConfig {
  eyebrow: string;
  titleHtml: string;
  backgroundTheme: string;
  cfRootPath: string;
  revealMoreLabel: string;
  defaultMode: string;
  modeSettings: ModeSetting[];
  categorySettings: CategorySetting[];
  showModeLabels: boolean;
  useAuthoredFilters: boolean;
  itemLayout?: boolean;
  headingElements?: Element[];
  revealElement?: Element;
}

const textOf = (element?: Element | null): string => element?.textContent?.trim() || '';

export function normalizeChoice(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function normalizeColor(value: string): string {
  return normalizeChoice(value).replace(/\s+/g, '-');
}

function referenceUrl(reference?: Reference | null): string {
  const value = reference?._publishUrl || reference?._path || '';
  return value ? resolveDAMUrl(value) : '';
}

export function resolveCardHref(
  card: Pick<FilterGridCard, 'directDestinationUrlType' | 'directDestinationUrl' | 'directDestinationExternalUrl'>,
): string {
  if (normalizeChoice(card.directDestinationUrlType) === 'external') {
    return card.directDestinationExternalUrl?.trim() || '';
  }
  return referenceUrl(card.directDestinationUrl);
}

function resolveModalHref(details: ModalDetails): string {
  if (normalizeChoice(details.modalCtaUrlType) === 'external') {
    return details.modalCtaUrlExternal?.trim() || '';
  }
  return referenceUrl(details.modalCtaUrlInternal);
}

export function cardMatchesFilter(
  card: Pick<FilterGridCard, 'cardLocationTag' | 'associatedFilterTags'>,
  _mode: string,
  tag: string,
): boolean {
  if (!tag) return true;
  const values = [...(card.cardLocationTag || []), ...(card.associatedFilterTags || [])];
  return values.some((value) => normalizeTagId(value) === normalizeTagId(tag));
}

export function tagIsWithinRoot(tag: string, rootTag: string): boolean {
  const normalizedRoot = normalizeTagId(rootTag).replace(/\/+$/, '');
  return Boolean(normalizedRoot && normalizeTagId(tag).startsWith(`${normalizedRoot}/`));
}

function normalizeTagId(value: string): string {
  const tag = value.trim();
  const repositoryPrefix = '/content/cq:tags/';
  if (!tag.startsWith(repositoryPrefix)) return tag;
  const [namespace, ...path] = tag.slice(repositoryPrefix.length).split('/');
  return namespace && path.length ? `${namespace}:${path.join('/')}` : tag;
}

function labelFromTag(tag?: string | null): string {
  const slug = (tag || '').split('/').pop()?.split(':').pop() || '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function rowValue(row: Element | undefined, name: string): string {
  if (!row) return '';
  return textOf(row.querySelector(`[data-aue-prop="${name}"]`) || row.firstElementChild || row);
}

function rowHtml(row: Element | undefined, name: string): string {
  if (!row) return '';
  const field = row.querySelector(`[data-aue-prop="${name}"]`) || row.firstElementChild || row;
  return field.innerHTML;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character] || character;
  });
}

export function resolvePickerPath(value: string, baseUrl: string): string {
  const normalizedValue = value.trim();
  if (!normalizedValue) return '';
  try {
    return new URL(normalizedValue, baseUrl).pathname.replace(/\.html$/i, '');
  } catch {
    return normalizedValue.replace(/\.html$/i, '');
  }
}

function rowHref(row: Element | undefined, name: string): string {
  if (!row) return '';
  const field = row.querySelector(`[data-aue-prop="${name}"]`) || row.firstElementChild || row;
  const anchor = field.matches('a[href]') ? field : field.querySelector('a[href]');
  const value = anchor?.getAttribute('href') || textOf(field);
  return resolvePickerPath(value, window.location.origin);
}

function multiFieldEntries(field: Element): Element[] {
  if (field.querySelector(':scope > hr')) {
    const groups: Element[] = [];
    let group = document.createElement('div');
    [...field.childNodes].forEach((node) => {
      if (node instanceof HTMLElement && node.tagName === 'HR') {
        if (textOf(group)) groups.push(group);
        group = document.createElement('div');
      } else {
        group.append(node.cloneNode(true));
      }
    });
    if (textOf(group)) groups.push(group);
    return groups;
  }

  return [...field.querySelectorAll('li')].filter((entry) => {
    let ancestor = entry.parentElement;
    while (ancestor && ancestor !== field) {
      if (ancestor.tagName === 'LI') return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

function isTagValue(value: string): boolean {
  return /^(\/content\/cq:tags\/|[^\s/:]+:)/.test(value);
}

function parseCategoryEntry(entry: Element): AuthoredFilter | undefined {
  const tagLink = entry.querySelector<HTMLAnchorElement>('a[href*="/content/cq:tags/"]');
  const values = [...entry.querySelectorAll('*')]
    .filter((element) => element.children.length === 0)
    .map(textOf)
    .filter(Boolean);
  const tag =
    tagLink?.getAttribute('href') ||
    textOf(entry.querySelector('[data-aue-prop="categoryTag"]')) ||
    values.find(isTagValue) ||
    '';
  if (!tag) return undefined;

  const checkbox = entry.querySelector<HTMLInputElement>('input[type="checkbox"]');
  const defaultValue =
    textOf(entry.querySelector('[data-aue-prop="isDefaultCategory"]')) ||
    values.find((value) => ['true', 'false'].includes(normalizeChoice(value)));
  const authoredColor =
    textOf(entry.querySelector('[data-aue-prop="backgroundColor"]')) ||
    values.find((value) => CATEGORY_COLORS.has(normalizeColor(value))) ||
    'white';
  const linkLabel = tagLink?.textContent?.trim() || '';
  return {
    tag: normalizeTagId(tag),
    label: linkLabel && !isTagValue(linkLabel) ? linkLabel : labelFromTag(tag),
    backgroundColor: CATEGORY_COLORS.has(normalizeColor(authoredColor)) ? normalizeColor(authoredColor) : 'white',
    isDefault: checkbox
      ? checkbox.checked
      : defaultValue === undefined
        ? false
        : normalizeChoice(defaultValue) === 'true',
  };
}

function parseModeCategorySettings(entry: Element, rootTag: string): AuthoredFilter[] {
  const categoryField = entry.querySelector('[data-aue-prop="categorySettings"]');
  if (categoryField) {
    return multiFieldEntries(categoryField)
      .map(parseCategoryEntry)
      .filter((category): category is AuthoredFilter => Boolean(category));
  }

  const candidates = [...entry.querySelectorAll('li')].filter((item) => {
    const tag =
      item.querySelector<HTMLAnchorElement>('a[href*="/content/cq:tags/"]')?.getAttribute('href') ||
      textOf(item.querySelector('[data-aue-prop="categoryTag"]')) ||
      [...item.querySelectorAll('*')]
        .filter((element) => element.children.length === 0)
        .map(textOf)
        .find(isTagValue) ||
      '';
    if (!tag || normalizeTagId(tag) === normalizeTagId(rootTag)) return false;
    return ![...item.querySelectorAll('li')].some((child) => {
      const childTag =
        child.querySelector<HTMLAnchorElement>('a[href*="/content/cq:tags/"]')?.getAttribute('href') ||
        [...child.querySelectorAll('*')]
          .filter((element) => element.children.length === 0)
          .map(textOf)
          .find(isTagValue) ||
        '';
      return childTag && normalizeTagId(childTag) !== normalizeTagId(rootTag);
    });
  });
  return candidates.map(parseCategoryEntry).filter((category): category is AuthoredFilter => Boolean(category));
}

function parseModeSettings(row: Element | undefined): ModeSetting[] {
  if (!row) return [];
  const field = row.querySelector('[data-aue-prop="filterModeLabels"]') || row.firstElementChild || row;
  const entries = multiFieldEntries(field);
  return entries.map((entry, index) => {
    const walker = document.createTreeWalker(entry, NodeFilter.SHOW_TEXT);
    const values: string[] = [];
    while (walker.nextNode()) {
      const value = walker.currentNode.textContent?.trim();
      if (value) values.push(value);
    }
    const rootTag =
      entry.querySelector('a[href*="/content/cq:tags/"]')?.getAttribute('href') ||
      textOf(entry.querySelector('[data-aue-prop="rootTag"]')) ||
      values.find(isTagValue) ||
      '';
    const filters = parseModeCategorySettings(entry, rootTag);
    const checkbox = entry.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const defaultValue =
      textOf(entry.querySelector('[data-aue-prop="isDefault"]')) ||
      values.find((value) => ['true', 'false'].includes(normalizeChoice(value)));
    const isDefault =
      filters.length > 0
        ? undefined
        : checkbox
          ? checkbox.checked
          : defaultValue === undefined
            ? undefined
            : normalizeChoice(defaultValue) === 'true';
    const label =
      textOf(entry.querySelector('[data-aue-prop="label"]')) ||
      values.find(
        (value) =>
          value !== rootTag &&
          !['true', 'false'].includes(normalizeChoice(value)) &&
          !isTagValue(value) &&
          !CATEGORY_COLORS.has(normalizeColor(value)),
      ) ||
      labelFromTag(rootTag) ||
      'Filter mode';
    return {
      key: `mode-${index}`,
      label,
      rootTag,
      isDefault,
      filters,
    };
  });
}

function parseCategorySettings(row: Element | undefined): CategorySetting[] {
  if (!row) return [];
  const field = row.querySelector('[data-aue-prop="categorySettings"]') || row.firstElementChild || row;
  return multiFieldEntries(field)
    .map(parseCategoryEntry)
    .filter((category): category is AuthoredFilter => Boolean(category))
    .map(({ tag, backgroundColor, isDefault }) => ({
      tag,
      backgroundColor: backgroundColor || 'white',
      isDefault,
    }));
}

function rowBoolean(row: Element | undefined, name: string, fallback: boolean): boolean {
  if (!row) return fallback;
  const checkbox = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox) return checkbox.checked;
  const value = rowValue(row, name);
  return value ? normalizeChoice(value) === 'true' : fallback;
}

function parseConfig(block: HTMLElement): BlockConfig {
  const allRows = [...block.children] as HTMLElement[];
  let itemRows = allRows.filter((row) =>
    row.dataset.aueModel ? row.dataset.aueModel === ITEM_MODEL : row.children.length > 1,
  );
  let parentRows = allRows.filter((row) => !itemRows.includes(row));
  const parentRootIndex = parentRows.findIndex((row) => {
    if (row.querySelector('[data-aue-prop="cfRootPath"]')) return true;
    const value = row.querySelector('a[href]')?.getAttribute('href') || textOf(row);
    return /^(?:https?:\/\/[^/]+)?\/content\/dam(?:\/|$)/i.test(value);
  });
  const hasParentItemFields =
    parentRootIndex >= 0 &&
    !parentRows[parentRootIndex + 2]?.querySelector('hr, ul, ol, [data-aue-prop="filterModeLabels"]') &&
    (parentRows.length - parentRootIndex === 3 || Boolean(textOf(parentRows[parentRootIndex + 2]))) &&
    (['true', 'false'].includes(normalizeChoice(textOf(parentRows[parentRootIndex + 1]))) ||
      Boolean(parentRows[parentRootIndex + 1]?.querySelector('input[type="checkbox"]')));
  if (hasParentItemFields) {
    const revealRow = parentRows[parentRootIndex + 2];
    const firstItemIndex = revealRow ? allRows.indexOf(revealRow) + 1 : allRows.length;
    itemRows = allRows.slice(firstItemIndex);
    parentRows = allRows.slice(0, firstItemIndex);
  }
  const hasItemLayout = itemRows.length > 0 || hasParentItemFields;
  if (hasItemLayout) {
    const rows = applyBlockIdentity(block, parentRows, { contentRows: 5, hiddenClass: 'filters-grid-config' });
    const [eyebrow, title, root, showLabels, reveal] = rows;
    rows.forEach((row) => row.classList.add('filters-grid-config'));
    return {
      eyebrow: rowValue(eyebrow, 'eyebrow'),
      titleHtml: rowHtml(title, 'title'),
      cfRootPath: rowHref(root, 'cfRootPath'),
      showModeLabels: rowBoolean(showLabels, 'showModeLabels', true),
      revealMoreLabel: rowValue(reveal, 'revealMoreLabel') || 'Reveal More',
      backgroundTheme: 'white',
      defaultMode: '',
      categorySettings: [],
      useAuthoredFilters: true,
      itemLayout: true,
      headingElements: [eyebrow?.firstElementChild, title?.firstElementChild].filter((element): element is Element =>
        Boolean(element),
      ),
      revealElement: reveal?.firstElementChild || undefined,
      modeSettings: itemRows.map((row, index) => {
        const cells = [...row.children];
        const categoryCell =
          row.querySelector('[data-aue-prop="categorySettings"]') ||
          cells.find((cell) => cell.querySelector('hr, ul, ol')) ||
          cells[1];
        const labelElement =
          row.querySelector('[data-aue-prop="label"]') || cells.find((cell) => cell !== categoryCell);
        const filters = categoryCell
          ? multiFieldEntries(categoryCell)
              .map(parseCategoryEntry)
              .filter((filter): filter is AuthoredFilter => Boolean(filter))
          : [];
        return {
          key: `mode-${index}`,
          label: textOf(labelElement) || 'Filter mode',
          rootTag: '',
          filters,
          source: row,
          labelElement,
        };
      }),
    };
  }
  const legacy = allRows.length >= 10 && !block.querySelector('[data-aue-prop="filterModeLabels"]');
  const rootIndex = allRows.findIndex((row) => {
    if (row.querySelector('[data-aue-prop="cfRootPath"]')) return true;
    const href = row.querySelector('a[href]')?.getAttribute('href');
    return /^(?:https?:\/\/[^/]+)?\/content\/dam(?:\/|$)/i.test(href || textOf(row));
  });
  const themeOptions = new Set([
    'white',
    'terracotta',
    'brown',
    'sage-green',
    'soft-blush',
    'dark-navy-blue',
    'light-neutral',
    'sand',
    'dark-brown',
    'light-brown',
    'green',
    'pink',
    'blue',
  ]);
  const firstValue = rowValue(allRows[0], 'id').toLowerCase();
  const hasNewModel =
    Boolean(block.querySelector('[data-aue-prop="categorySettings"], [data-aue-prop="showModeLabels"]')) ||
    (rootIndex >= 0 && rootIndex <= 4 && allRows.length - rootIndex >= 4 && !themeOptions.has(firstValue));
  if (hasNewModel) {
    const rowsAfterRoot = rootIndex >= 0 ? allRows.length - rootIndex : 0;
    const useAuthoredFilters = rowsAfterRoot === 4;
    const contentRowCount = useAuthoredFilters ? 6 : 7;
    const contentRows = applyBlockIdentity(block, allRows, { contentRows: contentRowCount });
    const [eyebrow, title, cfRootPath] = contentRows;
    const modeRow = contentRows[useAuthoredFilters ? 4 : 3];
    const categoryRow = useAuthoredFilters ? undefined : contentRows[4];
    const showLabelsRow = contentRows[useAuthoredFilters ? 3 : 5];
    const revealRow = contentRows[useAuthoredFilters ? 5 : 6];
    return {
      backgroundTheme: 'white',
      eyebrow: rowValue(eyebrow, 'eyebrow'),
      titleHtml: rowHtml(title, 'title'),
      cfRootPath: rowHref(cfRootPath, 'cfRootPath'),
      revealMoreLabel: rowValue(revealRow, 'revealMoreLabel') || 'Reveal More',
      defaultMode: '',
      modeSettings: parseModeSettings(modeRow),
      categorySettings: parseCategorySettings(categoryRow),
      showModeLabels: rowBoolean(showLabelsRow, 'showModeLabels', true),
      useAuthoredFilters,
    };
  }
  const hasLegacyDefault =
    legacy || (rootIndex >= 0 ? allRows.length - rootIndex === 4 : [7, 9].includes(allRows.length));
  const rowCount = legacy ? 10 : hasLegacyDefault ? 7 : 6;
  const contentRows = applyBlockIdentity(block, allRows, { contentRows: rowCount });
  const legacyTitleContinuation = contentRows.length > rowCount ? contentRows.splice(3, 1)[0] : undefined;
  const [backgroundTheme, eyebrow, title, cfRootPath] = contentRows;
  const modeRowIndex = hasLegacyDefault ? 5 : 4;
  const modeSettings = legacy
    ? [
        {
          key: 'experience',
          label: rowValue(contentRows[5], 'experienceModeLabel') || 'Experience',
          rootTag: rowValue(contentRows[6], 'experienceRootTag'),
          filters: [],
        },
        {
          key: 'destination',
          label: rowValue(contentRows[7], 'destinationModeLabel') || 'Destination',
          rootTag: rowValue(contentRows[8], 'destinationRootTag'),
          filters: [],
        },
      ]
    : parseModeSettings(contentRows[modeRowIndex]);

  return {
    backgroundTheme: rowValue(backgroundTheme, 'backgroundTheme') || 'white',
    eyebrow: rowValue(eyebrow, 'eyebrow'),
    titleHtml: [
      rowHtml(title, 'title'),
      legacyTitleContinuation ? `<p>${escapeHtml(textOf(legacyTitleContinuation))}</p>` : '',
    ].join(''),
    cfRootPath: rowHref(cfRootPath, 'cfRootPath'),
    defaultMode: hasLegacyDefault ? rowValue(contentRows[4], 'defaultFilterMode') : '',
    revealMoreLabel: rowValue(contentRows[legacy ? 9 : modeRowIndex + 1], 'revealMoreLabel') || 'Reveal More',
    modeSettings,
    categorySettings: [],
    showModeLabels: true,
    useAuthoredFilters: false,
  };
}

async function fetchCards(path: string): Promise<FilterGridCard[]> {
  const url = `${getPublishBaseUrl()}${PERSISTED_QUERY};path=${path}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GraphQL request failed with status ${response.status}`);
  const payload = await response.json();
  return payload.data?.filterGridCardDetailsList?.items || [];
}

function setNewTab(link: HTMLAnchorElement, enabled?: boolean | null): void {
  if (!enabled) return;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
}

function appendText(
  parent: HTMLElement,
  tagName: 'p' | 'h2' | 'h3',
  className: string,
  value?: string | null,
): HTMLElement | null {
  if (!value) return null;
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function sanitizeRichText(html: string): DocumentFragment {
  const source = new DOMParser().parseFromString(html, 'text/html');
  const fragment = document.createDocumentFragment();

  const copyNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
    if (!(node instanceof HTMLElement)) return null;

    const tagName = node.tagName.toLowerCase();
    const target: Node = ALLOWED_RICH_TEXT_TAGS.has(tagName)
      ? document.createElement(tagName)
      : document.createDocumentFragment();

    if (target instanceof HTMLAnchorElement) {
      const href = node.getAttribute('href') || '';
      if (/^(https?:|mailto:|tel:|\/)/i.test(href)) target.href = href;
    }
    [...node.childNodes].forEach((child) => {
      const copy = copyNode(child);
      if (copy) target.appendChild(copy);
    });
    return target;
  };

  [...source.body.childNodes].forEach((node) => {
    const copy = copyNode(node);
    if (copy) fragment.append(copy);
  });
  return fragment;
}

function appendRichTitle(parent: HTMLElement, html: string): void {
  if (!html) return;
  const title = document.createElement('div');
  title.className = 'filters-grid-title';
  title.setAttribute('role', 'heading');
  title.setAttribute('aria-level', '2');
  title.append(sanitizeRichText(html));
  parent.append(title);
}

function createImage(reference: Reference | null | undefined, alt: string): HTMLImageElement | null {
  const src = referenceUrl(reference);
  if (!src) return null;
  const image = document.createElement('img');
  image.src = src;
  image.alt = alt;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

function createModalImage(
  reference: Reference | null | undefined,
  alt: string,
  eager = false,
): HTMLImageElement | null {
  const image = createImage(reference, alt);
  if (!image) return null;
  image.classList.add('filters-grid-modal-image');
  image.loading = eager ? 'eager' : 'lazy';
  image.fetchPriority = eager ? 'high' : 'auto';
  const reveal = () => image.classList.add('is-loaded');
  image.addEventListener('load', reveal, { once: true });
  if (image.complete && image.naturalWidth) reveal();
  return image;
}

function createImageSlider(images: HTMLImageElement[], className: string, placeholder = ''): HTMLElement {
  const slider = document.createElement('div');
  slider.className = className;
  if (placeholder) slider.style.backgroundImage = placeholder;
  const viewport = document.createElement('div');
  viewport.className = `${className}-viewport`;
  let activeIndex = 0;
  const dots: HTMLButtonElement[] = [];

  images.forEach((image, index) => {
    image.hidden = index !== activeIndex;
    if (index === activeIndex) image.loading = 'eager';
    viewport.append(image);
  });
  slider.append(viewport);

  if (images.length > 1) {
    const pagination = document.createElement('div');
    pagination.className = 'filters-grid-modal-pagination';
    pagination.setAttribute('aria-label', 'Choose image');
    images.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show image ${index + 1}`);
      dot.setAttribute('aria-pressed', String(index === activeIndex));
      dot.addEventListener('click', () => {
        const current = images[activeIndex];
        if (current) current.hidden = true;
        dots[activeIndex]?.setAttribute('aria-pressed', 'false');
        activeIndex = index;
        const next = images[activeIndex];
        if (next) {
          next.loading = 'eager';
          next.hidden = false;
        }
        dots[activeIndex]?.setAttribute('aria-pressed', 'true');
      });
      dots.push(dot);
      pagination.append(dot);
    });
    slider.append(pagination);
  }
  return slider;
}

function createModal() {
  const overlay = document.createElement('div');
  overlay.className = 'filters-grid-modal';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const panel = document.createElement('div');
  panel.className = 'filters-grid-modal-panel';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'filters-grid-modal-close';
  closeButton.dataset.testid = 'filters-grid-modal-close';
  closeButton.setAttribute('aria-label', 'Close details');
  panel.append(closeButton);
  overlay.append(panel);

  let lastFocused: HTMLElement | null = null;
  const close = () => {
    overlay.hidden = true;
    panel.querySelectorAll('.filters-grid-modal-content').forEach((content) => content.remove());
    document.body.classList.remove('filters-grid-modal-open');
    lastFocused?.focus({ preventScroll: true });
  };

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  });

  const open = (card: FilterGridCard, selectedFilterLabel: string) => {
    const details = card.modalDetails;
    if (!details) return;
    panel.querySelectorAll('.filters-grid-modal-content').forEach((content) => content.remove());
    const content = document.createElement('div');
    content.className = 'filters-grid-modal-content';
    const variant = normalizeChoice(details.modalImageAspectRatioVariant) === 'wide' ? 'wide' : 'square';
    panel.dataset.variant = variant;
    overlay.setAttribute('aria-label', card.cardHeadline || 'Experience details');
    const thumbnail = referenceUrl(card.cardBackgroundPhoto);
    const placeholder = thumbnail ? `url(${JSON.stringify(thumbnail)})` : '';

    const feature = createModalImage(
      details.modalFeatureImageAsset,
      details.modalFeatureImageAssetAltText || card.cardHeadline || '',
      true,
    );
    const carouselImages = (details.carouselImages || [])
      .map((image, index) => createModalImage(image, details.carouselImagesAltText?.[index] || ''))
      .filter((image): image is HTMLImageElement => Boolean(image));
    const mediaCopy = document.createElement('div');
    mediaCopy.className = 'filters-grid-modal-media-copy';
    appendText(mediaCopy, 'p', 'filters-grid-modal-eyebrow', labelFromTag(card.cardLocationTag?.[0]));
    appendText(mediaCopy, 'h2', 'filters-grid-modal-title', card.cardHeadline);

    if (variant === 'square') {
      const gallery = document.createElement('div');
      gallery.className = 'filters-grid-modal-gallery';
      const featurePanel = document.createElement('div');
      featurePanel.className = 'filters-grid-modal-feature';
      if (placeholder) featurePanel.style.backgroundImage = placeholder;
      if (feature) featurePanel.append(feature);
      featurePanel.append(mediaCopy);
      gallery.append(featurePanel);
      if (carouselImages.length) {
        gallery.append(createImageSlider(carouselImages, 'filters-grid-modal-carousel', placeholder));
      }
      content.append(gallery);
    } else {
      const media = document.createElement('div');
      media.className = 'filters-grid-modal-media';
      if (placeholder) media.style.backgroundImage = placeholder;
      const bannerImages = [feature, ...carouselImages].filter((image): image is HTMLImageElement => Boolean(image));
      if (bannerImages.length) {
        media.append(createImageSlider(bannerImages, 'filters-grid-modal-banner-slider'));
      }
      media.append(mediaCopy);
      content.append(media);
    }

    const body = document.createElement('div');
    body.className = 'filters-grid-modal-body';
    appendText(body, 'p', 'filters-grid-modal-category', selectedFilterLabel);
    if (details.modalDescription?.html) {
      const description = document.createElement('div');
      description.className = 'filters-grid-modal-description';
      description.append(sanitizeRichText(details.modalDescription.html));
      body.append(description);
    }
    const href = resolveModalHref(details);
    if (details.modalCtaLabel && href) {
      const cta = document.createElement('a');
      cta.className = 'filters-grid-modal-cta';
      cta.dataset.testid = 'filters-grid-modal-cta';
      cta.href = href;
      cta.textContent = details.modalCtaLabel;
      setNewTab(cta, details.openInNewTab);
      body.append(cta);
    }
    content.append(body);
    panel.append(content);

    if (overlay.hidden) lastFocused = document.activeElement as HTMLElement | null;
    overlay.hidden = false;
    document.body.classList.add('filters-grid-modal-open');
    closeButton.focus({ preventScroll: true });
  };

  document.body.append(overlay);
  return { open };
}

function createCard(
  card: FilterGridCard,
  openModal: (card: FilterGridCard, selectedFilterLabel: string) => void,
  selectedFilterLabel: string,
): HTMLElement {
  const isPopup = normalizeChoice(card.cardClickActionBehavior) === 'popup' && card.modalDetails;
  const href = resolveCardHref(card);
  const action = isPopup ? document.createElement('button') : document.createElement('a');
  action.className = 'filters-grid-card-action';
  action.dataset.testid = isPopup ? 'filters-grid-open-modal' : 'filters-grid-card-link';
  if (action instanceof HTMLButtonElement) {
    action.type = 'button';
    action.setAttribute('aria-haspopup', 'dialog');
    let warmed = false;
    const warmImages = () => {
      if (warmed || !card.modalDetails) return;
      warmed = true;
      const details = card.modalDetails;
      const references = [details.modalFeatureImageAsset];
      if (normalizeChoice(details.modalImageAspectRatioVariant) !== 'wide' || !references[0]) {
        references.push(details.carouselImages?.[0]);
      }
      references.forEach((reference) => {
        const src = referenceUrl(reference);
        if (!src) return;
        const image = new Image();
        image.decoding = 'async';
        image.fetchPriority = 'low';
        image.src = src;
      });
    };
    action.addEventListener('pointerenter', warmImages, { once: true });
    action.addEventListener('focus', warmImages, { once: true });
    action.addEventListener('click', () => openModal(card, selectedFilterLabel));
  } else {
    action.href = href || '#';
    if (!href) action.setAttribute('aria-disabled', 'true');
    setNewTab(action, card.openInNewTab);
  }

  const article = document.createElement('article');
  article.className = 'filters-grid-card';
  const image = createImage(card.cardBackgroundPhoto, card.cardBackgroundPhotoAltText || '');
  if (image) article.append(image);
  const shade = document.createElement('span');
  shade.className = 'filters-grid-card-shade';
  article.append(shade);
  const copy = document.createElement('span');
  copy.className = 'filters-grid-card-copy';
  appendText(copy, 'p', 'filters-grid-card-location', labelFromTag(card.cardLocationTag?.[0]));
  appendText(copy, 'h3', 'filters-grid-card-title', card.cardHeadline);
  article.append(copy);
  const icon = document.createElement('span');
  icon.className = 'filters-grid-card-icon';
  icon.setAttribute('aria-hidden', 'true');
  action.setAttribute('aria-label', card.cardHeadline || (isPopup ? 'Open details' : 'Visit page'));
  action.append(article, icon);

  const item = document.createElement('li');
  item.className = 'filters-grid-card-item';
  item.append(action);
  return item;
}

async function fetchModes(settings: ModeSetting[], useAuthoredFilters = false): Promise<AuthoredMode[]> {
  return Promise.all(
    settings.map(async (setting) => {
      const { key, label, rootTag, isDefault, filters: authoredFilters = [] } = setting;
      if (useAuthoredFilters) return { ...setting, filters: authoredFilters };
      if (!rootTag.trim()) return { key, label, rootTag, isDefault, filters: [] };
      const url = new URL('/content/servlet.childtags.json', getPublishBaseUrl());
      url.searchParams.set('tag', rootTag.trim());
      const response = await fetch(url.href, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Child tags request failed with status ${response.status}`);
      const payload: {
        data?: Array<{ path: string; title?: string | null }>;
        status?: string;
        code?: number;
      } = await response.json();
      if (payload.status === 'error' || (payload.code !== undefined && payload.code !== 200)) {
        throw new Error('Unable to load filter tags.');
      }
      const filters = (payload.data || []).map(({ path, title }) => ({
        tag: normalizeTagId(path),
        label: title?.trim() || labelFromTag(path),
      }));
      return { key, label, rootTag, isDefault, filters };
    }),
  );
}

function render(block: HTMLElement, config: BlockConfig, cards: FilterGridCard[], modes: AuthoredMode[]): void {
  const requestedMode = normalizeChoice(config.defaultMode);
  const defaultFilterMode = modes.find(({ filters }) => filters.some(({ isDefault }) => isDefault));
  const authoredDefaultCategory = defaultFilterMode?.filters.find(({ isDefault }) => isDefault)?.tag || '';
  const defaultCategory =
    authoredDefaultCategory || config.categorySettings.find(({ isDefault }) => isDefault)?.tag || '';
  const defaultCategoryMode = modes.find(
    ({ rootTag, filters }) =>
      filters.some(({ tag }) => normalizeTagId(tag) === normalizeTagId(defaultCategory)) &&
      (normalizeTagId(defaultCategory) === normalizeTagId(rootTag) || tagIsWithinRoot(defaultCategory, rootTag)),
  );
  const checkboxDefault = modes.find(({ isDefault }) => isDefault);
  const hasDefaultCheckbox = modes.some(({ isDefault }) => isDefault !== undefined);
  const defaultMode =
    defaultFilterMode ||
    defaultCategoryMode ||
    checkboxDefault ||
    (hasDefaultCheckbox
      ? modes[0]
      : modes.find(
          ({ key, label, rootTag }) =>
            requestedMode &&
            (normalizeChoice(key) === requestedMode ||
              normalizeChoice(label) === requestedMode ||
              normalizeChoice(normalizeTagId(rootTag)) === normalizeChoice(normalizeTagId(config.defaultMode))),
        ));
  let activeMode = defaultMode?.key || modes[0]?.key || '';
  const orderedModes = [
    ...modes.filter(({ key }) => key === activeMode),
    ...modes.filter(({ key }) => key !== activeMode),
  ];
  let activeTag =
    (modes.find(({ key }) => key === activeMode)?.filters || []).find(({ isDefault }) => isDefault)?.tag ||
    modes.find(({ key }) => key === activeMode)?.filters[0]?.tag ||
    '';
  let visibleCount = PAGE_SIZE;

  const shell = document.createElement('div');
  shell.className = 'filters-grid-shell';
  // Not a <header>: header.css declares an unscoped `header { position: absolute }` that would
  // pull this out of the shell's padding box and break alignment with the tabs and filters.
  const heading = document.createElement('div');
  heading.className = 'filters-grid-heading';
  if (config.headingElements) {
    config.headingElements.forEach((element, index) => {
      element.classList.add(index === 0 ? 'filters-grid-eyebrow' : 'filters-grid-title');
      if (index === 1) {
        element.setAttribute('role', 'heading');
        element.setAttribute('aria-level', '2');
      }
      if (textOf(element) || element.hasAttribute('data-aue-prop')) heading.append(element);
    });
  } else {
    appendText(heading, 'p', 'filters-grid-eyebrow', config.eyebrow);
    appendRichTitle(heading, config.titleHtml);
  }
  if (heading.childElementCount) shell.append(heading);

  const layout = document.createElement('div');
  layout.className = 'filters-grid-layout';
  const controls = document.createElement('div');
  controls.className = 'filters-grid-controls';
  const tabs = document.createElement('div');
  tabs.className = 'filters-grid-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Filter mode');
  const modeLabel = document.createElement('p');
  modeLabel.className = 'filters-grid-mode-label';
  modeLabel.textContent = modes[0]?.label || '';
  const filters = document.createElement('div');
  filters.className = config.itemLayout ? 'filters-grid-mode-items' : 'filters-grid-filters';
  const results = document.createElement('div');
  results.className = 'filters-grid-results';
  const list = document.createElement('ul');
  list.className = 'filters-grid-list';
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'filters-grid-reveal';
  reveal.dataset.testid = 'filters-grid-reveal-more';
  reveal.textContent = config.revealMoreLabel;
  if (config.revealElement) moveInstrumentation(config.revealElement, reveal);
  const modal = createModal();
  const itemFilterButtons = new Map<HTMLButtonElement, { modeKey: string; tag: string }>();

  if (config.itemLayout) {
    modes.forEach((mode) => {
      const row = mode.source;
      if (!row) return;
      row.classList.add('filters-grid-mode-item');
      [...row.children].forEach((cell) => cell.classList.add('filters-grid-config'));
      mode.labelElement?.classList.add('filters-grid-item-label');
      const filterList = document.createElement('div');
      filterList.className = 'filters-grid-filters';
      mode.filters.forEach(({ tag, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filters-grid-filter';
        button.dataset.testid = 'filters-grid-filter';
        button.textContent = label;
        button.addEventListener('click', () => {
          activateMode(mode.key);
          activeTag = tag;
          updateItemSelection();
          updateTheme();
          updateCards();
        });
        itemFilterButtons.set(button, { modeKey: mode.key, tag });
        filterList.append(button);
      });
      if (!mode.filters.length) {
        const placeholder = document.createElement('p');
        placeholder.className = 'filters-grid-item-placeholder';
        placeholder.textContent = `${mode.label}: add categories to configure filters.`;
        filterList.append(placeholder);
      }
      row.append(filterList);
      filters.append(row);
    });
  }

  function updateItemSelection() {
    modes.forEach(({ key, source }) => source?.classList.toggle('is-inactive', key !== activeMode));
    itemFilterButtons.forEach(({ modeKey, tag }, button) => {
      const selected = modeKey === activeMode && normalizeTagId(tag) === normalizeTagId(activeTag);
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function updateCards() {
    const filtered =
      modes.length === 0
        ? cards
        : activeTag
          ? cards.filter((card) => cardMatchesFilter(card, activeMode, activeTag))
          : [];
    const selectedFilterLabel =
      modes.find(({ key }) => key === activeMode)?.filters.find(({ tag }) => tag === activeTag)?.label || '';
    const items = filtered.slice(0, visibleCount).map((card) => createCard(card, modal.open, selectedFilterLabel));
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'filters-grid-empty';
      empty.textContent = cards.length ? 'No matching results.' : 'No results are available.';
      items.push(empty);
    }
    list.replaceChildren(...items);
    reveal.hidden = filtered.length <= visibleCount;
    results.dataset.resultCount = String(filtered.length);
  }

  const updateFilters = () => {
    const mode = modes.find(({ key }) => key === activeMode);
    if (!config.itemLayout) filters.replaceChildren();
    const modeDefaultCategory = mode?.filters.find(({ isDefault }) => isDefault);
    const configuredDefaultCategory =
      defaultCategory &&
      mode &&
      (mode.filters.some(({ tag }) => normalizeTagId(tag) === normalizeTagId(defaultCategory)) ||
        normalizeTagId(defaultCategory) === normalizeTagId(mode.rootTag) ||
        tagIsWithinRoot(defaultCategory, mode.rootTag))
        ? mode.filters.find(({ tag }) => normalizeTagId(tag) === normalizeTagId(defaultCategory))
        : undefined;
    activeTag = modeDefaultCategory?.tag || configuredDefaultCategory?.tag || mode?.filters[0]?.tag || '';
    if (config.itemLayout) {
      updateItemSelection();
      updateTheme();
      return;
    }
    const filterButtons: HTMLButtonElement[] = [];
    (mode?.filters || []).forEach(({ label, tag }) => {
      const button = document.createElement('button');
      button.type = 'button';
      const selected = normalizeTagId(tag) === normalizeTagId(activeTag);
      button.className = `filters-grid-filter${selected ? ' is-active' : ''}`;
      button.dataset.testid = 'filters-grid-filter';
      button.textContent = label || labelFromTag(tag);
      button.setAttribute('aria-pressed', String(selected));
      button.addEventListener('click', () => {
        activeTag = tag;
        visibleCount = PAGE_SIZE;
        filterButtons.forEach((item) => {
          const selected = item === button;
          item.classList.toggle('is-active', selected);
          item.setAttribute('aria-pressed', String(selected));
        });
        updateTheme();
        updateCards();
      });
      filterButtons.push(button);
      filters.append(button);
    });
    updateTheme();
  };

  function updateTheme() {
    const activeModeFilter = modes
      .find(({ key }) => key === activeMode)
      ?.filters.find(({ tag }) => normalizeTagId(tag) === normalizeTagId(activeTag));
    const categorySetting = config.categorySettings.find(
      ({ tag }) => normalizeTagId(tag) === normalizeTagId(activeTag),
    );
    const theme =
      activeModeFilter?.backgroundColor ||
      categorySetting?.backgroundColor ||
      (config.categorySettings.length || config.useAuthoredFilters ? 'white' : config.backgroundTheme);
    const themeNames = [
      'white',
      'terracotta',
      'brown',
      'sage-green',
      'soft-blush',
      'dark-navy-blue',
      'light-neutral',
      'sand',
      'dark-brown',
      'light-brown',
      'green',
      'pink',
      'blue',
    ];
    block.classList.remove(...themeNames.map((name) => `filters-grid-theme-${name}`));
    block.classList.add(`filters-grid-theme-${normalizeColor(theme) || 'white'}`);
  }

  function activateMode(key: string, focus = false) {
    const mode = modes.find(({ key: modeKey }) => modeKey === key);
    if (!mode) return;

    activeMode = mode.key;
    visibleCount = PAGE_SIZE;
    [...tabs.querySelectorAll<HTMLButtonElement>('[data-mode-key]')].forEach((tab) => {
      const selected = tab.dataset.modeKey === mode.key;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (focus && selected) tab.focus();
    });
    updateFilters();
    updateCards();
  }

  if (config.itemLayout) {
    block.addEventListener('aue:ui-select', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const mode = modes.find(({ source }) => source?.contains(target));
      if (mode) activateMode(mode.key);
    });
  }

  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...tabs.querySelectorAll<HTMLButtonElement>('[data-mode-key]')];
    const currentIndex = buttons.findIndex((button) => button.getAttribute('aria-selected') === 'true');
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    const nextButton = buttons[nextIndex];
    if (nextButton?.dataset.modeKey) activateMode(nextButton.dataset.modeKey, true);
  });

  if (config.showModeLabels && modes.length > 1) {
    orderedModes.forEach((mode) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filters-grid-tab';
      button.dataset.testid = 'filters-grid-mode';
      button.dataset.modeKey = mode.key;
      button.textContent = mode.label;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(mode.key === activeMode));
      button.tabIndex = mode.key === activeMode ? 0 : -1;
      button.addEventListener('click', () => activateMode(mode.key));
      tabs.append(button);
    });
  }

  reveal.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    updateCards();
  });
  updateFilters();
  updateCards();
  results.append(list, reveal);
  if (modes.length) {
    if (config.showModeLabels) {
      if (modes.length === 1) {
        controls.append(modeLabel);
      } else controls.append(tabs);
    }
    controls.append(filters);
    layout.classList.add('has-filter-modes');
    if (config.showModeLabels) layout.classList.add('has-mode-heading');
    if (controls.childElementCount) layout.append(controls);
  }
  layout.append(results);
  shell.append(layout);

  updateTheme();
  block.dataset.testid ||= 'filters-grid';
  if (config.itemLayout) block.append(shell);
  else block.replaceChildren(shell);
}

export default async function decorate(block: HTMLElement): Promise<void> {
  block.setAttribute('aria-busy', 'true');
  try {
    const config = parseConfig(block);
    const [cards, modes] = await Promise.all([
      fetchCards(config.cfRootPath),
      fetchModes(config.modeSettings, config.useAuthoredFilters),
    ]);
    render(block, config, cards, modes);
  } catch (error) {
    console.error('[filters-grid] Failed to load card content', error);
    const message = document.createElement('p');
    message.className = 'filters-grid-error';
    message.setAttribute('role', 'alert');
    message.textContent = error instanceof Error ? error.message : 'Unable to load experiences and filter tags.';
    block.replaceChildren(message);
  } finally {
    block.removeAttribute('aria-busy');
  }
}
