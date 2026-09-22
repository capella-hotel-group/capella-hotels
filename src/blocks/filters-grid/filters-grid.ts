import { getPublishBaseUrl } from '@/utils/env.js';

interface FilterConfig {
  theme: string;
  cfRootPath: string;
  revealMoreLabel: string;
}

interface FilterTab {
  key: string;
  label: string;
  path: string;
  selected: boolean;
}

interface CardData {
  id: string;
  location: string;
  category: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  url: string;
  ctaLabel: string;
  openInNewTab: boolean;
  cardClickActionBehavior: 'page' | 'popup' | 'none';
  modalImageAspectRatioVariant: 'square' | 'wide';
  modalTitle: string;
  modalDescription: string;
  modalImage: string;
  modalImageAlt: string;
  slides: ModalSlide[];
  tags: string[];
}

interface ModalSlide {
  image: string;
  alt: string;
}

const DEFAULT_TAB: FilterTab = {
  key: 'all',
  label: 'All',
  path: 'all',
  selected: true,
};

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim();
}

function normalizePath(value: string | null | undefined): string {
  return normalizeText(value)
    .replace(/\.(?:html|json)$/i, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

function normalizeTag(value: string | null | undefined): string {
  return normalizePath(value)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  if (typeof value === 'string')
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  return [value];
}

function getPropElement(scope: Element, propName: string): Element | null {
  if (scope.getAttribute('data-aue-prop') === propName) return scope;
  return scope.querySelector(`[data-aue-prop="${propName}"]`);
}

function readText(scope: Element, propName: string): string {
  return normalizeText(getPropElement(scope, propName)?.textContent);
}

function readLink(scope: Element, propName: string): string {
  const source = getPropElement(scope, propName);
  const link = source?.querySelector('a');
  return normalizeText(link?.getAttribute('href') || source?.textContent);
}

function getRootConfig(block: HTMLElement): FilterConfig {
  return {
    theme: readText(block, 'theme') || block.dataset.theme || 'light-neutral',
    cfRootPath: normalizePath(readLink(block, 'cfRootPath') || readText(block, 'cfRootPath')),
    revealMoreLabel: readText(block, 'revealMoreLabel') || 'Reveal More',
  };
}

function getTabLabel(path: string, index: number): string {
  const tagName = normalizeText(path.split('/').filter(Boolean).pop());
  if (!tagName) return index === 0 ? DEFAULT_TAB.label : `Filter ${index + 1}`;
  return tagName
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getTabs(block: HTMLElement): FilterTab[] {
  const tabRows = [...block.children].filter((child) => getPropElement(child, 'parentTagPath'));

  const tabs = tabRows
    .map((row, index) => {
      const path = normalizePath(readLink(row, 'parentTagPath') || readText(row, 'parentTagPath'));
      const defaultTab = readText(row, 'defaultTab');
      return {
        key: normalizeTag(path) || `tab-${index + 1}`,
        label: defaultTab || getTabLabel(path, index),
        path,
        selected: defaultTab.toLowerCase() === 'true' || defaultTab.toLowerCase() === 'yes',
      };
    })
    .filter((tab) => tab.path);

  if (!tabs.length) return [DEFAULT_TAB];
  const firstTab = tabs[0];
  if (!tabs.some((tab) => tab.selected) && firstTab) firstTab.selected = true;
  return tabs;
}

function tagMatches(value: string, selectedPath: string): boolean {
  const tag = normalizeTag(value);
  const selected = normalizeTag(selectedPath);
  if (!selected || selected === 'all') return true;
  return tag === selected || tag.endsWith(`/${selected}`) || selected.endsWith(`/${tag}`);
}

function resolveAssetUrl(path: string): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${getPublishBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

function resolveInternalUrl(value: unknown): string {
  if (typeof value === 'string') {
    const path = normalizeText(value);
    if (!path) return '';
    return path.startsWith('http') ? path : `${getPublishBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    const path = candidate._publishUrl || candidate.url || candidate._path || candidate.path;
    if (typeof path === 'string') return resolveInternalUrl(path);
  }

  return '';
}

function resolveRichText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'html' in value) return String((value as { html?: string }).html || '');
  return '';
}

function getImagePath(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    const path = item._path || item.path || item.url || item._publishUrl;
    return typeof path === 'string' ? path : '';
  }
  return '';
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getFirstString(value: unknown): string {
  const first = toArray(value)[0];
  return first == null ? '' : normalizeText(String(first));
}

function getClickBehavior(value: unknown): CardData['cardClickActionBehavior'] {
  const behavior = normalizeText(String(value ?? 'page')).toLowerCase();
  if (behavior === 'popup' || behavior === 'modal') return 'popup';
  if (behavior === 'none') return 'none';
  return 'page';
}

function getModalSlides(raw: Record<string, unknown>, modalDetails: Record<string, unknown>): ModalSlide[] {
  const featureImage = resolveAssetUrl(
    getImagePath(modalDetails.featureImage ?? raw.modalFeatureImage ?? raw.modalImage),
  );
  const featureAlt = normalizeText(
    String(
      modalDetails.featureImageAltText ?? raw.modalFeatureImageAltText ?? raw.modalImageAlt ?? raw.cardHeadline ?? '',
    ),
  );

  const slides: ModalSlide[] = featureImage ? [{ image: featureImage, alt: featureAlt }] : [];

  toArray(modalDetails.carouselSlides ?? raw.carouselSlides)
    .slice(0, 6)
    .forEach((slide) => {
      if (!slide || typeof slide !== 'object') return;
      const slideData = slide as Record<string, unknown>;
      const image = resolveAssetUrl(getImagePath(slideData.image));
      if (!image) return;
      slides.push({
        image,
        alt: normalizeText(String(slideData.altText ?? slideData.alt ?? modalDetails.title ?? raw.cardHeadline ?? '')),
      });
    });

  return slides.slice(0, 7);
}

function toCardData(raw: Record<string, unknown>): CardData | null {
  const modalDetails = getObject(raw.modalDetails);
  const tags = toArray(raw.associatedFilterTags ?? raw.tags ?? raw.filterTags)
    .map((tag) => String(tag).trim())
    .filter(Boolean);

  const title = normalizeText(String(raw.cardHeadline ?? raw.title ?? raw.cardTitle ?? raw.headline ?? ''));
  const description = resolveRichText(raw.description ?? raw.cardDescription ?? raw.shortDescription);
  const imagePath = getImagePath(raw.cardBackgroundPhoto ?? raw.image ?? raw.cardImage ?? raw.primaryImage);
  const internalUrl = resolveInternalUrl(raw.destinationURL ?? raw.directDestinationURL ?? raw.cardUrl ?? raw.url);
  const externalUrl = normalizeText(
    String(raw.destinationExternalURL ?? raw.directDestinationExternalURL ?? raw.externalURL ?? raw.linkUrl ?? ''),
  );
  const destinationType = normalizeText(String(raw.urlType ?? raw.directDestinationUrlType ?? '')).toLowerCase();
  const clickBehavior = getClickBehavior(raw.cardClickActionBehavior ?? raw.clickAction);
  const slides = getModalSlides(raw, modalDetails);

  if (!title && !description && !imagePath && !tags.length) return null;

  return {
    id: normalizeText(String(raw._path ?? raw.id ?? title ?? crypto.randomUUID())),
    location: normalizeText(String(raw.cardLocationTag ?? raw.location ?? '')),
    category: getFirstString(raw.categoryTag),
    title,
    description,
    image: resolveAssetUrl(imagePath),
    imageAlt: normalizeText(
      String(raw.cardBackgroundPhotoAltText ?? raw.imageAlt ?? raw.imagealt ?? raw.title ?? title),
    ),
    url: destinationType === 'external' ? externalUrl || internalUrl : internalUrl || externalUrl,
    ctaLabel: normalizeText(String(modalDetails.ctaLabel ?? raw.ctaLabel ?? 'Contact Culturist')),
    openInNewTab: raw.openInNewTab === true || raw.openInNewTab === 'true',
    cardClickActionBehavior: clickBehavior,
    modalImageAspectRatioVariant:
      normalizeText(
        String(modalDetails.modalImageAspectRatioVariant ?? raw.modalImageAspectRatioVariant ?? ''),
      ).toLowerCase() === 'square'
        ? 'square'
        : 'wide',
    modalTitle: normalizeText(String(modalDetails.title ?? raw.modalTitle ?? raw.cardHeadline ?? raw.title ?? title)),
    modalDescription: resolveRichText(
      modalDetails.description ?? raw.modalDescription ?? raw.description ?? description,
    ),
    modalImage:
      slides[0]?.image ||
      resolveAssetUrl(getImagePath(modalDetails.featureImage ?? raw.modalFeatureImage ?? raw.modalImage)),
    modalImageAlt: normalizeText(
      String(
        modalDetails.featureImageAltText ??
          raw.modalFeatureImageAltText ??
          raw.modalImageAlt ??
          raw.cardHeadline ??
          title,
      ),
    ),
    slides,
    category: getFirstString(modalDetails.categoryTag ?? raw.categoryTag),
    location: normalizeText(String(modalDetails.locationEyebrow ?? raw.cardLocationTag ?? raw.location ?? '')),
    tags,
  };
}

function collectItems(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;

  for (const value of Object.values(data)) {
    if (Array.isArray(value))
      return value.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
    if (value && typeof value === 'object') {
      const node = value as Record<string, unknown>;
      if (Array.isArray(node.items))
        return node.items.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
      if (Array.isArray(node.edges)) {
        return node.edges
          .map((entry) =>
            entry && typeof entry === 'object' && 'node' in entry ? (entry as Record<string, unknown>).node : entry,
          )
          .filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
      }
    }
  }

  return [];
}

async function fetchCards(rootPath: string): Promise<CardData[]> {
  if (!rootPath) return [];

  try {
    const url = `${getPublishBaseUrl()}/graphql/execute.json/capella-hotels/cardDetailsList;path=${rootPath}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      console.error(`[filters-grid] failed to load cards from ${url}`, response.status);
      return [];
    }

    return collectItems(await response.json())
      .map(toCardData)
      .filter((item): item is CardData => Boolean(item));
  } catch (error) {
    console.error('[filters-grid] content fragment fetch failed', error);
    return [];
  }
}

function getCardsForTab(cards: CardData[], tab: FilterTab): CardData[] {
  if (tab.path === 'all') return cards;
  return cards.filter((card) => card.tags.some((tag) => tagMatches(tag, tab.path)));
}

function applyLinkTarget(anchor: HTMLAnchorElement, openInNewTab: boolean): void {
  if (!openInNewTab) return;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
}

function buildModal(block: HTMLElement): (card: CardData) => void {
  const modal = document.createElement('div');
  modal.className = 'filters-grid-modal';
  modal.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('div');
  panel.className = 'filters-grid-modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'filters-grid-modal-close';
  close.setAttribute('aria-label', 'Close');
  close.textContent = 'x';

  const content = document.createElement('div');
  content.className = 'filters-grid-modal-content';

  const closeModal = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('filters-grid-modal-open');
  };

  close.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  panel.append(close, content);
  modal.append(panel);
  block.append(modal);

  return (card: CardData) => {
    content.innerHTML = '';
    panel.classList.toggle('filters-grid-modal-panel--square', card.modalImageAspectRatioVariant === 'square');
    panel.classList.toggle('filters-grid-modal-panel--wide', card.modalImageAspectRatioVariant !== 'square');

    const media = document.createElement('div');
    media.className = 'filters-grid-modal-media';

    const slides = card.slides.length
      ? card.slides
      : card.modalImage
        ? [{ image: card.modalImage, alt: card.modalImageAlt || card.modalTitle }]
        : [];

    if (slides.length) {
      const firstSlide = slides[0];
      if (!firstSlide) return;

      const image = document.createElement('img');
      image.className = 'filters-grid-modal-image';
      image.src = firstSlide.image;
      image.alt = firstSlide.alt || card.modalTitle;
      media.append(image);

      if (card.location || card.modalTitle) {
        const overlay = document.createElement('div');
        overlay.className = 'filters-grid-modal-media-copy';

        if (card.location) {
          const location = document.createElement('p');
          location.className = 'filters-grid-modal-location';
          location.textContent = card.location;
          overlay.append(location);
        }

        if (card.modalTitle) {
          const mediaTitle = document.createElement('h3');
          mediaTitle.className = 'filters-grid-modal-media-title';
          mediaTitle.textContent = card.modalTitle;
          overlay.append(mediaTitle);
        }

        media.append(overlay);
      }

      if (slides.length > 1) {
        const dots = document.createElement('div');
        dots.className = 'filters-grid-modal-dots';
        slides.forEach((slide, index) => {
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'filters-grid-modal-dot';
          dot.setAttribute('aria-label', `Show slide ${index + 1}`);
          if (index === 0) dot.classList.add('is-active');
          dot.addEventListener('click', () => {
            image.src = slide.image;
            image.alt = slide.alt || card.modalTitle;
            dots
              .querySelectorAll('.filters-grid-modal-dot')
              .forEach((node) => node.classList.toggle('is-active', node === dot));
          });
          dots.append(dot);
        });
        media.append(dots);
      }

      content.append(media);
    }

    const body = document.createElement('div');
    body.className = 'filters-grid-modal-body';

    if (card.category) {
      const category = document.createElement('p');
      category.className = 'filters-grid-modal-category';
      category.textContent = card.category;
      body.append(category);
    }

    if (card.modalDescription) {
      const description = document.createElement('div');
      description.className = 'filters-grid-modal-description';
      description.innerHTML = card.modalDescription;
      body.append(description);
    }

    if (card.url && card.ctaLabel) {
      const cta = document.createElement('a');
      cta.className = 'filters-grid-modal-cta';
      cta.href = card.url;
      cta.textContent = card.ctaLabel;
      applyLinkTarget(cta, card.openInNewTab);
      body.append(cta);
    }

    content.append(body);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('filters-grid-modal-open');
  };
}

function createCard(card: CardData, openModal: (card: CardData) => void): HTMLElement {
  const cardContent = document.createElement(card.cardClickActionBehavior === 'popup' ? 'button' : 'a');
  cardContent.className = 'filters-grid-card';

  if (cardContent instanceof HTMLAnchorElement) {
    if (card.cardClickActionBehavior === 'page' && card.url) {
      cardContent.href = card.url;
      applyLinkTarget(cardContent, card.openInNewTab);
    } else {
      cardContent.href = '#';
      cardContent.setAttribute('aria-disabled', 'true');
    }
  } else {
    cardContent.type = 'button';
    cardContent.addEventListener('click', () => openModal(card));
  }

  if (card.image) {
    const media = document.createElement('div');
    media.className = 'filters-grid-card-media';
    const image = document.createElement('img');
    image.src = card.image;
    image.alt = card.imageAlt || card.title || '';
    media.append(image);
    cardContent.append(media);
  }

  const body = document.createElement('div');
  body.className = 'filters-grid-card-body';

  if (card.location) {
    const location = document.createElement('p');
    location.className = 'filters-grid-card-location';
    location.textContent = card.location;
    body.append(location);
  }

  if (card.title) {
    const title = document.createElement('h3');
    title.className = 'filters-grid-card-title';
    title.textContent = card.title;
    body.append(title);
  }

  const icon = document.createElement('span');
  icon.className = 'filters-grid-card-icon';
  icon.setAttribute('aria-hidden', 'true');
  cardContent.append(icon);

  cardContent.append(body);
  return cardContent;
}

function renderCards(
  container: HTMLElement,
  cards: CardData[],
  visibleCount: number,
  openModal: (card: CardData) => void,
): void {
  container.replaceChildren(...cards.slice(0, visibleCount).map((card) => createCard(card, openModal)));
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const config = getRootConfig(block);
  const tabs = getTabs(block);
  const activeTab = tabs.find((tab) => tab.selected) || tabs[0] || DEFAULT_TAB;
  const openModal = buildModal(block);

  block.classList.add('filters-grid', `filters-grid--${config.theme}`);
  block.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'filters-grid-panel';

  const controls = document.createElement('div');
  controls.className = 'filters-grid-tabs';

  const list = document.createElement('div');
  list.className = 'filters-grid-list';

  const revealMore = document.createElement('button');
  revealMore.type = 'button';
  revealMore.className = 'filters-grid-reveal-more';
  revealMore.textContent = config.revealMoreLabel;

  const empty = document.createElement('p');
  empty.className = 'filters-grid-empty';
  empty.textContent = 'No matching cards available.';

  panel.append(controls, list, revealMore);
  block.append(panel);

  const cards = await fetchCards(config.cfRootPath);
  const perPage = 6;
  let selectedTab = activeTab;
  let visibleCount = perPage;

  const render = () => {
    const filteredCards = getCardsForTab(cards, selectedTab);
    const remaining = filteredCards.length - visibleCount;

    controls.querySelectorAll<HTMLButtonElement>('.filters-grid-tab').forEach((button) => {
      button.classList.toggle('is-selected', button.dataset.tabKey === selectedTab.key);
    });

    renderCards(list, filteredCards, visibleCount, openModal);
    if (!filteredCards.length) list.replaceChildren(empty);

    revealMore.hidden = filteredCards.length <= perPage;
    revealMore.disabled = remaining <= 0;
    revealMore.textContent = remaining > 0 ? config.revealMoreLabel : 'No more items';
  };

  tabs.forEach((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filters-grid-tab';
    button.dataset.tabKey = tab.key;
    button.textContent = tab.label;
    button.addEventListener('click', () => {
      selectedTab = tab;
      visibleCount = perPage;
      render();
    });
    controls.append(button);
  });

  revealMore.addEventListener('click', () => {
    visibleCount += perPage;
    render();
  });

  render();
}
