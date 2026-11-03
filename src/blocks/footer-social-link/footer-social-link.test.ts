import decorate from './footer-social-link';

jest.mock('@/app/scripts.js', () => ({
  moveInstrumentation: (from: Element, to: Element) => {
    [...from.attributes]
      .filter(({ name }) => name.startsWith('data-aue-'))
      .forEach(({ name, value }) => {
        to.setAttribute(name, value);
        from.removeAttribute(name);
      });
  },
}));

describe('footer-social-link without a platform field', () => {
  afterEach(() => document.body.replaceChildren());

  function createBlock(item: string): HTMLElement {
    const block = document.createElement('div');
    block.innerHTML = `<div><div>Follow Us</div></div><div data-aue-model="footer-social-item">${item}</div>`;
    document.body.append(block);
    return block;
  }

  it.each([false, true])('renders links with a legacy leading field present: %s', (legacy) => {
    const block = createBlock(`
      ${legacy ? '<div>obsolete-platform</div>' : ''}
      <div><picture><img src="/icon.png" alt="Instagram"></picture></div>
      <div><a href="https://www.instagram.com/capellahotels/">Instagram URL</a></div>
      <div>true</div>
    `);
    const picture = block.querySelector('picture');
    decorate(block);
    const link = block.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://www.instagram.com/capellahotels/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.querySelector('img')?.alt).toBe('Instagram');
    expect(link.querySelector('picture')?.outerHTML).toBe(picture?.outerHTML);
    expect(link.textContent).toContain('opens in a new tab');
    expect(block.textContent).not.toContain('obsolete-platform');
    expect(block.querySelector('li')?.getAttribute('data-aue-model')).toBe('footer-social-item');
  });

  it('finds the URL without relying on omitted icon and alt cells', () => {
    const block = createBlock('<div>https://example.com/social</div><div>false</div>');
    decorate(block);
    expect(block.querySelector('a')?.href).toBe('https://example.com/social');
    expect(block.querySelector('a')?.textContent).toBe('Link');
    expect(block.querySelector('a')?.hasAttribute('target')).toBe(false);
  });

  it('does not turn a linked icon asset into the social destination', () => {
    const block = createBlock(`
      <div><a href="/content/dam/icon.png"><picture><img alt="Facebook"></picture></a></div>
      <div><a href="https://example.com/facebook">URL</a></div>
      <div>false</div>
    `);
    decorate(block);
    expect(block.querySelector('a')?.href).toBe('https://example.com/facebook');
    expect(block.querySelectorAll('a')).toHaveLength(1);
  });

  it('does not render a link without a URL', () => {
    const block = createBlock('<div></div><div></div>');
    decorate(block);
    expect(block.querySelector('li')).toBeNull();
    expect(block.querySelector('a')).toBeNull();
  });
});
