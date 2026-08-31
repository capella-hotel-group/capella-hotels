import { moveInstrumentation } from '@/app/scripts.js';
import { loadFragment } from '@/blocks/fragment/fragment.js';

const textOf = (element?: Element | null): string => element?.textContent?.trim() || '';

interface TileFields {
  visualEyebrow: string;
  headline: string;
  visualImage: Element | null;
  visualImageAlt: string;
  detailsImage: Element | null;
  detailsImageAlt: string;
  detailTitle: string;
  description: Element | null;
  enquireLabel: string;
  enquireModalPath: string;
  enquireOpenInNewTab: boolean;
  detailsLabel: string;
  detailsUrl: string;
  detailsOpenInNewTab: boolean;
}

const fragmentCache = new Map<string, Promise<Node[] | null>>();

function fieldOf(row: Element, name: string, fallbackIndex: number): Element | null {
  const cells = [...row.children];
  return row.querySelector(`[data-aue-prop="${name}"]`) || cells[fallbackIndex] || null;
}

function isEnabled(field: Element | null): boolean {
  return ['true', 'yes', 'enabled'].includes(textOf(field).toLowerCase());
}

function getHref(field: Element | null): string {
  return field?.querySelector('a')?.getAttribute('href') || textOf(field);
}

function getMedia(field: Element | null): Element | null {
  const image = field?.querySelector('picture, img');
  if (!image) return null;
  return image.tagName.toLowerCase() === 'picture' ? image : image.closest('picture') || image;
}

function setImageAlt(media: Element | null, alt: string): void {
  const image = media?.querySelector('img') || (media?.tagName === 'IMG' ? (media as HTMLImageElement) : null);
  if (image && alt) image.alt = alt;
}

function moveRichText(source: Element | null, target: HTMLElement): void {
  if (!source) return;
  moveInstrumentation(source, target);
  while (source.firstChild) target.append(source.firstChild);
}

function getFields(row: Element): TileFields {
  const visualImageField = fieldOf(row, 'visualImage', 2);
  const detailsImageField = fieldOf(row, 'detailsImage', 6);

  return {
    visualEyebrow: textOf(fieldOf(row, 'visualEyebrow', 0)),
    headline: textOf(fieldOf(row, 'headline', 1)),
    visualImage: getMedia(visualImageField),
    visualImageAlt: textOf(fieldOf(row, 'visualImageAlt', 3)),
    detailTitle: textOf(fieldOf(row, 'detailTitle', 4)),
    description: fieldOf(row, 'description', 5),
    detailsImage: getMedia(detailsImageField),
    detailsImageAlt: textOf(fieldOf(row, 'detailsImageAlt', 7)),
    enquireLabel: textOf(fieldOf(row, 'enquireLabel', 8)) || 'ENQUIRE',
    enquireModalPath: getHref(fieldOf(row, 'enquireModalPath', 9)),
    enquireOpenInNewTab: isEnabled(fieldOf(row, 'enquireOpenInNewTab', 10)),
    detailsLabel: textOf(fieldOf(row, 'detailsLabel', 11)) || 'DETAILS',
    detailsUrl: getHref(fieldOf(row, 'detailsUrl', 12)),
    detailsOpenInNewTab: isEnabled(fieldOf(row, 'detailsOpenInNewTab', 13)),
  };
}

function extractModalContent(fragment: HTMLElement): Node[] {
  const nestedDialog = fragment.querySelector<HTMLElement>('[role="dialog"]');
  const source = nestedDialog?.firstElementChild || nestedDialog || fragment;
  source.querySelectorAll('[aria-label="Close"]').forEach((node) => node.remove());
  return [...source.childNodes];
}

function loadModalContent(path: string): Promise<Node[] | null> {
  if (!path) return Promise.resolve(null);
  if (!fragmentCache.has(path)) {
    fragmentCache.set(
      path,
      loadFragment(path).then((fragment) => (fragment ? extractModalContent(fragment) : null)),
    );
  }
  return fragmentCache.get(path)!;
}

