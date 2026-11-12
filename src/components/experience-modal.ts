import { loadCSS } from '@/app/aem.js';
import { resolveDAMUrl } from '@/utils/env.js';
import { setTagTitle } from '@/utils/tag-title.js';
import { normalizeChoice, resolveModalHref } from '@/utils/experience-url.js';
import type { ExperienceCard, ExperienceReference } from '@/types/experience.js';

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote']);
const STYLESHEET = '/styles/experience-modal.css';
let stylesheetPromise: Promise<void> | undefined;

interface ExperienceModalOptions {
  testIdPrefix: string;
  rootTestId?: string;
  imageTestId?: string;
  showModalEyebrow?: boolean;
  showModalCategoryTag?: boolean;
  categoryFromLocation?: boolean;
}

function ensureStylesheet(): Promise<void> {
  const href = `${window.hlx?.codeBasePath || ''}${STYLESHEET}`;
  stylesheetPromise ||= loadCSS(href).catch((error: unknown) => {
    stylesheetPromise = undefined;
    throw error;
  });
  return stylesheetPromise;
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  name: string,
  value?: string | null,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = `filters-grid-modal-${name}`;
  if (value) element.textContent = value;
  return element;
}

function referenceUrl(reference?: ExperienceReference | null): string {
  const value = reference?._publishUrl || reference?._path || '';
  return value ? resolveDAMUrl(value) : '';
}

function image(reference: ExperienceReference | null | undefined, alt: string, eager = false): HTMLImageElement | null {
  const src = referenceUrl(reference);
  if (!src) return null;
  const element = node('img', 'image');
  element.src = src;
  element.alt = alt;
  element.loading = eager ? 'eager' : 'lazy';
  element.decoding = 'async';
  element.fetchPriority = eager ? 'high' : 'auto';
  const reveal = () => element.classList.add('is-loaded');
  element.addEventListener('load', reveal, { once: true });
  if (element.complete && element.naturalWidth) reveal();
  return element;
}

function richText(html: string): DocumentFragment {
  const source = new DOMParser().parseFromString(html, 'text/html');
  const fragment = document.createDocumentFragment();
  const copy = (original: Node): Node | null => {
    if (original.nodeType === Node.TEXT_NODE) return document.createTextNode(original.textContent || '');
    if (!(original instanceof HTMLElement)) return null;
    const tag = original.tagName.toLowerCase();
    const target: Node = ALLOWED_TAGS.has(tag) ? document.createElement(tag) : document.createDocumentFragment();
    if (target instanceof HTMLAnchorElement) {
      const href = original.getAttribute('href') || '';
      if (/^(https?:|mailto:|tel:|\/)/i.test(href)) target.href = href;
    }
    original.childNodes.forEach((child) => {
      const cloned = copy(child);
      if (cloned) target.appendChild(cloned);
    });
    return target;
  };
  source.body.childNodes.forEach((child) => {
    const cloned = copy(child);
    if (cloned) fragment.append(cloned);
  });
  return fragment;
}

function slider(images: HTMLImageElement[], name: string, placeholder: string, imageTestId?: string): HTMLElement {
  const root = node('div', name);
  if (placeholder) root.style.backgroundImage = placeholder;
  const viewport = node('div', `${name}-viewport`);
  let active = 0;
  const dots: HTMLButtonElement[] = [];
  images.forEach((item, index) => {
    item.hidden = index !== 0;
    if (!index) item.loading = 'eager';
    viewport.append(item);
  });
  root.append(viewport);
  if (images.length > 1) {
    const pagination = node('div', 'pagination');
    pagination.setAttribute('aria-label', 'Choose image');
    images.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      if (imageTestId) dot.dataset.testid = imageTestId;
      dot.setAttribute('aria-label', `Show image ${index + 1}`);
      dot.setAttribute('aria-pressed', String(index === active));
      dot.addEventListener('click', () => {
        images[active]!.hidden = true;
        dots[active]!.setAttribute('aria-pressed', 'false');
        active = index;
        images[active]!.loading = 'eager';
        images[active]!.hidden = false;
        dots[active]!.setAttribute('aria-pressed', 'true');
      });
      dots.push(dot);
      pagination.append(dot);
    });
    root.append(pagination);
  }
  return root;
}

