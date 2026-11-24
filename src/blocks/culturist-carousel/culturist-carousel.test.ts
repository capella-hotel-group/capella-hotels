jest.mock('@/app/scripts.js', () => ({ moveInstrumentation: () => {} }));
jest.mock('@/utils/env.js', () => ({ getPublishBaseUrl: () => 'https://publish.example' }));

import decorate from './culturist-carousel';

const NO_OVERLAY = 'culturist-carousel-carousel-col--no-overlay';

function buildBlock(items: string[][]): HTMLElement {
  const block = document.createElement('div');
  block.className = 'culturist-carousel';
  block.innerHTML =
    '<div><div>Prefix</div></div><div><div>Suffix</div></div>' +
    items.map((cells) => `<div>${cells.map((cell) => `<div>${cell}</div>`).join('')}</div>`).join('');
  document.body.append(block);
  return block;
}

const cfItem = {
  name: 'Culturist',
  cardContentReference: [{ title: 'Card', image: { _path: '/content/dam/a.jpg' } }],
};

describe('culturist-carousel overlay toggle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    Element.prototype.scrollIntoView = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { culturistTabDetailsByPath: { item: cfItem } } }),
    }) as jest.Mock;
  });

  it.each([
    [['Tab', '/cf/a'], false],
    [['Tab', '/cf/a', 'true'], false],
    [['Tab', '/cf/a', ''], false],
    [['Tab', '/cf/a', 'false'], true],
  ])('item %j -> no-overlay class %s on initial load', async (cells, hasClass) => {
    const block = buildBlock([cells]);
    await decorate(block);
    const col = block.querySelector('.culturist-carousel-carousel-col');
    expect(col?.classList.contains(NO_OVERLAY)).toBe(hasClass);
    expect(block.querySelectorAll('.culturist-carousel-carousel-card')).toHaveLength(1);
  });

  it.each([
    ['plain string', 'Tea ceremony in Gion'],
    ['rich text html', { html: '<p>Tea ceremony in <b>Gion</b></p>' }],
    ['rich text plaintext', { plaintext: 'Tea ceremony in Gion' }],
  ])('renders a %s card description inside the text overlay', async (_label, description) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          culturistTabDetailsByPath: {
            item: { ...cfItem, cardContentReference: [{ title: 'Card', description, image: { _path: '/a.jpg' } }] },
          },
        },
      }),
    }) as jest.Mock;
    const block = buildBlock([['Tab', '/cf/a']]);
    await decorate(block);
    const content = block.querySelector('.culturist-carousel-card-content');
    const text = content?.querySelector('.culturist-carousel-card-text');
    expect(text?.querySelector('.culturist-carousel-card-title')?.textContent).toBe('Card');
    expect(text?.querySelector('.culturist-carousel-card-description')?.textContent).toBe('Tea ceremony in Gion');
    expect(content?.classList.contains('culturist-carousel-card-content--has-description')).toBe(true);
  });

  it('renders the location eyebrow above the title', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          culturistTabDetailsByPath: {
            item: { ...cfItem, cardContentReference: [{ title: 'Card', eyebrowLocation: ' Gion, Kyoto ' }] },
          },
        },
      }),
    }) as jest.Mock;
    const block = buildBlock([['Tab', '/cf/a']]);
    await decorate(block);
    const text = block.querySelector('.culturist-carousel-card-text');
    expect(text?.firstElementChild?.className).toBe('culturist-carousel-card-location');
    expect(text?.firstElementChild?.textContent).toBe('Gion, Kyoto');
  });

  it('omits the description element when the card has none', async () => {
    const block = buildBlock([['Tab', '/cf/a']]);
    await decorate(block);
    expect(block.querySelector('.culturist-carousel-card-location')).toBeNull();
    expect(block.querySelector('.culturist-carousel-card-description')).toBeNull();
    expect(block.querySelector('.culturist-carousel-card-content--has-description')).toBeNull();
  });

  it('marks the leftmost card active so mobile shows its description by default', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          culturistTabDetailsByPath: {
            item: { ...cfItem, cardContentReference: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] },
          },
        },
      }),
    }) as jest.Mock;
    const block = buildBlock([['Tab', '/cf/a']]);
    await decorate(block);
    const cards = [...block.querySelectorAll('.culturist-carousel-carousel-card')];
    expect(cards.map((card) => card.classList.contains('is-active'))).toEqual([true, false, false]);
  });

  it('hides both arrows when a destination has a single card', async () => {
    const block = buildBlock([['Tab', '/cf/a']]);
    await decorate(block);
    expect(block.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-prev')?.hidden).toBe(true);
    expect(block.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-next')?.hidden).toBe(true);
    expect(block.querySelector('.culturist-carousel-carousel-card')?.classList.contains('is-active')).toBe(true);
  });

  it('shows the empty state without cards when a destination has none', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { culturistTabDetailsByPath: { item: { ...cfItem, cardContentReference: [null] } } },
      }),
    }) as jest.Mock;
    const block = buildBlock([['Tab', '/cf/a']]);
    await decorate(block);
    const col = block.querySelector('.culturist-carousel-carousel-col');
    expect(col?.classList.contains('culturist-carousel-carousel--empty')).toBe(true);
    expect(block.querySelectorAll('.culturist-carousel-carousel-card')).toHaveLength(0);
  });

  it('disables prev on the first card and next on the last card instead of looping', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          culturistTabDetailsByPath: {
            item: { ...cfItem, cardContentReference: [{ title: 'A' }, { title: 'B' }] },
          },
        },
      }),
    }) as jest.Mock;
    const block = buildBlock([['Tab', '/cf/a']]);
    await decorate(block);
    const track = block.querySelector('.culturist-carousel-carousel-track')!;
    const prev = block.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-prev')!;
    const next = block.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-next')!;
    const activeIndex = () => [...track.children].findIndex((card) => card.classList.contains('is-active'));
    expect(next.hidden).toBe(false);
    expect([prev.disabled, next.disabled]).toEqual([true, false]);

    next.click();
    expect(activeIndex()).toBe(1);
    expect([prev.disabled, next.disabled]).toEqual([false, true]);

    next.click();
    expect(activeIndex()).toBe(1);

    prev.click();
    expect(activeIndex()).toBe(0);
    expect([prev.disabled, next.disabled]).toEqual([true, false]);
  });

  describe('loop', () => {
    const mockCards = (titles: string[]) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            culturistTabDetailsByPath: {
              item: { ...cfItem, cardContentReference: titles.map((title) => ({ title, cardExternalLink: '/x' })) },
            },
          },
        }),
      }) as jest.Mock;
    };
    const activeTitle = (block: HTMLElement) =>
      block.querySelector('.culturist-carousel-carousel-card.is-active .culturist-carousel-card-title')?.textContent;

    it('adds no clones and hides the arrows for a single card', async () => {
      mockCards(['A']);
      const block = buildBlock([['Tab', '/cf/a']]);
      block.classList.add('loop');
      await decorate(block);
      expect(block.querySelectorAll('.culturist-carousel-carousel-card')).toHaveLength(1);
      expect(block.querySelector('[data-clone]')).toBeNull();
      expect(block.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-next')?.hidden).toBe(true);
    });

    it.each([[['A', 'B']], [['A', 'B', 'C']], [['A', 'B', 'C', 'D']]])(
      'surrounds %j with hidden, untabbable whole-set clones',
      async (titles) => {
        mockCards(titles);
        const block = buildBlock([['Tab', '/cf/a']]);
        block.classList.add('loop');
        await decorate(block);
        const track = block.querySelector('.culturist-carousel-carousel-track')!;
        const all = [...track.querySelectorAll<HTMLElement>('.culturist-carousel-carousel-card')];
        const real = all.filter((card) => !card.hasAttribute('data-clone'));
        const perSide = (all.length - real.length) / 2;
        expect(real.map((card) => card.textContent)).toEqual(titles);
        expect(perSide % titles.length).toBe(0);
        expect(all.slice(0, perSide).every((card) => card.hasAttribute('data-clone'))).toBe(true);
        expect(all.slice(-perSide).every((card) => card.hasAttribute('data-clone'))).toBe(true);
        expect(all.map((card) => card.textContent)).toEqual(
          all.map((_, i) => titles[(i - perSide + 99 * titles.length) % titles.length]),
        );
        track.querySelectorAll('[data-clone]').forEach((clone) => {
          expect(clone.getAttribute('aria-hidden')).toBe('true');
          expect(clone.querySelector('a')?.getAttribute('tabindex')).toBe('-1');
        });
        expect(real[0]!.classList.contains('is-active')).toBe(true);
        expect(track.classList.contains('is-looping')).toBe(true);
      },
    );

    it('keeps both arrows enabled and steps through the clones in order', async () => {
      mockCards(['A', 'B', 'C']);
      const block = buildBlock([['Tab', '/cf/a']]);
      block.classList.add('loop');
      await decorate(block);
      const prev = block.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-prev')!;
      const next = block.querySelector<HTMLButtonElement>('.culturist-carousel-carousel-next')!;
      const seen: (string | null | undefined)[] = [];
      for (let i = 0; i < 4; i += 1) {
        next.click();
        seen.push(activeTitle(block));
        expect([prev.disabled, next.disabled]).toEqual([false, false]);
      }
      expect(seen).toEqual(['B', 'C', 'A', 'B']);
      seen.length = 0;
      for (let i = 0; i < 5; i += 1) {
        prev.click();
        seen.push(activeTitle(block));
      }
      expect(seen).toEqual(['A', 'C', 'B', 'A', 'C']);
    });
  });

  it('updates the class when switching tabs', async () => {
    jest.useFakeTimers();
    const block = buildBlock([
      ['One', '/cf/a', 'true'],
      ['Two', '/cf/b', 'false'],
    ]);
    await decorate(block);
    const col = block.querySelector('.culturist-carousel-carousel-col')!;
    const options = block.querySelectorAll<HTMLElement>('.culturist-carousel-destination-option');
    expect(col.classList.contains(NO_OVERLAY)).toBe(false);

    options[1].click();
    await jest.advanceTimersByTimeAsync(500);
    expect(col.classList.contains(NO_OVERLAY)).toBe(true);

    options[0].click();
    await jest.advanceTimersByTimeAsync(500);
    expect(col.classList.contains(NO_OVERLAY)).toBe(false);
    jest.useRealTimers();
  });
});
