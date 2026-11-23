import type { ExperienceCard, ExperienceReference, ExperienceModalDetails } from '@/types/experience.js';

export function normalizeChoice(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function pageReferenceUrl(reference?: ExperienceReference | null): string {
  const value = reference?._path?.trim() || reference?._publishUrl?.trim() || '';
  if (!value) return '';
  const url = new URL(value, window.location.href);
  const isEds = /(?:\.aem\.(?:page|live)$|^localhost$|^127\.0\.0\.1$)/i.test(window.location.hostname);
  const root = '/content/capella-hotels';
  if (url.pathname === root || url.pathname.startsWith(`${root}/`) || url.pathname === `${root}.html`) {
    if (!isEds) {
      const path = /\.html$/i.test(url.pathname) ? url.pathname : `${url.pathname}.html`;
      return `${path}${url.search}${url.hash}`;
    }
    const path = url.pathname.slice(root.length).replace(/\.html$/i, '') || '/';
    return `${path}${url.search}${url.hash}`;
  }
  return value;
}

export function resolveCardHref(
  card: Pick<ExperienceCard, 'directDestinationUrlType' | 'directDestinationUrl' | 'directDestinationExternalUrl'>,
): string {
  if (normalizeChoice(card.directDestinationUrlType) === 'external') {
    return card.directDestinationExternalUrl?.trim() || '';
  }
  return pageReferenceUrl(card.directDestinationUrl);
}

export function resolveModalHref(details: ExperienceModalDetails): string {
  if (normalizeChoice(details.modalCtaUrlType) === 'external') {
    return details.modalCtaUrlExternal?.trim() || '';
  }
  return pageReferenceUrl(details.modalCtaUrlInternal);
}
