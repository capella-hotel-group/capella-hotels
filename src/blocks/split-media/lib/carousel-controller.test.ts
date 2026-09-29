// src/blocks/split-media/lib/carousel-controller.test.ts
import { CarouselController } from './carousel-controller';

function mockMatchMedia(matches: boolean): void {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

function buildSlides(count: number): HTMLElement[] {
  return Array.from({ length: count }, () => document.createElement('li'));
}

function buildDots(count: number): HTMLButtonElement[] {
  return Array.from({ length: count }, () => document.createElement('button'));
}

describe('CarouselController', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('init/goTo', () => {
    it('activates the first slide and dot on init', () => {
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 6, autoplay: false });

      carousel.init();

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
      expect(dots[0].classList.contains('is-active')).toBe(true);
      expect(dots[0].getAttribute('aria-selected')).toBe('true');
    });

    it('goTo activates the target slide/dot and deactivates the previous one', () => {
      mockMatchMedia(false);
      const slides = buildSlides(3);
      const dots = buildDots(3);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 6, autoplay: false });
      carousel.init();

      carousel.goTo(2);

      expect(slides[0].getAttribute('aria-hidden')).toBe('true');
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');
      expect(dots[0].classList.contains('is-active')).toBe(false);
      expect(dots[2].classList.contains('is-active')).toBe(true);
      expect(dots[2].getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('next/previous wraparound', () => {
    it('wraps forward past the last slide and backward past the first', () => {
      mockMatchMedia(false);
      const slides = buildSlides(3);
      const dots = buildDots(3);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 6, autoplay: false });
      carousel.init();

      carousel.previous();
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');

      carousel.next();
      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('is a no-op with a single slide', () => {
      mockMatchMedia(false);
      const slides = buildSlides(1);
      const dots = buildDots(1);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 6, autoplay: false });
      carousel.init();

      carousel.next();
      carousel.previous();

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });
  });

  describe('autoplay', () => {
    it('advances slides on the configured interval when enabled', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 5, autoplay: true });

      carousel.init();
      jest.advanceTimersByTime(5000);

      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
    });

    it('does not start a timer when autoplay is false', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 5, autoplay: false });

      carousel.init();
      jest.advanceTimersByTime(10000);

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('does not start a timer with only one slide even if autoplay is true', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(1);
      const dots = buildDots(1);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 5, autoplay: true });

      carousel.init();
      jest.advanceTimersByTime(10000);

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('disables autoplay under prefers-reduced-motion', () => {
      jest.useFakeTimers();
      mockMatchMedia(true);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 5, autoplay: true });

      carousel.init();
      jest.advanceTimersByTime(10000);

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('stops autoplay when the tab is hidden and restarts when visible again', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 5, autoplay: true });
      carousel.init();

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(10000);
      expect(slides[0].getAttribute('aria-hidden')).toBe('false');

      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(5000);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
    });

    it('restarts the autoplay countdown on manual goTo', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(3);
      const dots = buildDots(3);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 5, autoplay: true });
      carousel.init();

      jest.advanceTimersByTime(4000);
      carousel.goTo(2);
      jest.advanceTimersByTime(4000);
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');

      jest.advanceTimersByTime(1000);
      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });
  });

  describe('leaving/settling classes', () => {
    it('marks the outgoing slide as leaving, then settles it back after the transition window', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 6, autoplay: false });
      carousel.init();

      carousel.goTo(1);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(true);

      jest.advanceTimersByTime(700);
      expect(slides[0].classList.contains('split-media-slide--settling')).toBe(true);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);

      jest.advanceTimersByTime(16);
      expect(slides[0].classList.contains('split-media-slide--settling')).toBe(false);
    });

    it('re-marks a slide that becomes active again before it finished settling', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(3);
      const dots = buildDots(3);
      const carousel = new CarouselController({ slides, dots, intervalSeconds: 6, autoplay: false });
      carousel.init();

      carousel.goTo(1);
      carousel.goTo(0);
      carousel.goTo(1);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(true);

      jest.advanceTimersByTime(700);
      jest.advanceTimersByTime(16);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);
      expect(slides[0].classList.contains('split-media-slide--settling')).toBe(false);
    });
  });
});
