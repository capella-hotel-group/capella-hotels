import { applyMediaLink } from './media-link';
import type { HeroVideoItem } from './types';

function createItem(overrides: Partial<HeroVideoItem> = {}): HeroVideoItem {
  return {
    label: 'Ubud',
    videoUrl: '',
    posterUrl: '',
    link: '/destination',
    openInNewTab: false,
    focalDesktop: 'center',
    focalMobile: 'center',
    sourceRow: document.createElement('div'),
    ...overrides,
  };
}

describe('applyMediaLink', () => {
  it('sets href and label for a same-tab link', () => {
    const anchor = document.createElement('a');
    applyMediaLink(anchor, createItem(), false);

    expect(anchor.getAttribute('href')).toBe('/destination');
    expect(anchor.getAttribute('aria-label')).toBe('Ubud');
    expect(anchor.hasAttribute('target')).toBe(false);
    expect(anchor.hasAttribute('rel')).toBe(false);
  });

  it('opens in a safe new tab when requested', () => {
    const anchor = document.createElement('a');
    applyMediaLink(anchor, createItem({ openInNewTab: true }), false);

    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('clears stale attributes when the next item has no link', () => {
    const anchor = document.createElement('a');
    applyMediaLink(anchor, createItem({ openInNewTab: true }), false);
    applyMediaLink(anchor, createItem({ link: null }), false);

    expect(anchor.hasAttribute('href')).toBe(false);
    expect(anchor.hasAttribute('target')).toBe(false);
    expect(anchor.hasAttribute('rel')).toBe(false);
  });

  it('never sets href in Universal Editor authoring', () => {
    const anchor = document.createElement('a');
    applyMediaLink(anchor, createItem(), true);

    expect(anchor.hasAttribute('href')).toBe(false);
  });
});
