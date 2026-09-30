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

const controllers: CarouselController[] = [];
function createCarousel(options: ConstructorParameters<typeof CarouselController>[0]): CarouselController {
  const carousel = new CarouselController(options);
  controllers.push(carousel);
  return carousel;
}

describe('CarouselController', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
  afterEach(() => {
    controllers.splice(0).forEach((carousel) => carousel.destroy());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('init/goTo', () => {
    it('activates the first slide and dot on init', () => {
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = createCarousel({ slides, dots, intervalSeconds: 6, autoplay: false });

      carousel.init();

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
      expect(dots[0].classList.contains('is-active')).toBe(true);
      expect(dots[0].getAttribute('aria-current')).toBe('true');
    });

    it('goTo activates the target slide/dot and deactivates the previous one', () => {
      mockMatchMedia(false);
      const slides = buildSlides(3);
      const dots = buildDots(3);
      const carousel = createCarousel({ slides, dots, intervalSeconds: 6, autoplay: false });
      carousel.init();

      carousel.goTo(2);

      expect(slides[0].getAttribute('aria-hidden')).toBe('true');
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');
      expect(dots[0].classList.contains('is-active')).toBe(false);
      expect(dots[2].classList.contains('is-active')).toBe(true);
      expect(dots[2].getAttribute('aria-current')).toBe('true');
    });
  });

  describe('next/previous wraparound', () => {
    it('wraps forward past the last slide and backward past the first', () => {
      mockMatchMedia(false);
      const slides = buildSlides(3);
      const dots = buildDots(3);
      const carousel = createCarousel({ slides, dots, intervalSeconds: 6, autoplay: false });
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
      const carousel = createCarousel({ slides, dots, intervalSeconds: 6, autoplay: false });
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
      const carousel = createCarousel({ slides, dots, intervalSeconds: 5, autoplay: true });

      carousel.init();
      jest.advanceTimersByTime(5000);

      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
    });

    it('does not start a timer when autoplay is false', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = createCarousel({ slides, dots, intervalSeconds: 5, autoplay: false });

      carousel.init();
      jest.advanceTimersByTime(10000);

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('does not start a timer with only one slide even if autoplay is true', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(1);
      const dots = buildDots(1);
      const carousel = createCarousel({ slides, dots, intervalSeconds: 5, autoplay: true });

      carousel.init();
      jest.advanceTimersByTime(10000);

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('disables autoplay under prefers-reduced-motion', () => {
      jest.useFakeTimers();
      mockMatchMedia(true);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = createCarousel({ slides, dots, intervalSeconds: 5, autoplay: true });

      carousel.init();
      jest.advanceTimersByTime(10000);

      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('stops autoplay when the tab is hidden and restarts when visible again', () => {
      jest.useFakeTimers();
      mockMatchMedia(false);
      const slides = buildSlides(2);
      const dots = buildDots(2);
      const carousel = createCarousel({ slides, dots, intervalSeconds: 5, autoplay: true });
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
      const carousel = createCarousel({ slides, dots, intervalSeconds: 5, autoplay: true });
      carousel.init();

      jest.advanceTimersByTime(4000);
      carousel.goTo(2);
      jest.advanceTimersByTime(4000);
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');

      jest.advanceTimersByTime(1000);
      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });
  });

  describe('transition coordination', () => {
    function animatedSlides(count: number): HTMLElement[] {
      return buildSlides(count).map((slide) => {
        slide.innerHTML = '<div class="split-media-item"><div class="split-media-overlay"></div></div>'.repeat(2);
        slide.querySelectorAll<HTMLElement>('.split-media-item').forEach((panel, index) => {
          panel.style.transitionProperty = 'transform';
          panel.style.transitionDuration = '1.2s';
          panel.style.transitionDelay = index ? '100ms' : '0s';
          const overlay = panel.firstElementChild as HTMLElement;
          overlay.style.transitionProperty = 'opacity, transform';
          overlay.style.transitionDuration = '500ms';
          overlay.style.transitionDelay = index ? '1s' : '0.9s';
        });
        document.body.append(slide);
        return slide;
      });
    }

    function end(element: Element, propertyName = 'transform'): void {
      const event = new Event('transitionend', { bubbles: true });
      Object.defineProperty(event, 'propertyName', { value: propertyName });
      element.dispatchEvent(event);
    }

    function finish(slide: HTMLElement): void {
      slide.querySelectorAll('.split-media-item, .split-media-overlay').forEach((element) => end(element));
    }

    function setup(count = 3, autoplay = false, intervalSeconds = 6) {
      const slides = animatedSlides(count);
      const carousel = createCarousel({ slides, dots: buildDots(count), autoplay, intervalSeconds });
      carousel.init();
      return { slides, carousel };
    }

    beforeEach(() => {
      jest.useFakeTimers();
      mockMatchMedia(false);
    });

    afterEach(() => {
      document.body.replaceChildren();
    });

    it('does not mark the initial slide or a reselected active slide as leaving', () => {
      const { slides, carousel } = setup();
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);
      carousel.goTo(0);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);
    });

    it('resets outgoing panels only after both transforms end, ignoring bubbled overlay events', () => {
      const { slides, carousel } = setup();
      carousel.next();
      jest.advanceTimersByTime(700);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(true);
      end(slides[0].querySelector('.split-media-overlay')!);
      end(slides[0].children[0], 'opacity');
      end(slides[0].children[0]);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(true);
      end(slides[0].children[1]);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);
    });

    it('keeps only the latest target and waits for incoming text as well as panels', () => {
      const { slides, carousel } = setup(4);
      carousel.goTo(1);
      carousel.goTo(2);
      carousel.goTo(3);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      finish(slides[0]);
      [...slides[1].children].forEach((panel) => end(panel));
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      finish(slides[1]);
      expect(slides[3].getAttribute('aria-hidden')).toBe('false');
      expect(slides[2].getAttribute('aria-hidden')).toBe('true');
    });

    it('calculates successive arrows from the queued target, including wraparound', () => {
      const { slides, carousel } = setup(4);
      carousel.next(); // active 1
      carousel.next(); // queued 2
      carousel.next(); // queued 3
      carousel.next(); // queued 0
      carousel.previous(); // queued 3
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      finish(slides[0]);
      finish(slides[1]);
      expect(slides[3].getAttribute('aria-hidden')).toBe('false');
    });

    it('allows selecting the current slide to cancel a queued target without replaying', () => {
      const { slides, carousel } = setup();
      carousel.next();
      carousel.goTo(2);
      carousel.goTo(1);
      finish(slides[0]);
      finish(slides[1]);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      expect(slides[1].classList.contains('split-media-slide--leaving')).toBe(false);
    });

    it('uses computed duration and delay as fallback when transition events are absent', () => {
      const { slides, carousel } = setup();
      carousel.next();
      carousel.next();
      jest.advanceTimersByTime(1300);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(true);
      jest.advanceTimersByTime(50);
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      jest.advanceTimersByTime(200);
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');
    });

    it('does not let a short autoplay interval interrupt motion or overwrite queued navigation', () => {
      const { slides, carousel } = setup(4, true, 0.2);
      carousel.goTo(1);
      carousel.goTo(3);
      jest.advanceTimersByTime(1000);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      finish(slides[0]);
      finish(slides[1]);
      expect(slides[3].getAttribute('aria-hidden')).toBe('false');
    });

    it('waits a full autoplay interval after the final queued transition completes', () => {
      const { slides, carousel } = setup(4, true, 6);
      carousel.next();
      carousel.goTo(3);
      jest.advanceTimersByTime(3100);
      expect(slides[3].getAttribute('aria-hidden')).toBe('false');
      jest.advanceTimersByTime(5999);
      expect(slides[3].getAttribute('aria-hidden')).toBe('false');
      jest.advanceTimersByTime(1);
      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
    });

    it('suspends autoplay during gestures and resize, then starts one fresh countdown', () => {
      const { slides, carousel } = setup(3, true, 6);
      carousel.beginGesture();
      jest.advanceTimersByTime(10000);
      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
      carousel.endGesture();
      jest.advanceTimersByTime(5000);
      carousel.beginResize();
      jest.advanceTimersByTime(10000);
      expect(slides[0].getAttribute('aria-hidden')).toBe('false');
      carousel.endResize();
      expect(jest.getTimerCount()).toBe(1);
      jest.advanceTimersByTime(6000);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
    });

    it('settles a cancelled transition and consumes the latest queued target', () => {
      const { slides, carousel } = setup();
      carousel.next();
      carousel.goTo(2);
      const event = new Event('transitioncancel', { bubbles: true });
      Object.defineProperty(event, 'propertyName', { value: 'transform' });
      slides[1].children[0].dispatchEvent(event);
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);
    });

    it('holds the queued destination until resize has settled and ignores stale transition events', () => {
      const { slides, carousel } = setup();
      carousel.next();
      carousel.next();
      carousel.beginResize();
      expect(slides[0].classList.contains('split-media-slide--leaving')).toBe(false);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      finish(slides[1]);
      jest.advanceTimersByTime(2000);
      expect(slides[1].getAttribute('aria-hidden')).toBe('false');
      carousel.endResize();
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');
    });

    it('cleans up pending transitions, autoplay and visibility listeners on destroy', () => {
      const { slides, carousel } = setup(3, true, 0.2);
      carousel.next();
      carousel.next();
      carousel.destroy();
      const state = slides.map((slide) => slide.outerHTML);
      document.dispatchEvent(new Event('visibilitychange'));
      finish(slides[0]);
      finish(slides[1]);
      carousel.next();
      jest.advanceTimersByTime(5000);
      expect(slides.map((slide) => slide.outerHTML)).toEqual(state);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('navigates immediately with reduced motion even if elements declare transitions', () => {
      mockMatchMedia(true);
      const { slides, carousel } = setup();
      carousel.next();
      carousel.next();
      expect(slides[2].getAttribute('aria-hidden')).toBe('false');
      expect(slides.some((slide) => slide.classList.contains('split-media-slide--leaving'))).toBe(false);
    });
  });
});
