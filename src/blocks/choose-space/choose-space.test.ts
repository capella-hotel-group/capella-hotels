import decorate from './choose-space';

jest.mock('@/app/scripts.js', () => ({ moveInstrumentation: jest.fn() }), { virtual: true });

const BLOCK_ROWS =
  '<div><div>spaces</div></div><div><div>spaces-qa</div></div><div><div><p>Choose</p></div></div><div><div></div></div>';

function picture(src: string): string {
  return `<picture><img src="${src}" alt=""></picture>`;
}

function spaceRow(label: string, overlays?: { thumbnail: boolean; media: boolean }): string {
  const flag = (value: boolean | undefined): string => (overlays ? `<div>${value}</div>` : '');
  return `<div>
    <div>${label}</div>
    <div>${picture(`${label}-thumb.jpg`)}</div>
    ${flag(overlays?.thumbnail)}
    <div>image</div>
    <div>${picture(`${label}-hero.jpg`)}</div>
    ${flag(overlays?.media)}
    <div></div>
    <div>Eyebrow</div>
    <div><p>${label} title</p></div>
    <div><p>About ${label}</p></div>
    <div><p>Book</p><p><a href="/book">/book</a></p><p>false</p></div>
    <div></div>
  </div>`;
}

function build(rows: string): HTMLElement {
  const block = document.createElement('div');
  block.className = 'choose-space';
  block.innerHTML = BLOCK_ROWS + rows;
  document.body.append(block);
  decorate(block);
  return block;
}

const tinted = (block: HTMLElement, selector: string): boolean[] =>
  [...block.querySelectorAll(selector)].map((element) => element.classList.contains('has-dark-overlay'));

describe('choose-space dark overlays', () => {
  beforeAll(() => {
    window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn() })) as never;
    window.IntersectionObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as never;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('tints the thumbnail and the hero of each space independently', () => {
    const block = build(
      spaceRow('Manors', { thumbnail: true, media: false }) + spaceRow('Suites', { thumbnail: false, media: true }),
    );
    expect(tinted(block, '.choose-space-tab-media')).toEqual([true, false]);
    expect(tinted(block, '.choose-space-panel-media')).toEqual([false, true]);
    expect(block.querySelector('.choose-space-panel-title')?.textContent).toBe('Manors title');
  });

  it('reads spaces authored before the overlay toggles existed', () => {
    const block = build(spaceRow('Manors'));
    expect(tinted(block, '.choose-space-tab-media, .choose-space-panel-media')).toEqual([false, false]);
    expect(block.querySelector('.choose-space-panel-media img')?.getAttribute('src')).toBe('Manors-hero.jpg');
    expect(block.querySelector('.choose-space-eyebrow')?.textContent).toBe('Eyebrow');
    expect(block.querySelector<HTMLAnchorElement>('.choose-space-link-primary')?.getAttribute('href')).toBe('/book');
  });
});
