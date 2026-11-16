import decorate from './offers-carousel';

jest.mock('@/utils/env.js', () => ({
  isUniversalEditor: () => true,
}));

function createBlock(value?: string, instrumented = false, legacy = false): HTMLElement {
  const overlay = value === undefined ? '' : `<div ${instrumented ? 'data-aue-prop="darkOverlay"' : ''}>${value}</div>`;
  const block = document.createElement('div');
  block.className = 'offers-carousel';
  block.innerHTML = `
    <div><div>Offers</div></div>
    <div><div><p>A stay</p><p>To remember</p></div></div>
    <div ${instrumented ? 'data-aue-model="offers-carousel-item"' : ''}>
      <div><picture><img src="/offer.jpg" alt="Offer"></picture></div>
      ${legacy ? '' : overlay}
      <div><p>Stay longer</p><p>Offer title</p><p>Offer details</p></div>
      <div><p><a href="/book">Book</a></p><p>true</p><p><a href="/details">Details</a></p><p>false</p></div>
      ${legacy ? overlay : ''}
    </div>`;
  document.body.append(block);
  return block;
}

describe('offers-carousel image overlay', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn(() => ({ matches: false })),
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each([true, false])('reads published and editor fields (instrumented: %s)', (instrumented) => {
    const block = createBlock('false', instrumented);
    const overlayField = block.lastElementChild!.children[1]!;
    decorate(block);
    expect(block.querySelector('.offers-carousel-card-media-no-overlay')).not.toBeNull();
    expect(block.contains(overlayField)).toBe(true);
    expect(overlayField.classList.contains('offers-carousel-hidden')).toBe(true);
    if (instrumented) expect(overlayField.getAttribute('data-aue-prop')).toBe('darkOverlay');
  });

  it.each([true, false])('reads the overlay cell published after the CTAs (instrumented: %s)', (instrumented) => {
    const block = createBlock('false', instrumented, true);
    const overlayField = block.lastElementChild!.lastElementChild!;
    decorate(block);
    expect(block.querySelector('.offers-carousel-card-media-no-overlay')).not.toBeNull();
    expect(overlayField.classList.contains('offers-carousel-hidden')).toBe(true);
    expect(block.querySelectorAll('.offers-carousel-card-cta')).toHaveLength(2);
  });

  it.each([false, true])('reads a flag that block decoration wrapped in a paragraph (legacy: %s)', (legacy) => {
    const block = createBlock('<p>false</p>', false, legacy);
    decorate(block);
    expect(block.querySelector('.offers-carousel-card-media-no-overlay')).not.toBeNull();
    expect(block.querySelector('.offers-carousel-hidden')?.textContent).toBe('false');
    expect(block.querySelector('.offers-carousel-card-eyebrow')?.textContent).toBe('Stay longer');
    expect(block.querySelectorAll('.offers-carousel-card-cta')).toHaveLength(2);
  });

  it.each([undefined, '', 'true'])('preserves the existing shade for %s', (value) => {
    const block = createBlock(value);
    decorate(block);
    expect(block.querySelector('.offers-carousel-card-media-no-overlay')).toBeNull();
    expect(block.querySelectorAll('.offers-carousel-card')).toHaveLength(1);
  });

  it('keeps CTA labels, targets, heading lines and repeated decoration unchanged', () => {
    const block = createBlock('false');
    decorate(block);
    decorate(block);
    const links = [...block.querySelectorAll<HTMLAnchorElement>('.offers-carousel-card-cta')];
    expect(links.map((link) => link.textContent)).toEqual(['Book', 'Details']);
    expect(links[0]!.target).toBe('_blank');
    expect(links[0]!.rel).toBe('noopener noreferrer');
    expect(links[1]!.target).toBe('');
    expect(block.querySelectorAll('.offers-carousel-title > p')).toHaveLength(2);
    expect(block.querySelectorAll('.offers-carousel-layout')).toHaveLength(1);
  });

  it('controls each card independently', () => {
    const block = createBlock('false');
    const other = createBlock('true');
    block.append(other.lastElementChild!);
    other.remove();
    decorate(block);
    const media = [...block.querySelectorAll('.offers-carousel-card-media')];
    expect(media.map((item) => item.classList.contains('offers-carousel-card-media-no-overlay'))).toEqual([
      true,
      false,
    ]);
  });
});
