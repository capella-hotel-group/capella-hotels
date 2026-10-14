// src/blocks/hero-destination/hero-destination.ts
// Rows (authored): 0=autoplay, 1=autoplayInterval, 2=loop, 3=transitionEffect, 4=simulateTouch
// (config), 5..n=items (see lib/parse.ts for the item field layout)
import { CarouselController } from './lib/carousel-controller';
import { buildDotNav, buildPlayToggle, buildSlide } from './lib/dom-builder';
import { resolveEffect } from './lib/effects';
import { parseCarouselConfig, parseItems } from './lib/parse';
import { initSwipe } from './lib/swipe';

let instanceCount = 0;

/** Background videos loop indefinitely, so the pause control has to stop them too, not just the rotation. */
function setVideosPlaying(block: HTMLElement, playing: boolean): void {
  block.querySelectorAll('video').forEach((video) => {
    if (!playing) {
      video.pause();
      return;
    }
    if (video.closest('.hero-destination-slide')?.getAttribute('aria-hidden') !== 'false') return;
    video.play()?.catch(() => {});
  });
}

/** APG tabs keyboard support for the dot tablist: arrows move and select, Home/End jump. */
function initTabKeys(nav: HTMLElement, dots: HTMLButtonElement[], select: (index: number) => void): void {
  nav.addEventListener('keydown', (event) => {
    const current = dots.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    const rtl = getComputedStyle(nav).direction === 'rtl';
    let next: number;
    if (event.key === 'ArrowRight') next = current + (rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') next = current - (rtl ? -1 : 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = dots.length - 1;
    else return;
    event.preventDefault();
    const target = (next + dots.length) % dots.length;
    select(target);
    dots[target]?.focus();
  });
}

export default function decorate(block: HTMLElement): void {
  const rows = [...block.children] as HTMLElement[];
  const configRows = rows.filter((row) => row.children.length <= 1);
  const itemRows = rows.filter((row) => row.children.length > 1);

  const { autoplay, loop, intervalSeconds, transitionEffect, simulateTouch } = parseCarouselConfig(configRows);
  const items = parseItems(itemRows);
  if (items.length === 0) return;

  block.innerHTML = '';
  instanceCount += 1;
  const idPrefix = `hero-destination-${instanceCount}`;

  const track = document.createElement('ul');
  track.className = 'hero-destination-track';
  // The li elements become tabpanels, so the list semantics have to go.
  track.setAttribute('role', 'presentation');
  track.setAttribute('aria-live', 'off');
  items.forEach((item, index) => track.append(buildSlide(item, index, idPrefix)));

  block.append(track);

  const slides = [...track.children] as HTMLElement[];
  const mediaEls = slides.map((slide) => slide.querySelector('.hero-destination-media') as HTMLElement);
  const headings = items.length > 1 ? items.map((item) => item.heading) : [];
  const { nav, dots } = buildDotNav(headings, idPrefix);

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
  if (dots.length > 0) {
    initTabKeys(nav, dots, (index) => carousel.goTo(index));
    block.append(nav);
  }

  if (simulateTouch) {
    track.classList.add('hero-destination-track--swipeable');
    initSwipe(track, (direction) => (direction === 1 ? carousel.next() : carousel.previous()));
  }

  carousel.init();

  if (!carousel.autoplayEnabled) return;

  const toggle = buildPlayToggle();
  toggle.addEventListener('click', () => {
    const paused = !carousel.userPaused;
    if (paused) carousel.pause('user');
    else carousel.resume('user');
    toggle.dataset.state = paused ? 'paused' : 'playing';
    toggle.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
    setVideosPlaying(block, !paused);
  });
  block.append(toggle);

  // Autoplay pauses only when hovering specifically over the pagination dots or
  // text heading, rather than the entire 100vh video background.
  // Touch taps emulate mouseenter and never fire a matching leave, which would freeze autoplay
  // permanently, so only real mice take part in hover pausing.
  const pauseOnHover = (el: HTMLElement): void => {
    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') carousel.pause('hover');
    });
    el.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') carousel.resume('hover');
    });
  };

  if (dots.length > 0) pauseOnHover(nav);
  track.querySelectorAll<HTMLElement>('.hero-destination-heading').forEach(pauseOnHover);

  block.addEventListener('focusin', (event) => {
    // The toggle is exempt: focusing it must not add a pause reason that outlives a Play click.
    if (event.target === toggle) carousel.resume('focus');
    else carousel.pause('focus');
  });
  block.addEventListener('focusout', (event) => {
    if (!block.contains(event.relatedTarget as Node | null)) carousel.resume('focus');
  });
}
