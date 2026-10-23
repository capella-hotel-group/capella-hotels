import decorate, { resolvePickerPath } from './filters-grid';

jest.mock('@/utils/env.js', () => ({
  getPublishBaseUrl: () => 'https://publish.example.com',
  resolveDAMUrl: (value: string) => value,
}));

describe('filters-grid child tag filters', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  function createBlock(experienceRoot = 'capella-hotels:experience'): HTMLElement {
    const block = document.createElement('div');
    const values = [
      'white',
      'Discover',
      'Experiences',
      '/content/dam/cards',
      'destination',
      'Experience',
      experienceRoot,
      'Destination',
      '/content/cq:tags/capella-hotels/destination',
      'Reveal More',
    ];
    values.forEach((value) => {
      const row = document.createElement('div');
      const cell = document.createElement('div');
      cell.textContent = value;
      row.append(cell);
      block.append(row);
    });
    document.body.append(block);
    return block;
  }

  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.includes('/graphql/')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              filterGridCardDetailsList: {
                items: [
                  {
                    cardHeadline: 'Bangkok Experience',
                    cardLocationTag: ['capella-hotels:destination/bangkok'],
                    associatedFilterTags: [
                      '/content/cq:tags/capella-hotels/experience/culture',
                      'capella-hotels:interest/culture',
                      'capella-hotels:type/retreat',
                    ],
                  },
                ],
              },
            },
          }),
        };
      }
      const rootTag = url.searchParams.get('tag') || '';
      const destination = rootTag.includes('destination');
      return {
        ok: true,
        json: async () => ({
          status: 'success',
          code: 200,
          data: destination
            ? [
                { path: '/content/cq:tags/capella-hotels/destination/bangkok', title: 'Bangkok Title' },
                { path: '/content/cq:tags/capella-hotels/destination/hanoi', title: 'Hanoi Title' },
              ]
            : rootTag.includes(':interest')
              ? [{ path: '/content/cq:tags/capella-hotels/interest/culture', title: 'Interest Culture' }]
              : rootTag.includes(':type')
                ? [{ path: '/content/cq:tags/capella-hotels/type/retreat', title: 'Retreats' }]
                : [{ path: '/content/cq:tags/capella-hotels/experience/culture', title: 'Local Culture' }],
        }),
      };
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ['/content/dam/cards.html', '/content/dam/cards'],
    ['https://author.example.com/content/dam/cards.html?preview=true#folder', '/content/dam/cards'],
    [' /content/dam/cards.HTML ', '/content/dam/cards'],
    ['/content/dam/cards', '/content/dam/cards'],
    ['/content/dam/cards.html/archive', '/content/dam/cards.html/archive'],
    ['', ''],
  ])('normalizes the Content Fragment root %s without a delivery suffix', (value, expected) => {
    expect(resolvePickerPath(value, 'https://local.example.com')).toBe(expected);
  });

  it('requests the repository folder rather than the picker HTML URL', async () => {
    const block = createBlock();
    const rootCell = block.children[3]!.firstElementChild!;
    const anchor = document.createElement('a');
    anchor.href = 'https://author.example.com/content/dam/cards.html?preview=true#folder';
    anchor.textContent = 'Cards';
    rootCell.replaceChildren(anchor);
    await decorate(block);
    const graphqlRequests = fetchMock.mock.calls.filter(([url]) => String(url).includes('/graphql/'));
    expect(graphqlRequests).toHaveLength(1);
    expect(graphqlRequests[0]?.[0]).toBe(
      'https://publish.example.com/graphql/execute.json/capella-hotels/Filter-grid-card;path=/content/dam/cards',
    );
  });

  it('starts card and child-tag requests concurrently', async () => {
    const pendingResponses: Array<(response: { ok: boolean; json: () => Promise<unknown> }) => void> = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => pendingResponses.push(resolve)));
    const block = createBlock();
    const decoration = decorate(block);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(block.getAttribute('aria-busy')).toBe('true');
    pendingResponses.forEach((resolve, index) => {
      resolve({
        ok: true,
        json: async () => (index === 0 ? { data: { filterGridCardDetailsList: { items: [] } } } : { data: [] }),
      });
    });
    await decoration;
    expect(block.hasAttribute('aria-busy')).toBe(false);
  });

  it('requests both authored roots and displays every child using API titles and order', async () => {
    const block = createBlock();
    await decorate(block);

    const tagRequests = fetchMock.mock.calls
      .map(([input]) => new URL(input as string))
      .filter((url) => url.pathname === '/content/servlet.childtags.json');
    expect(tagRequests.map((url) => url.searchParams.get('tag'))).toEqual([
      'capella-hotels:experience',
      '/content/cq:tags/capella-hotels/destination',
    ]);
    const filters = [...block.querySelectorAll<HTMLButtonElement>('.filters-grid-filter')];
    expect(filters.map((button) => button.textContent)).toEqual(['Bangkok Title', 'Hanoi Title']);
    expect(block.querySelector('.filters-grid-card-title')?.textContent).toBe('Bangkok Experience');

    filters[1]?.click();
    expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No matching results.');
    expect(block.querySelectorAll('.filters-grid-filter')).toHaveLength(2);

    block.querySelector<HTMLButtonElement>('[data-mode-key="experience"]')?.click();
    expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Local Culture');
    expect(block.querySelector('.filters-grid-card-title')?.textContent).toBe('Bangkok Experience');
  });

  it('skips an empty root without deriving filters from cards', async () => {
    const block = createBlock('');
    await decorate(block);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    block.querySelector<HTMLButtonElement>('[data-mode-key="experience"]')?.click();
    expect(block.querySelectorAll('.filters-grid-filter')).toHaveLength(0);
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(0);
  });

  it('shows the existing error state when the child tags request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { filterGridCardDetailsList: { items: [] } } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 });
    const block = createBlock();
    await decorate(block);
    expect(block.querySelector('[role="alert"]')?.textContent).toBe('Child tags request failed with status 503');
    expect(block.hasAttribute('aria-busy')).toBe(false);
  });

  function createDynamicBlock(
    defaultMode: string,
    modes: Array<[string, string, boolean?]>,
    includeLegacyDefault = true,
  ): HTMLElement {
    const block = document.createElement('div');
    const values = ['dynamic-grid', 'filters-grid', 'white', 'Discover', 'Experiences', '/content/dam/cards'];
    if (includeLegacyDefault) values.push(defaultMode);
    values.forEach((value) => {
      const row = document.createElement('div');
      const cell = document.createElement('div');
      cell.textContent = value;
      row.append(cell);
      block.append(row);
    });
    const modesRow = document.createElement('div');
    const modesCell = document.createElement('div');
    const list = document.createElement('ul');
    modes.forEach(([label, rootTag, isDefault]) => {
      const item = document.createElement('li');
      [label, rootTag].forEach((value) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = value;
        item.append(paragraph);
      });
      if (isDefault !== undefined) {
        const flag = document.createElement('p');
        flag.textContent = String(isDefault);
        item.append(flag);
      }
      list.append(item);
    });
    modesCell.append(list);
    modesRow.append(modesCell);
    const revealRow = document.createElement('div');
    revealRow.innerHTML = '<div>Show More</div>';
    block.append(modesRow, revealRow);
    document.body.append(block);
    return block;
  }

  it.each([
    [false, true, 'Destination'],
    [true, false, 'Experience'],
    [false, false, 'Experience'],
    [true, true, 'Experience'],
  ])(
    'reads AEM separator-delimited modes with flags %s and %s',
    async (experienceDefault, destinationDefault, expectedDefault) => {
      const block = createDynamicBlock('', [], false);
      const modesCell = block.children[6]!.firstElementChild!;
      modesCell.innerHTML = `
        <hr>
        <p>Experience</p>
        <ul><li>capella-hotels:experience</li></ul>
        <p>${experienceDefault}</p>
        <hr>
        <p>Destination</p>
        <ul><li>capella-hotels:destination</li></ul>
        <p>${destinationDefault}</p>
        <hr>
      `;
      await decorate(block);
      expect(block.querySelectorAll('[role="tab"]')).toHaveLength(2);
      expect(block.querySelector('[role="tab"]')?.textContent).toBe(expectedDefault);
      expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe(expectedDefault);
      expect(block.querySelector('.filters-grid-filter')?.textContent).toBe(
        expectedDefault === 'Destination' ? 'Bangkok Title' : 'Local Culture',
      );
      expect(block.querySelectorAll('[aria-selected="true"]')).toHaveLength(1);
    },
  );

  it.each([0, 1, 2])('parses checkbox-only authoring with %i identity rows', async (identityCount) => {
    const block = createDynamicBlock(
      '',
      [
        ['Experience', 'capella-hotels:experience', false],
        ['Destination', 'capella-hotels:destination', true],
      ],
      false,
    );
    for (let index = identityCount; index < 2; index += 1) block.firstElementChild?.remove();
    await decorate(block);
    expect([...block.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
      'Destination',
      'Experience',
    ]);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
    expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Bangkok Title');
    expect(block.querySelector('.filters-grid-reveal')?.textContent).toBe('Show More');
  });

  it('uses the first checkbox-only mode when none is checked', async () => {
    const block = createDynamicBlock(
      '',
      [
        ['By Interest', 'capella-hotels:interest', false],
        ['By Type', 'capella-hotels:type', false],
      ],
      false,
    );
    await decorate(block);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('By Interest');
  });

  it('uses the checked mode instead of a typed default, even after its label changes', async () => {
    const block = createDynamicBlock('Experience', [
      ['Experience', 'capella-hotels:experience', false],
      ['Renamed Destination', 'capella-hotels:destination', true],
    ]);
    await decorate(block);
    expect([...block.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
      'Renamed Destination',
      'Experience',
    ]);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Renamed Destination');
    expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Bangkok Title');
  });

  it('uses the first mode when all checkboxes are unchecked, ignoring the legacy default', async () => {
    const block = createDynamicBlock('Destination', [
      ['Experience', 'capella-hotels:experience', false],
      ['Destination', 'capella-hotels:destination', false],
    ]);
    await decorate(block);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Experience');
  });

  it('uses the first checked entry when multiple modes are marked default', async () => {
    const block = createDynamicBlock('By Type', [
      ['Experience', 'capella-hotels:experience', false],
      ['Destination', 'capella-hotels:destination', true],
      ['By Type', 'capella-hotels:type', true],
    ]);
    await decorate(block);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
    expect([...block.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
      'Destination',
      'Experience',
      'By Type',
    ]);
  });

  it('reads a checkbox input in editor markup', async () => {
    const block = createDynamicBlock('Experience', [
      ['Experience', 'capella-hotels:experience', false],
      ['Destination', 'capella-hotels:destination'],
    ]);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.aueProp = 'isDefault';
    block.querySelectorAll('li')[1]!.append(checkbox);
    await decorate(block);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
  });

  it('renders four authored modes and initializes a custom label as the default', async () => {
    const block = createDynamicBlock(' BY INTEREST ', [
      ['Experience', 'capella-hotels:experience'],
      ['Destination', 'capella-hotels:destination'],
      ['By Interest', 'capella-hotels:interest'],
      ['By Type', 'capella-hotels:type'],
    ]);
    await decorate(block);
    expect([...block.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
      'By Interest',
      'Experience',
      'Destination',
      'By Type',
    ]);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('By Interest');
    expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Interest Culture');
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(1);
    expect(block.id).toBe('dynamic-grid');
    expect(block.querySelector('.filters-grid-reveal')?.textContent).toBe('Show More');
    expect(fetchMock).toHaveBeenCalledTimes(5);
    block
      .querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('By Type');
    expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Retreats');
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(1);
    block
      .querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('By Interest');
    expect(block.querySelector('[role="tab"]')?.textContent).toBe('By Interest');
  });

  it.each(['capella-hotels:destination', '/content/cq:tags/capella-hotels/destination'])(
    'selects a renamed mode by root tag %s',
    async (defaultMode) => {
      const block = createDynamicBlock(defaultMode, [
        ['By Interest', 'capella-hotels:experience'],
        ['By Place', 'capella-hotels:destination'],
      ]);
      await decorate(block);
      expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('By Place');
      expect([...block.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
        'By Place',
        'By Interest',
      ]);
      expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Bangkok Title');
      expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(1);
    },
  );

  it.each(['', 'unknown mode'])('falls back to the first authored mode for default %s', async (defaultMode) => {
    const block = createDynamicBlock(defaultMode, [['Only Mode', 'capella-hotels:experience']]);
    await decorate(block);
    expect(block.querySelectorAll('[role="tab"]')).toHaveLength(1);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Only Mode');
  });

  it('honors both legacy defaults with identity rows present', async () => {
    for (const defaultMode of ['experience', 'destination']) {
      const block = createBlock();
      block.children[4]!.firstElementChild!.textContent = defaultMode;
      const identity = document.createElement('div');
      identity.innerHTML = '<div>legacy-grid</div>';
      const testId = document.createElement('div');
      testId.innerHTML = '<div>filters-grid</div>';
      block.prepend(identity, testId);
      await decorate(block);
      expect(block.querySelector('[aria-selected="true"]')?.getAttribute('data-mode-key')).toBe(defaultMode);
      expect(block.querySelector('[role="tab"]')?.getAttribute('data-mode-key')).toBe(defaultMode);
      expect(block.id).toBe('legacy-grid');
    }
  });

  it('renders a generic empty state when no modes are authored', async () => {
    const block = createDynamicBlock('', []);
    await decorate(block);
    expect(block.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No matching results.');
  });

  it('does not match a child slug from a different root', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          filterGridCardDetailsList: {
            items: [{ associatedFilterTags: ['capella-hotels:experience/culture'] }],
          },
        },
      }),
    });
    const block = createDynamicBlock('By Interest', [['By Interest', 'capella-hotels:interest']]);
    await decorate(block);
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(0);
    expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No matching results.');
  });

  it.each(['square', 'wide'])('loads visible %s popup images eagerly and reveals them when loaded', async (variant) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          filterGridCardDetailsList: {
            items: [
              {
                cardHeadline: 'Popup Card',
                cardLocationTag: ['capella-hotels:destination/bangkok'],
                cardBackgroundPhoto: { _path: '/card.jpg' },
                cardClickActionBehavior: 'popup',
                modalDetails: {
                  modalImageAspectRatioVariant: variant,
                  modalFeatureImageAsset: { _path: '/feature.jpg' },
                  carouselImages: [{ _path: '/slide-one.jpg' }, { _path: '/slide-two.jpg' }],
                },
              },
            ],
          },
        },
      }),
    });
    const block = createBlock();
    await decorate(block);
    expect(block.querySelector<HTMLImageElement>('.filters-grid-card img')?.loading).toBe('lazy');
    const imageSources = jest.spyOn(HTMLImageElement.prototype, 'src', 'set');
    const trigger = block.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!;
    trigger.focus();
    expect(imageSources).toHaveBeenCalledWith('/feature.jpg');
    if (variant === 'square') expect(imageSources).toHaveBeenCalledWith('/slide-one.jpg');
    trigger.click();
    const modal = document.querySelector<HTMLElement>('.filters-grid-modal')!;
    expect(modal.hidden).toBe(false);
    const media = modal.querySelector<HTMLElement>(
      variant === 'square' ? '.filters-grid-modal-feature' : '.filters-grid-modal-media',
    );
    expect(media?.style.backgroundImage).toContain('/card.jpg');
    const visibleImages = [...modal.querySelectorAll<HTMLImageElement>('img:not([hidden])')];
    expect(visibleImages.length).toBe(variant === 'square' ? 2 : 1);
    visibleImages.forEach((image) => {
      expect(image.loading).toBe('eager');
      image.dispatchEvent(new Event('load'));
      expect(image.classList.contains('is-loaded')).toBe(true);
    });
    modal.querySelector<HTMLButtonElement>('.filters-grid-modal-pagination button:last-child')?.click();
    expect(modal.querySelector<HTMLImageElement>('img[src="/slide-two.jpg"]')?.loading).toBe('eager');
    trigger.click();
    expect(modal.querySelectorAll('.filters-grid-modal-content')).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(modal.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('uses a generic message when the cards response is empty', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { filterGridCardDetailsList: { items: [] } } }),
    });
    const block = createBlock();
    await decorate(block);
    expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No results are available.');
    expect(block.querySelectorAll('.filters-grid-filter')).toHaveLength(2);
  });
});