function buildModal(label: string) {
  const overlay = document.createElement('div');
  overlay.className = 'experience-tiles-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', label);
  overlay.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'experience-tiles-modal-panel';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'experience-tiles-modal-close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = 'x';

  const body = document.createElement('div');
  body.className = 'experience-tiles-modal-body';

  panel.append(closeButton, body);
  overlay.append(panel);

  let lastFocused: HTMLElement | null = null;
  const close = () => {
    overlay.hidden = true;
    document.body.classList.remove('experience-tiles-modal-open');
    lastFocused?.focus();
  };
  const open = () => {
    lastFocused = document.activeElement as HTMLElement | null;
    overlay.hidden = false;
    document.body.classList.add('experience-tiles-modal-open');
    closeButton.focus();
  };

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  });

  document.body.append(overlay);
  return { body, open };
}

function setNewTab(link: HTMLAnchorElement, enabled: boolean): void {
  if (!enabled) return;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
}

function buildAction(
  label: string,
  href: string,
  openInNewTab: boolean,
  modalLabel?: string,
): HTMLAnchorElement | null {
  if (!label || !href) return null;
  const link = document.createElement('a');
  link.className = 'experience-tiles-action';
  link.href = href;
  link.textContent = label;
  setNewTab(link, openInNewTab);

  if (modalLabel && !openInNewTab) {
    let modal: { body: HTMLElement; open: () => void } | null = null;
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      if (!modal) modal = buildModal(modalLabel);
      modal.open();
      if (modal.body.hasChildNodes()) return;
      const nodes = await loadModalContent(href);
      if (nodes?.length) modal.body.append(...nodes);
    });
  }

  return link;
}

function appendText(parent: Element, tagName: 'h2' | 'p', className: string, text: string): void {
  if (!text) return;
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.append(element);
}

function buildTile(row: Element): HTMLLIElement {
  const fields = getFields(row);
  const item = document.createElement('li');
  item.className = 'experience-tiles-item';
  moveInstrumentation(row, item);

  const article = document.createElement('article');
  article.className = 'experience-tiles-card';

  const visual = document.createElement('figure');
  visual.className = 'experience-tiles-visual';
  setImageAlt(fields.visualImage, fields.visualImageAlt);
  if (fields.visualImage) visual.append(fields.visualImage);

  const visualCaption = document.createElement('figcaption');
  visualCaption.className = 'experience-tiles-visual-caption';
  appendText(visualCaption, 'p', 'experience-tiles-eyebrow', fields.visualEyebrow);
  appendText(visualCaption, 'h2', 'experience-tiles-headline', fields.headline);
  visual.append(visualCaption);

  const details = document.createElement('div');
  details.className = 'experience-tiles-details';
  setImageAlt(fields.detailsImage, fields.detailsImageAlt);
  if (fields.detailsImage) {
    const detailsMedia = document.createElement('div');
    detailsMedia.className = 'experience-tiles-details-media';
    detailsMedia.append(fields.detailsImage);
    details.append(detailsMedia);
  }

  const detailsContent = document.createElement('div');
  detailsContent.className = 'experience-tiles-details-content';
  appendText(detailsContent, 'h2', 'experience-tiles-detail-title', fields.detailTitle);
  const description = document.createElement('div');
  description.className = 'experience-tiles-description';
  moveRichText(fields.description, description);
  if (description.hasChildNodes()) detailsContent.append(description);

  const actions = document.createElement('div');
  actions.className = 'experience-tiles-actions';
  const enquire = buildAction(
    fields.enquireLabel,
    fields.enquireModalPath,
    fields.enquireOpenInNewTab,
    `${fields.headline || fields.detailTitle || 'Experience'} enquiry`,
  );
  const detail = buildAction(fields.detailsLabel, fields.detailsUrl, fields.detailsOpenInNewTab);
  if (enquire) actions.append(enquire);
  if (detail) actions.append(detail);
  if (actions.hasChildNodes()) detailsContent.append(actions);

  details.append(detailsContent);
  article.append(visual, details);
  item.append(article);
  return item;
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children];
  const list = document.createElement('ul');
  list.className = 'experience-tiles-list';
  rows.forEach((row) => list.append(buildTile(row)));
  block.replaceChildren(list);
}