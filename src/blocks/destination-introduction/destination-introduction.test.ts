import decorate from './destination-introduction';

jest.mock(
  '@/app/scripts',
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
jest.mock('@/utils/env', () => ({ resolveDAMUrl: (url: string) => url }));

const COPY_ROWS = [
  '<div><div>destination-intro</div></div>',
  '<div><div>destination-intro-qa</div></div>',
  '<div><div>THE DESTINATION</div></div>',
  '<div><div><p>TITLE</p></div></div>',
  '<div><div><p>Body copy</p></div></div>',
  '<div><div><p>Discover</p><p><a href="/discover">/discover</a></p><p>false</p></div></div>',
].join('');

function mediaRow(index: number, editor = false): string {
  const attributes = editor
    ? ` data-aue-resource="urn:item-${index}" data-aue-model="destination-introduction-image" data-aue-type="component"`
    : '';
  return `<div${attributes}><div><picture><img src="thumb${index}.jpg" alt="Thumb ${index}"></picture></div><div>image</div><div><picture><img src="media${index}.jpg" alt="Media ${index}"></picture></div><div>false</div></div>`;
}

function build(itemCount: number, editor = false): HTMLElement {
  const block = document.createElement('div');
  block.className = 'destination-introduction';
  block.innerHTML =
    COPY_ROWS + Array.from({ length: itemCount }, (_value, index) => mediaRow(index + 1, editor)).join('');
  document.body.append(block);
  return block;
}

describe('destination-introduction', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    });
  });

  afterEach(() => {
    document.body.textContent = '';
  });

  it('renders only the first three media items on the page', () => {
    const block = build(5);

    decorate(block);

    expect(block.querySelectorAll('.destination-introduction-slide')).toHaveLength(3);
    expect(block.querySelectorAll('.destination-introduction-thumb')).toHaveLength(3);
    expect(
      [...block.querySelectorAll('.destination-introduction-slide img')].map((img) => img.getAttribute('src')),
    ).toEqual(['media1.jpg', 'media2.jpg', 'media3.jpg']);
    expect(block.querySelector('.destination-introduction-overflow')).toBeNull();
  });

  it('keeps extra editor items selectable in an author note', () => {
    const block = build(5, true);

    decorate(block);

    expect(block.querySelectorAll('.destination-introduction-slide')).toHaveLength(3);
    const note = block.querySelector('.destination-introduction-overflow');
    expect(note?.textContent).toContain('Only the first 3 media items are shown on the live page.');
    const items = [...(note?.querySelectorAll('li') ?? [])];
    expect(items.map((item) => item.dataset.aueResource)).toEqual(['urn:item-4', 'urn:item-5']);
    expect(items.map((item) => item.textContent)).toEqual([
      'Media 4: hidden on the live page',
      'Media 5: hidden on the live page',
    ]);
  });
});
