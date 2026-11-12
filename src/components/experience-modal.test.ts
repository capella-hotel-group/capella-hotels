import { createExperienceModal } from './experience-modal';
import type { ExperienceCard } from '@/types/experience.js';

jest.mock('@/app/aem.js', () => ({ loadCSS: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/utils/env.js', () => ({
  resolveDAMUrl: (path: string) => path,
}));

const card = (modalDetails: ExperienceCard['modalDetails'] = {}): ExperienceCard => ({
  cardHeadline: 'Experience',
  cardLocationTag: ['capella-hotels:destination/singapore'],
  modalDetails: {
    modalFeatureImageAsset: { _path: '/feature.jpg' },
    modalDescription: { html: '<p>Details</p>' },
    ...modalDetails,
  },
});

beforeEach(() => {
  document.body.replaceChildren();
});

it.each(['square', 'wide'])('maps the optional internal CTA in the %s popup', async (variant) => {
  const modal = createExperienceModal({
    testIdPrefix: 'experience-events-grid',
    rootTestId: 'experience-events-grid-modal',
    showModalEyebrow: true,
    showModalCategoryTag: true,
  });
  await modal.open(
    card({
      modalImageAspectRatioVariant: variant,
      modalCtaLabel: 'Discover',
      modalCtaUrlInternal: {
        _path: '/content/capella-hotels/global.html',
        _publishUrl: 'https://publish.example.com/content/capella-hotels/global.html',
      },
      openInNewTab: true,
    }),
    'Culture',
    'Singapore',
  );
  const cta = document.querySelector<HTMLAnchorElement>('[data-testid="experience-events-grid-modal-cta"]')!;
  expect(cta.getAttribute('href')).toBe('/global');
  expect(cta.target).toBe('_blank');
  expect(cta.rel).toBe('noopener noreferrer');
  expect(document.querySelector('[data-testid="experience-events-grid-modal"]')).not.toBeNull();
});

it('does not resolve a CTA URL when its label is blank', async () => {
  const modal = createExperienceModal({ testIdPrefix: 'filters-grid', showModalCategoryTag: true });
  await modal.open(card({ modalCtaLabel: ' ', modalCtaUrlInternal: { _path: 'http://[' } }), '');
  expect(document.querySelector('.filters-grid-modal-cta')).toBeNull();
  expect(document.querySelector('.filters-grid-modal-no-cta')).not.toBeNull();
});

it.each(['square', 'wide'])('switches carousel slides and traps focus in the %s popup', async (variant) => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const modal = createExperienceModal({
    testIdPrefix: 'experience-events-grid',
    rootTestId: 'experience-events-grid-modal',
    imageTestId: 'experience-events-grid-modal-image',
  });
  await modal.open(
    card({
      modalImageAspectRatioVariant: variant,
      carouselImages: [{ _path: '/first.jpg' }, { _path: '/second.jpg' }],
    }),
    '',
    '',
    false,
  );
  const dots = [...document.querySelectorAll<HTMLButtonElement>('.filters-grid-modal-pagination button')];
  expect(dots).toHaveLength(variant === 'wide' ? 3 : 2);
  expect(dots.every((dot) => dot.dataset.testid === 'experience-events-grid-modal-image')).toBe(true);
  dots[1]!.click();
  expect(dots[1]!.getAttribute('aria-pressed')).toBe('true');
  const active = document.querySelectorAll<HTMLImageElement>(
    '.filters-grid-modal-carousel img:not([hidden]), .filters-grid-modal-banner-slider img:not([hidden])',
  );
  expect(active).toHaveLength(1);
  const close = document.querySelector<HTMLButtonElement>('[data-testid="experience-events-grid-modal-close"]')!;
  close.focus();
  close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(dots[dots.length - 1]);
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(close);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(document.querySelector<HTMLElement>('[data-testid="experience-events-grid-modal"]')!.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
});

it('strips unsafe markup and respects the independent popup overlay setting', async () => {
  const modal = createExperienceModal({ testIdPrefix: 'experience-events-grid', showModalEyebrow: true });
  await modal.open(
    card({
      modalFeatureImageDarkImageOverlay: false,
      modalDescription: { html: '<p onclick="alert(1)">Details <a href="javascript:alert(1)">link</a></p>' },
    }),
    '',
    'Singapore',
    false,
  );
  const description = document.querySelector('.filters-grid-modal-description')!;
  expect(description.querySelector('[onclick], a[href]')).toBeNull();
  expect(description.textContent).toBe('Details link');
  expect(document.querySelector('.filters-grid-modal-no-overlay')).not.toBeNull();
});

it('keeps eyebrow and category visibility independently configurable', async () => {
  const modal = createExperienceModal({
    testIdPrefix: 'filters-grid',
    showModalEyebrow: false,
    showModalCategoryTag: true,
  });
  await modal.open(
    card({ modalCtaLabel: 'Discover', modalCtaUrlType: 'external', modalCtaUrlExternal: 'https://example.com' }),
    'Culture',
    'Singapore',
  );
  expect(document.querySelector('.filters-grid-modal-eyebrow')).toBeNull();
  expect(document.querySelector('.filters-grid-modal-category')?.textContent).toBe('Culture');
  expect(document.querySelector('[data-testid="filters-grid-modal-close"]')).not.toBeNull();
  expect(document.querySelector('[data-testid="filters-grid-modal-cta"]')).not.toBeNull();
});
jest.mock('@/utils/tag-title.js', () => ({ setTagTitle: jest.fn() }));
