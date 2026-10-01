import { applyBlockIdentity } from '@/utils/block-identity.js';
import { getPublishBaseUrl, resolveDAMUrl } from '@/utils/env.js';

const PERSISTED_QUERY = '/graphql/execute.json/capella-hotels/Filter-grid-card';
const PAGE_SIZE = 6;

type FilterMode = 'experience' | 'destination';

const ALLOWED_RICH_TEXT_TAGS = new Set(['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote']);

interface Reference {
  _path?: string | null;
  _publishUrl?: string | null;
}

interface CarouselSlide {
  _path?: string;
  image?: Reference | null;
  altText?: string | null;
}

interface ModalDetails {
  modalTitle?: string | null;
  modalDescription?: { html?: string | null } | null;
  modalLocationEyebrow?: string[] | null;
  categoryTag?: string[] | null;
  modalImageAspectRatioVariant?: string | null;
  modalFeatureImageAsset?: Reference | null;
  modalFeatureImageAssetAltText?: string | null;
  carouselSlides?: CarouselSlide[] | null;
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
}

interface AuthoredMode {
  key: FilterMode;
  label: string;
  filters: AuthoredFilter[];
}

interface ModeSetting {
  key: FilterMode;
  label: string;
  rootTag: string;
}

interface BlockConfig {
  eyebrow: string;
  titleHtml: string;
  backgroundTheme: string;
  cfRootPath: string;
  revealMoreLabel: string;
  defaultMode: FilterMode;
  modeSettings: ModeSetting[];
}

const textOf = (element?: Element | null): string => element?.textContent?.trim() || '';

export function normalizeChoice(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function normalizeMode(value?: string | null): FilterMode {
  return normalizeChoice(value) === 'destination' ? 'destination' : 'experience';
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
  mode: FilterMode,
  tag: string,
): boolean {
  if (!tag) return true;
  const values = mode === 'destination' ? card.cardLocationTag : card.associatedFilterTags;
  return Boolean(values?.some((value) => value.trim() === tag));
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
    return new URL(normalizedValue, baseUrl).pathname;
  } catch {
    return normalizedValue;
  }
}

function rowHref(row: Element | undefined, name: string): string {
  if (!row) return '';
  const field = row.querySelector(`[data-aue-prop="${name}"]`) || row.firstElementChild || row;
  const value = field.querySelector('a')?.getAttribute('href') || textOf(field);
  return resolvePickerPath(value, window.location.origin);
}

