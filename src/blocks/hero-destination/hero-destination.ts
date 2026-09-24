// src/blocks/hero-destination/hero-destination.ts
// Rows (authored): 0=autoplay, 1=autoplayInterval, 2=loop, 3=transitionEffect, 4=simulateTouch
// (config), 5..n=items (mediaType, image, imageMobile, imageAlt, video, videoMobile, heading)
import { CarouselController } from './lib/carousel-controller';
import { buildDotNav, buildSlide } from './lib/dom-builder';
import { resolveEffect } from './lib/effects';
import { parseCarouselConfig, parseItems } from './lib/parse';
import { initSwipe } from './lib/swipe';

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children] as HTMLElement[];
  const configRows = rows.filter((row) => row.children.length <= 1);
  const itemRows = rows.filter((row) => row.children.length > 1);

  const { autoplay, loop, intervalSeconds, transitionEffect, simulateTouch } = parseCarouselConfig(configRows);
  const items = parseItems(itemRows);
  if (items.length === 0) return;

  block.innerHTML = '';

  const track = document.createElement('ul');
  track.className = 'hero-destination-track';
  items.forEach((item, index) => track.append(buildSlide(item, index)));

  const overlay = document.createElement('div');
  overlay.className = 'hero-destination-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  block.append(track, overlay);

  const slides = [...track.children] as HTMLElement[];
  const mediaEls = slides.map((slide) => slide.querySelector('.hero-destination-media') as HTMLElement);
  const dotCount = items.length > 1 ? items.length : 0;
  const { nav, dots } = buildDotNav(dotCount);

  const carousel = new CarouselController({
    track,
    slides,
    mediaEls,
    dots,
    intervalSeconds,
    autoplay,
    loop,
    effect: resolveEffect(transitionEffect),
  });
  dots.forEach((dot, index) => dot.addEventListener('click', () => carousel.goTo(index)));
  if (dotCount > 0) block.append(nav);

  if (simulateTouch) {
    track.classList.add('hero-destination-track--swipeable');
    initSwipe(track, (direction) => (direction === 1 ? carousel.next() : carousel.previous()));
  }

  carousel.init();
}
