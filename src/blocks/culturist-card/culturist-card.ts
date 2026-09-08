import { moveInstrumentation } from '@/app/scripts.js';
import { getPublishBaseUrl } from '@/utils/env.js';

type ReferenceValue = string | { _path?: string } | null | undefined;

type RichTextValue = {
  html?: string;
};

type CardReference = {
  image?: ReferenceValue;
  imagealt?: string;
  title?: string;
};

type CulturistCardData = {
  image?: ReferenceValue;
  imageAltText?: string;
  signatureImage?: ReferenceValue;
  signatureAltText?: string;
  quote?: RichTextValue;
  name?: string;
  description?: RichTextValue;
  cardContentReference?: CardReference[];
  ctaLabel?: string;
  ctaLink?: ReferenceValue;
  ctaExternalLink?: string;
  ctaOpenInNewTab?: boolean;
};

const cfCache = new Map<string, Promise<CulturistCardData | null>>();

const fieldOf = (block: Element, name: string): Element | null => block.querySelector(`[data-aue-prop="${name}"]`);
const textFromField = (field?: Element | null): string => field?.textContent?.trim() || '';

function getReferencePath(value: ReferenceValue): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._path || null;
}

function resolveAssetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${getPublishBaseUrl()}${path}`;
}

function resolveLinkHref(internalRef: ReferenceValue, externalLink?: string | null): string | null {
  const internalPath = getReferencePath(internalRef);
  if (internalPath) return resolveAssetUrl(internalPath);
  return externalLink || null;
}

function applyLinkTarget(anchor: HTMLAnchorElement, openInNewTab?: boolean): void {
  if (!openInNewTab) return;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
}

function containsBlockquote(html: string): boolean {
  const content = document.createElement('div');
  content.innerHTML = html;
  return Boolean(content.querySelector('blockquote'));
}

function removePlainQuoteMarks(html: string): string {
  return html.replace(/^(\s*<p>)(?:&quot;|")([\s\S]*?)(?:&quot;|")(\s*<\/p>\s*)$/i, '$1$2$3');
}

function getAuthoredLinkHref(field?: Element | null): string {
  return field?.querySelector('a')?.getAttribute('href') || textFromField(field);
}

function getAuthoredReferencePath(field?: Element | null): string {
  const text = textFromField(field);
  if (text) return text;

  const href = field?.querySelector('a')?.getAttribute('href') || '';
  if (!href.startsWith('http')) return href;

  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

function getAuthoredPicture(field?: Element | null): HTMLPictureElement | null {
  return field?.querySelector('picture') || null;
}

function setPictureAlt(picture: HTMLPictureElement, alt: string): void {
  const image = picture.querySelector('img');
  if (image) image.alt = alt;
}

async function fetchCFDetails(cfPath: string): Promise<CulturistCardData | null> {
  if (!cfCache.has(cfPath)) {
    cfCache.set(
      cfPath,
      fetch(`${getPublishBaseUrl()}/graphql/execute.json/capella-hotels/TabList;path=${cfPath}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(async (response) => {
          if (!response.ok) {
            console.error(`[culturist-card] GraphQL request failed (${response.status}) for ${cfPath}`);
            return null;
          }
          const data = await response.json();
          return data.data?.tabDetailsByPath?.item || null;
        })
        .catch((error) => {
          console.error(`[culturist-card] Failed to fetch CF details for ${cfPath}`, error);
          return null;
        }),
    );
  }

  return cfCache.get(cfPath)!;
}

function createImage(src: string | null, alt: string, className: string): HTMLImageElement | null {
  if (!src) return null;
  const image = document.createElement('img');
  image.className = className;
  image.src = src;
  image.alt = alt;
  return image;
}

function appendRichText(parent: HTMLElement, html: string | undefined, className: string): HTMLElement | null {
  if (!html) return null;
  const element = document.createElement('div');
  element.className = className;
  element.innerHTML = html;
  parent.append(element);
  return element;
}

function buildQuote(cfData: CulturistCardData): HTMLElement | null {
  const html = cfData.quote?.html;
  if (!html) return null;
  const isQuote = containsBlockquote(html);
  const quote = document.createElement(isQuote ? 'blockquote' : 'div');
  quote.className = 'culturist-card-quote';
  quote.innerHTML = isQuote ? html : removePlainQuoteMarks(html);
  return quote;
}

function buildDetailsLink(cfData: CulturistCardData): HTMLAnchorElement | null {
  const detailsHref = resolveLinkHref(cfData.ctaLink, cfData.ctaExternalLink);
  if (!cfData.ctaLabel || !detailsHref) return null;

  const details = document.createElement('a');
  details.className = 'culturist-card-cta-link culturist-card-cta-link--details';
  details.href = detailsHref;
  details.textContent = cfData.ctaLabel;
  applyLinkTarget(details, cfData.ctaOpenInNewTab ?? false);
  return details;
}

