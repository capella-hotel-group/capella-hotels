// src/blocks/split-media/split-media.ts
// Rows (authored): 0=id, 1=dataTestId, 2=autoplay, 3=autoplayInterval, 4..n=panels, paired up
// sequentially two-at-a-time into slides — see lib/parse.ts
import { applyBlockIdentity } from '@/utils/block-identity.js';
import { CarouselController } from './lib/carousel-controller';
import { buildArrowNav, buildDotNav, buildSlide } from './lib/dom-builder';
import { isItemRow, parseCarouselConfig, parseSlides } from './lib/parse';

export default function decorate(block: HTMLElement): void {
  block.setAttribute('data-testid', 'split-media');

  const rows = [...block.children] as HTMLElement[];
  const itemRows = rows.filter(isItemRow);
  const configRows = applyBlockIdentity(
    block,
    rows.filter((row) => !itemRows.includes(row)),
    { hiddenClass: 'split-media-hidden', contentRows: 2 },
  );

  const { autoplay, intervalSeconds } = parseCarouselConfig(configRows);
  const slides = parseSlides(itemRows);
  if (slides.length === 0) return;

  block.innerHTML = '';

  const track = document.createElement('ul');
  track.className = 'split-media-track';
  slides.forEach((slide, index) => track.append(buildSlide(slide, index)));
  block.append(track);

  const slideEls = [...track.children] as HTMLElement[];
  const dotCount = slides.length > 1 ? slides.length : 0;
  const { nav: dotNav, dots } = buildDotNav(dotCount);

  const carousel = new CarouselController({ slides: slideEls, dots, intervalSeconds, autoplay });
  dots.forEach((dot, index) => dot.addEventListener('click', () => carousel.goTo(index)));

  if (slides.length > 1) {
    const { nav: arrowNav, prev, next } = buildArrowNav();
    prev.addEventListener('click', () => carousel.previous());
    next.addEventListener('click', () => carousel.next());
    block.append(arrowNav);
  }
  if (dotCount > 0) block.append(dotNav);

  carousel.init();
}