function parseConfig(block: HTMLElement): BlockConfig {
  const allRows = [...block.children] as HTMLElement[];
  const contentRows = applyBlockIdentity(block, allRows, { contentRows: 10 });
  const legacyTitleContinuation = contentRows.length > 10 ? contentRows.splice(3, 1)[0] : undefined;
  const [
    backgroundTheme,
    eyebrow,
    title,
    cfRootPath,
    defaultMode,
    experienceModeLabel,
    experienceRootTag,
    destinationModeLabel,
    destinationRootTag,
    revealMore,
  ] = contentRows;

  return {
    backgroundTheme: rowValue(backgroundTheme, 'backgroundTheme') || 'white',
    eyebrow: rowValue(eyebrow, 'eyebrow'),
    titleHtml: [
      rowHtml(title, 'title'),
      legacyTitleContinuation ? `<p>${escapeHtml(textOf(legacyTitleContinuation))}</p>` : '',
    ].join(''),
    cfRootPath: rowHref(cfRootPath, 'cfRootPath'),
    defaultMode: normalizeMode(rowValue(defaultMode, 'defaultFilterMode')),
    revealMoreLabel: rowValue(revealMore, 'revealMoreLabel') || 'Reveal More',
    modeSettings: [
      {
        key: 'experience',
        label: rowValue(experienceModeLabel, 'experienceModeLabel') || 'Experience',
        rootTag: rowValue(experienceRootTag, 'experienceRootTag'),
      },
      {
        key: 'destination',
        label: rowValue(destinationModeLabel, 'destinationModeLabel') || 'Destination',
        rootTag: rowValue(destinationRootTag, 'destinationRootTag'),
      },
    ],
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

function createImageSlider(images: HTMLImageElement[], className: string): HTMLElement {
  const slider = document.createElement('div');
  slider.className = className;
  const viewport = document.createElement('div');
  viewport.className = `${className}-viewport`;
  let activeIndex = 0;
  const dots: HTMLButtonElement[] = [];

  images.forEach((image, index) => {
    image.hidden = index !== activeIndex;
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
        if (next) next.hidden = false;
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
  closeButton.textContent = '×';
  panel.append(closeButton);
  overlay.append(panel);

  let lastFocused: HTMLElement | null = null;
  const close = () => {
    overlay.hidden = true;
    panel.querySelector('.filters-grid-modal-content')?.remove();
    document.body.classList.remove('filters-grid-modal-open');
    lastFocused?.focus();
  };

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  });

  const open = (details: ModalDetails) => {
    const content = document.createElement('div');
    content.className = 'filters-grid-modal-content';
    const variant = normalizeChoice(details.modalImageAspectRatioVariant) === 'wide' ? 'wide' : 'square';
    panel.dataset.variant = variant;
    overlay.setAttribute('aria-label', details.modalTitle || 'Experience details');

    const feature = createImage(
      details.modalFeatureImageAsset,
      details.modalFeatureImageAssetAltText || details.modalTitle || '',
    );
    const carouselImages = (details.carouselSlides || [])
      .map((slide) => createImage(slide.image, slide.altText || ''))
      .filter((image): image is HTMLImageElement => Boolean(image));
    const mediaCopy = document.createElement('div');
    mediaCopy.className = 'filters-grid-modal-media-copy';
    appendText(mediaCopy, 'p', 'filters-grid-modal-eyebrow', labelFromTag(details.modalLocationEyebrow?.[0]));
    appendText(mediaCopy, 'h2', 'filters-grid-modal-title', details.modalTitle);

    if (variant === 'square') {
      const gallery = document.createElement('div');
      gallery.className = 'filters-grid-modal-gallery';
      const featurePanel = document.createElement('div');
      featurePanel.className = 'filters-grid-modal-feature';
      if (feature) featurePanel.append(feature);
      featurePanel.append(mediaCopy);
      gallery.append(featurePanel);
      if (carouselImages.length) {
        gallery.append(createImageSlider(carouselImages, 'filters-grid-modal-carousel'));
      }
      content.append(gallery);
    } else {
      const media = document.createElement('div');
      media.className = 'filters-grid-modal-media';
      const bannerImages = [feature, ...carouselImages].filter((image): image is HTMLImageElement => Boolean(image));
      if (bannerImages.length) {
        media.append(createImageSlider(bannerImages, 'filters-grid-modal-banner-slider'));
      }
      media.append(mediaCopy);
      content.append(media);
    }

    const body = document.createElement('div');
    body.className = 'filters-grid-modal-body';
    appendText(body, 'p', 'filters-grid-modal-category', labelFromTag(details.categoryTag?.[0]));
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

    lastFocused = document.activeElement as HTMLElement | null;
    overlay.hidden = false;
    document.body.classList.add('filters-grid-modal-open');
    closeButton.focus();
  };

  document.body.append(overlay);
  return { open };
}

function createCard(card: FilterGridCard, openModal: (details: ModalDetails) => void): HTMLElement {
  const isPopup = normalizeChoice(card.cardClickActionBehavior) === 'popup' && card.modalDetails;
  const href = resolveCardHref(card);
  const action = isPopup ? document.createElement('button') : document.createElement('a');
  action.className = 'filters-grid-card-action';
  action.dataset.testid = isPopup ? 'filters-grid-open-modal' : 'filters-grid-card-link';
  if (action instanceof HTMLButtonElement) {
    action.type = 'button';
    action.setAttribute('aria-haspopup', 'dialog');
    action.addEventListener('click', () => openModal(card.modalDetails as ModalDetails));
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

function deriveModes(cards: FilterGridCard[], settings: ModeSetting[]): AuthoredMode[] {
  const build = ({ key, label, rootTag }: ModeSetting, values: string[]) => ({
    key,
    label,
    filters: [...new Set(values)]
      .filter((tag) => !rootTag || tagIsWithinRoot(tag, rootTag))
      .sort()
      .map((tag) => ({ label: labelFromTag(tag), tag })),
  });
  return [
    build(
      settings[0] as ModeSetting,
      cards.flatMap((card) => card.associatedFilterTags || []),
    ),
    build(
      settings[1] as ModeSetting,
      cards.flatMap((card) => card.cardLocationTag || []),
    ),
  ];
}

function render(block: HTMLElement, config: BlockConfig, cards: FilterGridCard[]): void {
  const modes = deriveModes(cards, config.modeSettings);
  let activeMode = modes.some(({ key }) => key === config.defaultMode)
    ? config.defaultMode
    : modes[0]?.key || 'experience';
  let activeTag = modes.find(({ key }) => key === activeMode)?.filters[0]?.tag || '';
  let visibleCount = PAGE_SIZE;

  const shell = document.createElement('div');
  shell.className = 'filters-grid-shell';
  const heading = document.createElement('header');
  heading.className = 'filters-grid-heading';
  appendText(heading, 'p', 'filters-grid-eyebrow', config.eyebrow);
  appendRichTitle(heading, config.titleHtml);
  if (heading.childElementCount) shell.append(heading);

  const layout = document.createElement('div');
  layout.className = 'filters-grid-layout';
  const controls = document.createElement('div');
  controls.className = 'filters-grid-controls';
  const tabs = document.createElement('div');
  tabs.className = 'filters-grid-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Filter mode');
  const filters = document.createElement('div');
  filters.className = 'filters-grid-filters';
  const results = document.createElement('div');
  results.className = 'filters-grid-results';
  const list = document.createElement('ul');
  list.className = 'filters-grid-list';
  const reveal = document.createElement('button');
  reveal.type = 'button';
  reveal.className = 'filters-grid-reveal';
  reveal.dataset.testid = 'filters-grid-reveal-more';
  reveal.textContent = config.revealMoreLabel;
  const modal = createModal();

  const updateCards = () => {
    const filtered = cards.filter((card) => cardMatchesFilter(card, activeMode, activeTag));
    const items = filtered.slice(0, visibleCount).map((card) => createCard(card, modal.open));
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'filters-grid-empty';
      empty.textContent = cards.length ? 'No matching experiences.' : 'No experiences are available.';
      items.push(empty);
    }
    list.replaceChildren(...items);
    reveal.hidden = filtered.length <= visibleCount;
    results.dataset.resultCount = String(filtered.length);
  };

  const updateFilters = () => {
    const mode = modes.find(({ key }) => key === activeMode);
    filters.replaceChildren();
    activeTag = mode?.filters[0]?.tag || '';
    const filterButtons: HTMLButtonElement[] = [];
    (mode?.filters || []).forEach(({ label, tag }, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `filters-grid-filter${index === 0 ? ' is-active' : ''}`;
      button.dataset.testid = 'filters-grid-filter';
      button.textContent = label || labelFromTag(tag);
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => {
        activeTag = tag;
        visibleCount = PAGE_SIZE;
        filterButtons.forEach((item) => {
          const selected = item === button;
          item.classList.toggle('is-active', selected);
          item.setAttribute('aria-pressed', String(selected));
        });
        updateCards();
      });
      filterButtons.push(button);
      filters.append(button);
    });
  };

  const activateMode = (key: FilterMode, focus = false) => {
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
  };

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
    if (nextButton?.dataset.modeKey) activateMode(nextButton.dataset.modeKey as FilterMode, true);
  });

  modes.forEach((mode) => {
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

  reveal.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    updateCards();
  });
  controls.append(tabs, filters);
  results.append(list, reveal);
  layout.append(controls, results);
  shell.append(layout);

  block.classList.add(`filters-grid-theme-${normalizeChoice(config.backgroundTheme) || 'white'}`);
  block.dataset.testid ||= 'filters-grid';
  block.replaceChildren(shell);
  updateFilters();
  updateCards();
}

export default async function decorate(block: HTMLElement): Promise<void> {
  block.setAttribute('aria-busy', 'true');
  try {
    const config = parseConfig(block);
    const cards = await fetchCards(config.cfRootPath);
    render(block, config, cards);
  } catch (error) {
    console.error('[filters-grid] Failed to load card content', error);
    const message = document.createElement('p');
    message.className = 'filters-grid-error';
    message.textContent = 'Unable to load experiences.';
    block.replaceChildren(message);
  } finally {
    block.removeAttribute('aria-busy');
  }
}