function buildEnquireLink(block: HTMLElement): HTMLAnchorElement | null {
  const labelField = fieldOf(block, 'enquireLabel');
  const linkField = fieldOf(block, 'enquireLink');
  const label = textFromField(labelField);
  const href = getAuthoredLinkHref(linkField);
  if (!label || !href) return null;

  const enquire = document.createElement('a');
  enquire.className = 'culturist-card-cta-link culturist-card-cta-link--enquire';
  enquire.href = href;
  enquire.textContent = label;

  if (textFromField(fieldOf(block, 'enquireOpenInNewTab')).toLowerCase() === 'true') {
    applyLinkTarget(enquire, true);
  }
  if (labelField) moveInstrumentation(labelField, enquire);
  return enquire;
}

function buildGallery(cfData: CulturistCardData): HTMLUListElement | null {
  const cards = (cfData.cardContentReference || []).filter(Boolean).slice(0, 3);
  if (!cards.length) return null;

  const gallery = document.createElement('ul');
  gallery.className = 'culturist-card-gallery';
  cards.forEach((card) => {
    const imagePath = getReferencePath(card.image);
    const image = createImage(resolveAssetUrl(imagePath), card.imagealt || card.title || '', 'culturist-card-gallery-image');
    if (!image) return;

    const item = document.createElement('li');
    item.className = 'culturist-card-gallery-item';
    item.append(image);
    gallery.append(item);
  });

  return gallery.hasChildNodes() ? gallery : null;
}

export default async function decorate(block: HTMLElement): Promise<void> {
  const blockId = textFromField(fieldOf(block, 'id'));
  if (blockId) block.id = blockId.replace(/^#/, '');

  const cfReference = getAuthoredReferencePath(fieldOf(block, 'cfReference'));
  const cfData = cfReference ? await fetchCFDetails(cfReference) : null;
  if (!cfData) {
    block.textContent = '';
    block.classList.add('culturist-card--empty');
    return;
  }

  const primaryImageField = fieldOf(block, 'primaryImage');
  const primaryPicture = getAuthoredPicture(primaryImageField);
  const primaryAlt = textFromField(fieldOf(block, 'primaryImageAlt'));
  if (primaryPicture && primaryAlt) setPictureAlt(primaryPicture, primaryAlt);

  const layout = document.createElement('div');
  layout.className = 'culturist-card-layout';

  const media = document.createElement('div');
  media.className = 'culturist-card-media';
  if (primaryPicture) {
    if (primaryImageField) moveInstrumentation(primaryImageField, media);
    media.append(primaryPicture);
  }

  const panel = document.createElement('div');
  panel.className = 'culturist-card-panel';

  const profile = document.createElement('div');
  profile.className = 'culturist-card-profile';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'culturist-card-avatar-wrap';

  const avatarPath = getReferencePath(cfData.image);
  const avatar = createImage(resolveAssetUrl(avatarPath), cfData.imageAltText || cfData.name || 'Culturist', 'culturist-card-avatar');
  if (avatar) avatarWrap.append(avatar);

  const signaturePath = getReferencePath(cfData.signatureImage);
  const signature = createImage(
    resolveAssetUrl(signaturePath),
    cfData.signatureAltText || `${cfData.name || 'Culturist'} signature`,
    'culturist-card-signature',
  );
  if (signature) avatarWrap.append(signature);

  if (avatarWrap.hasChildNodes()) profile.append(avatarWrap);

  const quote = buildQuote(cfData);
  if (quote) profile.append(quote);

  if (cfData.name) {
    const name = document.createElement('p');
    name.className = 'culturist-card-name';
    name.textContent = `- ${cfData.name}`;
    profile.append(name);
  }

  appendRichText(profile, cfData.description?.html, 'culturist-card-bio');
  panel.append(profile);

  const experience = document.createElement('div');
  experience.className = 'culturist-card-experience';

  const eyebrowField = fieldOf(block, 'experienceEyebrow');
  const eyebrowText = textFromField(eyebrowField);
  if (eyebrowText) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'culturist-card-eyebrow';
    eyebrow.textContent = eyebrowText;
    if (eyebrowField) moveInstrumentation(eyebrowField, eyebrow);
    experience.append(eyebrow);
  }

  const titleField = fieldOf(block, 'experienceTitle');
  const titleText = textFromField(titleField);
  if (titleText) {
    const title = document.createElement('h3');
    title.className = 'culturist-card-title';
    title.textContent = titleText;
    if (titleField) moveInstrumentation(titleField, title);
    experience.append(title);
  }

  const gallery = buildGallery(cfData);
  if (gallery) experience.append(gallery);

  const enquire = buildEnquireLink(block);
  const details = buildDetailsLink(cfData);
  if (enquire || details) {
    const ctas = document.createElement('div');
    ctas.className = 'culturist-card-ctas';
    if (enquire) ctas.append(enquire);
    if (details) ctas.append(details);
    experience.append(ctas);
  }

  panel.append(experience);
  layout.append(media, panel);
  block.replaceChildren(layout);
}