export function createExperienceModal(options: ExperienceModalOptions) {
  const overlay = document.createElement('div');
  overlay.className = 'filters-grid-modal';
  if (options.rootTestId) overlay.dataset.testid = options.rootTestId;
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const panel = node('div', 'panel');
  const closeButton = node('button', 'close');
  closeButton.type = 'button';
  closeButton.dataset.testid = `${options.testIdPrefix}-modal-close`;
  closeButton.setAttribute('aria-label', 'Close details');
  panel.append(closeButton);
  overlay.append(panel);
  let lastFocused: HTMLElement | null = null;
  const close = () => {
    overlay.hidden = true;
    panel.querySelector('.filters-grid-modal-content')?.remove();
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
  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')].filter(
      (item) => !item.closest('[hidden]'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  const open = async (
    card: ExperienceCard,
    category: string,
    eyebrow = '',
    showCategory = options.showModalCategoryTag ?? Boolean(category.trim()),
  ) => {
    const details = card.modalDetails;
    if (!details) return;
    await ensureStylesheet();
    panel.querySelector('.filters-grid-modal-content')?.remove();
    const content = node('div', 'content');
    const variant = normalizeChoice(details.modalImageAspectRatioVariant) === 'wide' ? 'wide' : 'square';
    panel.dataset.variant = variant;
    overlay.setAttribute('aria-label', card.cardHeadline || 'Experience details');
    const thumbnail = referenceUrl(card.cardBackgroundPhoto);
    const placeholder = thumbnail ? `url(${JSON.stringify(thumbnail)})` : '';
    const feature = image(
      details.modalFeatureImageAsset,
      details.modalFeatureImageAssetAltText || card.cardHeadline || '',
      true,
    );
    const extras = (details.carouselImages || [])
      .map((item, index) => image(item, details.carouselImagesAltText?.[index] || ''))
      .filter((item): item is HTMLImageElement => Boolean(item));
    const mediaCopy = node('div', 'media-copy');
    if (options.showModalEyebrow && eyebrow) {
      const label = node('p', 'eyebrow', eyebrow);
      setTagTitle(label, card.cardLocationTag?.[0] || '');
      mediaCopy.append(label);
    }
    if (card.cardHeadline) mediaCopy.append(node('h2', 'title', card.cardHeadline));
    const media = node('div', variant === 'square' ? 'feature' : 'media');
    if (details.modalFeatureImageDarkImageOverlay === false) media.classList.add('filters-grid-modal-no-overlay');
    if (placeholder) media.style.backgroundImage = placeholder;
    if (variant === 'square') {
      if (feature) media.append(feature);
      media.append(mediaCopy);
      const gallery = node('div', 'gallery');
      gallery.append(media);
      if (extras.length) gallery.append(slider(extras, 'carousel', placeholder, options.imageTestId));
      content.append(gallery);
    } else {
      const bannerImages = [feature, ...extras].filter((item): item is HTMLImageElement => Boolean(item));
      if (bannerImages.length) media.append(slider(bannerImages, 'banner-slider', '', options.imageTestId));
      media.append(mediaCopy);
      content.append(media);
    }
    const body = node('div', 'body');
    body.classList.toggle('filters-grid-modal-body-no-category', !showCategory);
    if (showCategory && category) {
      const label = node('p', 'category', category);
      if (options.categoryFromLocation) setTagTitle(label, card.cardLocationTag?.[0] || '');
      body.append(label);
    }
    if (details.modalDescription?.html) {
      const description = node('div', 'description');
      description.append(richText(details.modalDescription.html));
      body.append(description);
    }
    const label = details.modalCtaLabel?.trim();
    const href = label ? resolveModalHref(details) : '';
    panel.classList.toggle('filters-grid-modal-no-cta', !label || !href);
    if (label && href) {
      const cta = node('a', 'cta', label);
      cta.dataset.testid = `${options.testIdPrefix}-modal-cta`;
      cta.href = href;
      if (details.openInNewTab) {
        cta.target = '_blank';
        cta.rel = 'noopener noreferrer';
      }
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
