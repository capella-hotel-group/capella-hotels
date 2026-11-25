import decorate from './accordion';

jest.mock(
  '@/app/scripts.js',
  () => ({
    moveInstrumentation: (source: HTMLElement, target: HTMLElement | null) => {
      [...source.attributes]
        .filter(({ name }) => name.startsWith('data-aue-'))
        .forEach(({ name, value }) => {
          target?.setAttribute(name, value);
          source.removeAttribute(name);
        });
    },
  }),
  { virtual: true },
);

function buildBlock(items: Array<[string, string]>, { editor = false } = {}): HTMLElement {
  const block = document.createElement('div');
  block.className = 'accordion';
  const itemAttr = editor ? ' data-aue-model="accordion-item"' : '';
  block.innerHTML = [
    '<div><div>faq-anchor</div></div>',
    '<div><div>faq-test</div></div>',
    '<div><div><p>Good to know</p></div></div>',
    ...items.map(([q, a]) => `<div${itemAttr}><div>${q}</div><div><p>${a}</p></div></div>`),
  ].join('');
  document.body.append(block);
  return block;
}

const triggers = (block: HTMLElement): HTMLButtonElement[] => [
  ...block.querySelectorAll<HTMLButtonElement>('.accordion-trigger'),
];

describe('accordion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('opens only the first item on load and wires the disclosure attributes', () => {
    const block = buildBlock([
      ['Q1', 'A1'],
      ['Q2', 'A2'],
    ]);
    decorate(block);

    const [first, second] = triggers(block);
    expect(first!.getAttribute('aria-expanded')).toBe('true');
    expect(second!.getAttribute('aria-expanded')).toBe('false');
    const panel = block.querySelector<HTMLElement>(`#${first!.getAttribute('aria-controls')}`);
    expect(panel!.hasAttribute('inert')).toBe(false);
    expect(panel!.getAttribute('aria-labelledby')).toBe(first!.id);
    expect(block.querySelectorAll('.accordion-answer')[1]!.hasAttribute('inert')).toBe(true);
  });

  it('toggles an item on click', () => {
    const block = buildBlock([
      ['Q1', 'A1'],
      ['Q2', 'A2'],
    ]);
    decorate(block);
    const [first, second] = triggers(block);

    second!.click();
    expect(second!.getAttribute('aria-expanded')).toBe('true');
    first!.click();
    expect(first!.getAttribute('aria-expanded')).toBe('false');
    expect(block.querySelector<HTMLElement>(`#${first!.getAttribute('aria-controls')}`).hasAttribute('inert')).toBe(
      true,
    );
  });

  it('consumes the identity rows and keeps the heading row in place', () => {
    const block = buildBlock([['Q1', 'A1']]);
    decorate(block);

    expect(block.id).toBe('faq-anchor');
    expect(block.dataset.testId).toBe('faq-test');
    expect(block.querySelector('.accordion-heading')!.textContent).toBe('Good to know');
    expect(block.querySelectorAll('.accordion-hidden')).toHaveLength(2);
  });

  it('skips empty published items but keeps an empty editor item with a placeholder', () => {
    const published = buildBlock([
      ['', 'orphan answer'],
      ['Q1', 'A1'],
    ]);
    decorate(published);
    expect(published.querySelectorAll('.accordion-item')).toHaveLength(1);

    const editor = buildBlock([['', '']], { editor: true });
    decorate(editor);
    expect(editor.querySelector('.accordion-question-text')!.textContent).toBe('New question');
  });

  it('opens the item that gets selected in the editor', () => {
    const block = buildBlock(
      [
        ['Q1', 'A1'],
        ['Q2', 'A2'],
      ],
      { editor: true },
    );
    decorate(block);

    block.querySelectorAll('.accordion-item')[1]!.dispatchEvent(new Event('aue:ui-select', { bubbles: true }));
    expect(triggers(block)[1]!.getAttribute('aria-expanded')).toBe('true');
  });
});
