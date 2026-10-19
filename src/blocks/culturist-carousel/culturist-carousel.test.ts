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
