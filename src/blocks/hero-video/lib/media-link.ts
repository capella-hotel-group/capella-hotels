// src/blocks/hero-video/lib/media-link.ts
import type { HeroVideoItem } from './types';

/** Points the full-media anchor at the active item's link; without a link it stays non-interactive. */
export function applyMediaLink(anchor: HTMLAnchorElement, item: HeroVideoItem, isAuthoring: boolean): void {
  anchor.setAttribute('aria-label', item.label);

  if (!item.link || isAuthoring) {
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    return;
  }

  anchor.setAttribute('href', item.link);
  if (item.openInNewTab) {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  } else {
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  }
}
