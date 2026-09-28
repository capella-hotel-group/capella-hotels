import DOMPurify from 'dompurify';

import { applyBlockIdentity } from '@/utils/block-identity.js';
import { getPublishBaseUrl, resolveDAMUrl } from '@/utils/env.js';

const PERSISTED_QUERY = '/graphql/execute.json/capella-hotels/CardDetailsList';
const PAGE_SIZE = 6;

type FilterMode = 'experience' | 'destination';

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
  title: string;
  titleContinuation: string;
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
  const normalizedRoot = rootTag.trim().replace(/\/+$/, '');
  return Boolean(normalizedRoot && tag.trim().startsWith(`${normalizedRoot}/`));
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

function parseConfig(block: HTMLElement): BlockConfig {
  const allRows = [...block.children] as HTMLElement[];
  const contentRows = applyBlockIdentity(block, allRows, { contentRows: 11 });
  const [
    backgroundTheme,
    eyebrow,
    title,
    titleContinuation,
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
    title: rowValue(title, 'title'),
    titleContinuation: rowValue(titleContinuation, 'titleContinuation'),
    cfRootPath: rowValue(cfRootPath, 'cfRootPath'),
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
  if (!path) return [];
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

function createModal(block: HTMLElement) {
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

    const media = document.createElement('div');
    media.className = 'filters-grid-modal-media';
    const slides = [
      {
        image: details.modalFeatureImageAsset,
        altText: details.modalFeatureImageAssetAltText || details.modalTitle || '',
      },
      ...(details.carouselSlides || []),
    ].filter(({ image }) => referenceUrl(image));
    let activeSlide = 0;
    const images = slides
      .map(({ image, altText }) => createImage(image, altText || ''))
      .filter((image): image is HTMLImageElement => Boolean(image));
    images.forEach((image, index) => {
      image.hidden = index !== activeSlide;
      media.append(image);
    });

    const mediaCopy = document.createElement('div');
    mediaCopy.className = 'filters-grid-modal-media-copy';
    appendText(mediaCopy, 'p', 'filters-grid-modal-eyebrow', labelFromTag(details.modalLocationEyebrow?.[0]));
    appendText(mediaCopy, 'h2', 'filters-grid-modal-title', details.modalTitle);
    media.append(mediaCopy);

    if (images.length > 1) {
      const pagination = document.createElement('div');
      pagination.className = 'filters-grid-modal-pagination';
      pagination.setAttribute('aria-label', 'Choose image');
      const buttons = images.map((_, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('aria-label', `Show image ${index + 1}`);
        button.setAttribute('aria-pressed', String(index === activeSlide));
        button.addEventListener('click', () => {
          const previousImage = images[activeSlide];
          const previousButton = buttons[activeSlide];
          if (previousImage) previousImage.hidden = true;
          previousButton?.setAttribute('aria-pressed', 'false');
          activeSlide = index;
          const nextImage = images[activeSlide];
          const nextButton = buttons[activeSlide];
          if (nextImage) nextImage.hidden = false;
          nextButton?.setAttribute('aria-pressed', 'true');
        });
        pagination.append(button);
        return button;
      });
      media.append(pagination);
    }
    content.append(media);

    const body = document.createElement('div');
    body.className = 'filters-grid-modal-body';
    appendText(body, 'p', 'filters-grid-modal-category', labelFromTag(details.categoryTag?.[0]));
    if (details.modalDescription?.html) {
      const description = document.createElement('div');
      description.className = 'filters-grid-modal-description';
      description.innerHTML = DOMPurify.sanitize(details.modalDescription.html);
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

  block.append(overlay);
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
      .filter((tag) => tagIsWithinRoot(tag, rootTag))
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
  let activeTag = '';
  let visibleCount = PAGE_SIZE;

  const shell = document.createElement('div');
  shell.className = 'filters-grid-shell';
  const heading = document.createElement('header');
  heading.className = 'filters-grid-heading';
  appendText(heading, 'p', 'filters-grid-eyebrow', config.eyebrow);
  appendText(heading, 'h2', 'filters-grid-title', config.title);
  appendText(heading, 'h2', 'filters-grid-title filters-grid-title-continuation', config.titleContinuation);
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
  const modal = createModal(shell);

  const updateCards = () => {
    const filtered = cards.filter((card) => cardMatchesFilter(card, activeMode, activeTag));
    list.replaceChildren(...filtered.slice(0, visibleCount).map((card) => createCard(card, modal.open)));
    reveal.hidden = filtered.length <= visibleCount;
    results.dataset.resultCount = String(filtered.length);
  };

  const updateFilters = () => {
    const mode = modes.find(({ key }) => key === activeMode);
    filters.replaceChildren();
    const allButton = document.createElement('button');
    allButton.type = 'button';
    allButton.className = 'filters-grid-filter is-active';
    allButton.dataset.testid = 'filters-grid-filter';
    allButton.textContent = 'All';
    allButton.setAttribute('aria-pressed', 'true');
    filters.append(allButton);
    const filterButtons = [allButton];
    (mode?.filters || []).forEach(({ label, tag }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filters-grid-filter';
      button.dataset.testid = 'filters-grid-filter';
      button.textContent = label || labelFromTag(tag);
      button.setAttribute('aria-pressed', 'false');
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
    allButton.addEventListener('click', () => {
      activeTag = '';
      visibleCount = PAGE_SIZE;
      filterButtons.forEach((item) => {
        const selected = item === allButton;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      updateCards();
    });
  };

  modes.forEach((mode) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filters-grid-tab';
    button.dataset.testid = 'filters-grid-mode';
    button.textContent = mode.label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(mode.key === activeMode));
    button.addEventListener('click', () => {
      activeMode = mode.key;
      activeTag = '';
      visibleCount = PAGE_SIZE;
      [...tabs.children].forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
      updateFilters();
      updateCards();
    });
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
  const config = parseConfig(block);
  block.setAttribute('aria-busy', 'true');
  try {
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
