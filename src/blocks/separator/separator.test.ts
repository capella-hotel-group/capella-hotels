import decorate from './separator';

function createBlock(values: string[]): HTMLElement {
  const block = document.createElement('div');
  block.className = 'separator block';
  block.innerHTML = values.map((value) => `<div><div>${value}</div></div>`).join('');
  document.body.append(block);
  return block;
}

describe('separator', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('uses authored padding, hides on publish by default, and preserves authored fields', () => {
    const block = createBlock(['30px', '80px', 'false', 'true']);
    block.children[0]?.setAttribute('data-aue-prop', 'topPadding');

    decorate(block);

    expect(block.style.getPropertyValue('--separator-padding-top')).toBe('30px');
    expect(block.style.getPropertyValue('--separator-padding-bottom')).toBe('80px');
    expect(block.classList.contains('separator--publish-hidden')).toBe(true);
    expect(block.classList.contains('separator--with-line')).toBe(true);
    expect(block.querySelector('[data-aue-prop="topPadding"]')).not.toBeNull();
    expect(block.dataset.testid).toBe('separator');
  });

  it('shows on publish when enabled and omits the line unless selected', () => {
    const block = createBlock(['10px', '20px', 'true', 'false']);

    decorate(block);

    expect(block.classList.contains('separator--publish-hidden')).toBe(false);
    expect(block.classList.contains('separator--with-line')).toBe(false);
  });

  it('falls back to safe defaults for missing or invalid values', () => {
    const block = createBlock(['999px', '']);

    decorate(block);

    expect(block.style.getPropertyValue('--separator-padding-top')).toBe('10px');
    expect(block.style.getPropertyValue('--separator-padding-bottom')).toBe('10px');
    expect(block.classList.contains('separator--publish-hidden')).toBe(true);
  });
});
