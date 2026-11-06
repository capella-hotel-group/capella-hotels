import decorate, { resolveCardHref, resolvePickerPath } from './filters-grid';

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

jest.mock('@/utils/env.js', () => ({
  getPublishBaseUrl: () => 'https://publish.example.com',
  resolveDAMUrl: (value: string) => value,
}));

describe('filters-grid authored filters', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  it.each([
    ['/content/capella-hotels/global', '/content/capella-hotels/global.html'],
    [
      'https://publish.example.com/content/capella-hotels/global.html?q=1#details',
      '/content/capella-hotels/global.html?q=1#details',
    ],
  ])('retains the AEM page root on author for %s', (value, expected) => {
    jest.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      hostname: 'author-p152536-e1620746.adobeaemcloud.com',
      href: 'https://author-p152536-e1620746.adobeaemcloud.com/content/capella-hotels/test.html',
    });
    expect(resolveCardHref({ directDestinationUrl: { _publishUrl: value } })).toBe(expected);
  });

  it.each([
    ['square', undefined, 1, 0],
    ['square', '', 2, 2],
    ['square', '   ', 1, 0],
    ['wide', undefined, 0, 0],
    ['wide', '', 1, 2],
    ['wide', '   ', 0, 0],
  ])('skips unnamed CTA URLs and counts actual %s slides (%s, %s)', async (variant, label, extraImages, dots) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          filterGridCardDetailsList: {
            items: [
              {
                cardHeadline: 'Optional CTA',
                associatedFilterTags: ['capella-hotels:destination/bangkok'],
                cardClickActionBehavior: 'popup',
                modalDetails: {
                  modalImageAspectRatioVariant: variant,
                  modalFeatureImageAsset: { _path: '/feature.jpg' },
                  carouselImages: Array.from({ length: Number(extraImages) }, (_, index) => ({
                    _path: `/extra-${index}.jpg`,
                  })),
                  modalCtaLabel: label,
                  modalCtaUrlInternal: { _publishUrl: 'http://[invalid-url' },
                },
              },
            ],
          },
        },
      }),
    });
    const block = createItemBlock();
    await decorate(block);
    block.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!.click();
    const modal = document.querySelector('.filters-grid-modal:not([hidden])')!;
    expect(modal).not.toBeNull();
    expect(modal.querySelector('.filters-grid-modal-cta')).toBeNull();
    expect(modal.querySelector('.filters-grid-modal-panel')?.classList.contains('filters-grid-modal-no-cta')).toBe(
      true,
    );
    expect(modal.querySelectorAll('.filters-grid-modal-pagination button')).toHaveLength(Number(dots));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it.each([
    ['/content/capella-hotels/global.html', '/global'],
    ['https://publish-p152536-e1620746.adobeaemcloud.com/content/capella-hotels/global.html', '/global'],
    ['/content/capella-hotels/ar/global.html?offer=stay#details', '/ar/global?offer=stay#details'],
    ['/content/capella-hotels', '/'],
    ['/content/capella-hotels.html', '/'],
    ['/content/capella-hotels-other/global.html', '/content/capella-hotels-other/global.html'],
    [
      'https://main--capella-hotels--capella-hotel-group.aem.live/global',
      'https://main--capella-hotels--capella-hotel-group.aem.live/global',
    ],
    ['', ''],
  ])('maps internal page reference %s to %s', (value, expected) => {
    expect(resolveCardHref({ directDestinationUrl: { _publishUrl: value } })).toBe(expected);
  });

  it('prefers the repository page path and leaves external destinations unchanged', () => {
    expect(
      resolveCardHref({
        directDestinationUrl: {
          _path: '/content/capella-hotels/global',
          _publishUrl: 'https://publish.example.com/other.html',
        },
      }),
    ).toBe('/global');
    expect(
      resolveCardHref({
        directDestinationUrlType: 'external',
        directDestinationExternalUrl: 'https://external.example.com/content/capella-hotels/global.html',
      }),
    ).toBe('https://external.example.com/content/capella-hotels/global.html');
  });

  it.each(['direct', 'popup'])('renders an EDS URL for the %s CTA without rewriting images', async (behavior) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          filterGridCardDetailsList: {
            items: [
              {
                cardHeadline: 'Internal page',
                associatedFilterTags: ['capella-hotels:destination/bangkok'],
                cardClickActionBehavior: behavior,
                directDestinationUrl: {
                  _publishUrl: 'https://publish.example.com/content/capella-hotels/global.html?offer=stay#details',
                },
                cardBackgroundPhoto: { _publishUrl: 'https://publish.example.com/content/dam/photo.jpg' },
                modalDetails: {
                  modalCtaLabel: 'Explore',
                  modalCtaUrlInternal: {
                    _publishUrl: 'https://publish.example.com/content/capella-hotels/global.html?offer=stay#details',
                  },
                  openInNewTab: true,
                },
              },
            ],
          },
        },
      }),
    });
    const block = createItemBlock();
    await decorate(block);
    if (behavior === 'popup') block.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!.click();
    const link =
      behavior === 'popup'
        ? document.querySelector<HTMLAnchorElement>('.filters-grid-modal a')
        : block.querySelector<HTMLAnchorElement>('a[href]');
    expect(link?.getAttribute('href')).toBe('/global?offer=stay#details');
    expect(block.querySelector('img')?.getAttribute('src')).toBe('https://publish.example.com/content/dam/photo.jpg');
    if (behavior === 'popup') {
      expect(link?.target).toBe('_blank');
      expect(link?.rel).toBe('noopener noreferrer');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }
  });

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
      throw new Error(`Unexpected request: ${input}`);
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

  it('requests only cards and clears the loading state when they arrive', async () => {
    const pendingResponses: Array<(response: { ok: boolean; json: () => Promise<unknown> }) => void> = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => pendingResponses.push(resolve)));
    const block = createBlock();
    const decoration = decorate(block);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(block.getAttribute('aria-busy')).toBe('true');
    pendingResponses.forEach((resolve) => {
      resolve({
        ok: true,
        json: async () => ({ data: { filterGridCardDetailsList: { items: [] } } }),
      });
    });
    await decoration;
    expect(block.hasAttribute('aria-busy')).toBe(false);
  });

  it('does not fetch legacy root tags or derive category filters from card tags', async () => {
    const block = createBlock();
    await decorate(block);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(block.querySelectorAll('.filters-grid-filter')).toHaveLength(0);
    expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No matching results.');
    block.querySelector<HTMLButtonElement>('[data-mode-key="experience"]')?.click();
    expect(block.querySelectorAll('.filters-grid-filter')).toHaveLength(0);
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(0);
  });

  it('skips an empty root without deriving filters from cards', async () => {
    const block = createBlock('');
    await decorate(block);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    block.querySelector<HTMLButtonElement>('[data-mode-key="experience"]')?.click();
    expect(block.querySelectorAll('.filters-grid-filter')).toHaveLength(0);
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(0);
  });

  it('shows the error state when the cards request fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const block = createBlock();
    await decorate(block);
    expect(block.querySelector('[role="alert"]')?.textContent).toBe('GraphQL request failed with status 503');
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

  function createConfiguredBlock(
    modes: Array<[string, string]>,
    categories: Array<[string, string, boolean]>,
    showModeLabels = true,
  ): HTMLElement {
    const block = document.createElement('div');
    const rows = ['configured-grid', 'filters-grid', 'Discover', 'Experiences', '/content/dam/cards'];
    rows.forEach((value) => {
      const row = document.createElement('div');
      row.innerHTML = `<div>${value}</div>`;
      block.append(row);
    });

    const modesRow = document.createElement('div');
    const modesList = document.createElement('ul');
    modes.forEach(([label, rootTag]) => {
      const entry = document.createElement('li');
      [label, rootTag].forEach((value) => {
        const field = document.createElement('p');
        field.textContent = value;
        entry.append(field);
      });
      modesList.append(entry);
    });
    modesRow.append(modesList);
    block.append(modesRow);

    const categoriesRow = document.createElement('div');
    const categoriesList = document.createElement('ul');
    categories.forEach(([tag, backgroundColor, isDefault]) => {
      const entry = document.createElement('li');
      [tag, backgroundColor, String(isDefault)].forEach((value) => {
        const field = document.createElement('p');
        field.textContent = value;
        entry.append(field);
      });
      categoriesList.append(entry);
    });
    categoriesRow.append(categoriesList);
    block.append(categoriesRow);

    const showLabelsRow = document.createElement('div');
    showLabelsRow.innerHTML = `<div>${showModeLabels}</div>`;
    block.append(showLabelsRow);
    const revealRow = document.createElement('div');
    revealRow.innerHTML = '<div>Show More</div>';
    block.append(revealRow);
    document.body.append(block);
    return block;
  }

  function createNestedFilterBlock(): HTMLElement {
    const block = document.createElement('div');
    const values = ['nested-grid', 'filters-grid', 'Discover', 'Experiences', '/content/dam/cards', 'true'];
    values.forEach((value, index) => {
      const row = document.createElement('div');
      row.innerHTML = `<div>${value}</div>`;
      if (index === 4) {
        row.firstElementChild!.innerHTML = '<a href="/content/dam/cards.html">Cards</a>';
      }
      block.append(row);
    });

    const modesRow = document.createElement('div');
    modesRow.dataset.aueProp = 'filterModeLabels';
    const modes = document.createElement('ul');
    const addMode = (label: string, rootTag: string, categories: Array<[string, string, boolean]>) => {
      const mode = document.createElement('li');
      const modeLabel = document.createElement('p');
      modeLabel.dataset.aueProp = 'label';
      modeLabel.textContent = label;
      const rootTagField = document.createElement('p');
      rootTagField.dataset.aueProp = 'rootTag';
      rootTagField.innerHTML = `<a href="/content/cq:tags/${rootTag.replace(':', '/')}">${rootTag}</a>`;
      const categoryField = document.createElement('div');
      categoryField.dataset.aueProp = 'categorySettings';
      const categoryList = document.createElement('ul');
      categories.forEach(([tag, backgroundColor, isDefault]) => {
        const category = document.createElement('li');
        const tagField = document.createElement('p');
        tagField.dataset.aueProp = 'categoryTag';
        tagField.innerHTML = `<a href="/content/cq:tags/${tag.replace(':', '/')}">${tag}</a>`;
        const colorField = document.createElement('p');
        colorField.dataset.aueProp = 'backgroundColor';
        colorField.textContent = backgroundColor;
        const defaultField = document.createElement('p');
        defaultField.dataset.aueProp = 'isDefaultCategory';
        defaultField.textContent = String(isDefault);
        category.append(tagField, colorField, defaultField);
        categoryList.append(category);
      });
      categoryField.append(categoryList);
      mode.append(modeLabel, rootTagField, categoryField);
      modes.append(mode);
    };

    addMode('Experience', 'capella-hotels:experience', [['capella-hotels:experience/culture', 'green', false]]);
    addMode('Destination', 'capella-hotels:destination', [['capella-hotels:destination/bangkok', 'blue', true]]);
    modesRow.append(modes);
    block.append(modesRow);
    const revealRow = document.createElement('div');
    revealRow.innerHTML = '<div>Reveal More</div>';
    block.append(revealRow);
    document.body.append(block);
    return block;
  }

  function createItemBlock(instrumented = true, showLabels = true): HTMLElement {
    const block = document.createElement('div');
    block.className = 'filters-grid';
    const values = [
      'item-grid',
      'filters-grid',
      'Discover',
      'Experiences',
      '/content/dam/cards',
      String(showLabels),
      'More',
    ];
    values.forEach((value) => {
      const row = document.createElement('div');
      row.innerHTML = `<div>${value}</div>`;
      block.append(row);
    });
    const modes = [
      [
        'Experience',
        [
          ['capella-hotels:experience/culture', 'green', false],
          ['capella-hotels:experience/nature', 'pink', false],
        ],
      ],
      [
        'Destination',
        [
          ['capella-hotels:destination/hanoi', 'light-brown', false],
          ['capella-hotels:destination/bangkok', 'blue', true],
        ],
      ],
    ] as const;
    modes.forEach(([label, categories], index) => {
      const row = document.createElement('div');
      if (instrumented) {
        row.dataset.aueModel = 'filters-grid-tab';
        row.dataset.aueResource = `urn:aemconnection:/content/grid/item${index}`;
      }
      const labelCell = document.createElement('div');
      labelCell.textContent = label;
      const categoryCell = document.createElement('div');
      if (instrumented) {
        labelCell.dataset.aueProp = 'label';
        categoryCell.dataset.aueProp = 'categorySettings';
      }
      categories.forEach(([tag, color, isDefault]) => {
        const separator = document.createElement('hr');
        const tagList = document.createElement('ul');
        const tagItem = document.createElement('li');
        tagItem.textContent = tag;
        tagList.append(tagItem);
        const colorField = document.createElement('p');
        colorField.textContent = color;
        const defaultField = document.createElement('p');
        defaultField.textContent = String(isDefault);
        categoryCell.append(separator, tagList, colorField, defaultField);
      });
      categoryCell.append(document.createElement('hr'));
      row.append(labelCell, categoryCell);
      block.append(row);
    });
    document.body.append(block);
    return block;
  }

  it.each([true, false])(
    'reads child tab items with instrumentation %s and keeps all authored filters',
    async (instrumented) => {
      const block = createItemBlock(instrumented);
      await decorate(block);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(block.id).toBe('item-grid');
      expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
      expect(
        [...block.querySelectorAll('.filters-grid-mode-item:not(.is-inactive) .filters-grid-filter')].map(
          (filter) => filter.textContent,
        ),
      ).toEqual(['Bangkok', 'Hanoi']);
      expect(block.classList.contains('filters-grid-theme-blue')).toBe(true);
      block.querySelector<HTMLButtonElement>('[data-mode-key="mode-0"]')!.click();
      expect(
        [...block.querySelectorAll('.filters-grid-mode-item:not(.is-inactive) .filters-grid-filter')].map(
          (filter) => filter.textContent,
        ),
      ).toEqual(['Culture', 'Nature']);
      expect(block.querySelector('.filters-grid-card-title')?.textContent).toBe('Bangkok Experience');
      block
        .querySelectorAll<HTMLButtonElement>('.filters-grid-mode-item:not(.is-inactive) .filters-grid-filter')[1]!
        .click();
      expect(block.classList.contains('filters-grid-theme-pink')).toBe(true);
      expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No matching results.');
      if (instrumented) expect(block.querySelectorAll('[data-aue-model="filters-grid-tab"]')).toHaveLength(2);
    },
  );

  it('keeps new empty child items and activates an item selected in Universal Editor', async () => {
    const block = createItemBlock(true, false);
    const item = block.lastElementChild as HTMLElement;
    item.replaceChildren();
    await decorate(block);
    expect(block.contains(item)).toBe(true);
    expect(item.textContent).toContain('Filter Tab 2');
    expect(item.dataset.aueLabel).toBe('Filter Tab 2');
    expect(block.querySelector('[role="tab"]')).toBeNull();
    item.dispatchEvent(new CustomEvent('aue:ui-select', { bubbles: true }));
    expect(item.classList.contains('is-inactive')).toBe(false);
  });

  it.each([0, 1, 2])('reads child-item configuration with %i identity rows', async (identityCount) => {
    const block = createItemBlock(false);
    for (let index = identityCount; index < 2; index += 1) block.firstElementChild!.remove();
    await decorate(block);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
    expect(block.querySelectorAll('.filters-grid-mode-item')).toHaveLength(2);
  });

  it('shows all scoped cards without child items and removes the controls', async () => {
    const block = createItemBlock(false);
    block.lastElementChild!.remove();
    block.lastElementChild!.remove();
    await decorate(block);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(1);
    expect(block.querySelector('.filters-grid-controls')).toBeNull();
  });

  it.each([true, false])('renders a single item with show labels %s', async (showLabels) => {
    const block = createItemBlock(false, showLabels);
    block.lastElementChild!.remove();
    await decorate(block);
    expect(block.querySelector('[role="tab"]')).toBeNull();
    expect(block.querySelector('.filters-grid-mode-label')?.textContent ?? null).toBe(showLabels ? 'Experience' : null);
    expect(block.querySelectorAll('.filters-grid-filter')).toHaveLength(2);
    expect(block.classList.contains('filters-grid-theme-green')).toBe(true);
    expect(block.querySelector('.has-mode-heading') !== null).toBe(showLabels);
  });

  it('retains the item field instrumentation under the correct item resource', async () => {
    const block = createItemBlock();
    const rows = [...block.querySelectorAll('[data-aue-model="filters-grid-tab"]')];
    const labels = rows.map((row) => row.querySelector('[data-aue-prop="label"]'));
    const categories = rows.map((row) => row.querySelector('[data-aue-prop="categorySettings"]'));
    await decorate(block);
    rows.forEach((row, index) => {
      expect(block.contains(row)).toBe(true);
      expect(row.contains(labels[index]!)).toBe(true);
      expect(row.contains(categories[index]!)).toBe(true);
    });
    expect(block.querySelectorAll('[data-aue-prop="label"]')).toHaveLength(2);
    expect(rows.map((row) => row.getAttribute('data-aue-label'))).toEqual(['Experience', 'Destination']);
  });

  it('keeps a newly added category draft without showing a configuration error', async () => {
    const block = createItemBlock();
    const categories = block.lastElementChild!.lastElementChild!;
    categories.insertAdjacentHTML('beforeend', '<p>white</p><p>false</p><hr>');
    await decorate(block);
    expect(block.querySelector('[role="alert"]')).toBeNull();
    expect(block.querySelectorAll('.filters-grid-mode-item:not(.is-inactive) .filters-grid-filter')).toHaveLength(2);
  });

  it('reports multiple tags in one category instead of picking one silently', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const block = createItemBlock();
    block.lastElementChild!.lastElementChild!.innerHTML = `
      <hr><ul><li>capella-hotels:destination/hanoi</li><li>capella-hotels:destination/bangkok</li></ul>
      <p>white</p><p>false</p><hr>
    `;
    await decorate(block);
    expect(block.querySelector('[role="alert"]')?.textContent).toBe('Select only one tag per Category Settings entry.');
    expect(console.error).toHaveBeenCalled();
  });

  it.each([true, false, null, undefined])(
    'reads the card overlay value %s',
    async (CardBackgroundPhotoDarkImageOverlay) => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            filterGridCardDetailsList: {
              items: [
                {
                  cardHeadline: 'Overlay card',
                  associatedFilterTags: ['capella-hotels:destination/bangkok'],
                  CardBackgroundPhotoDarkImageOverlay,
                },
              ],
            },
          },
        }),
      });
      const block = createItemBlock();
      await decorate(block);
      expect(
        block.querySelector('.filters-grid-card-shade')?.classList.contains('filters-grid-card-shade-disabled'),
      ).toBe(CardBackgroundPhotoDarkImageOverlay === false);
    },
  );

  it.each([
    ['square', true],
    ['square', false],
    ['square', null],
    ['square', undefined],
    ['wide', true],
    ['wide', false],
    ['wide', null],
    ['wide', undefined],
  ])('reads the independent %s modal overlay value %s', async (variant, modalFeatureImageDarkImageOverlay) => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          filterGridCardDetailsList: {
            items: [
              {
                cardHeadline: 'Overlay popup',
                associatedFilterTags: ['capella-hotels:destination/bangkok'],
                CardBackgroundPhotoDarkImageOverlay: modalFeatureImageDarkImageOverlay !== false ? false : true,
                cardClickActionBehavior: 'popup',
                modalDetails: {
                  modalImageAspectRatioVariant: variant,
                  modalFeatureImageDarkImageOverlay,
                  modalFeatureImageAsset: { _path: '/feature.jpg' },
                },
              },
            ],
          },
        },
      }),
    });
    const block = createItemBlock();
    await decorate(block);
    block.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!.click();
    const media = document.querySelector(
      variant === 'square' ? '.filters-grid-modal-feature' : '.filters-grid-modal-media',
    )!;
    expect(media.classList.contains('filters-grid-modal-no-overlay')).toBe(modalFeatureImageDarkImageOverlay === false);
    expect(block.querySelector('.filters-grid-card-shade-disabled') !== null).toBe(
      modalFeatureImageDarkImageOverlay !== false,
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it('renders a published item whose empty category cell was omitted', async () => {
    const block = createItemBlock(false);
    block.lastElementChild!.lastElementChild!.remove();
    await decorate(block);
    expect(block.querySelectorAll('[role="tab"]')).toHaveLength(2);
    block.querySelector<HTMLButtonElement>('[data-mode-key="mode-1"]')!.click();
    expect(block.querySelector('.filters-grid-mode-item:not(.is-inactive)')?.textContent).toContain('add categories');
  });

  it.each([true, false])(
    'reads default-first category fields and keeps the first default on top with instrumentation %s',
    async (instrumented) => {
      const block = createItemBlock(instrumented);
      const categories = block.lastElementChild!.lastElementChild!;
      categories.innerHTML = `
        <hr><p>false</p><ul><li>capella-hotels:destination/hanoi</li></ul><p>pink</p>
        <hr><p>true</p><ul><li>capella-hotels:destination/bangkok</li></ul><p>blue</p>
        <hr><p>true</p><ul><li>capella-hotels:destination/singapore</li></ul><p>green</p><hr>
      `;
      await decorate(block);
      const buttons = [...block.querySelectorAll('.filters-grid-mode-item:not(.is-inactive) .filters-grid-filter')];
      expect(buttons.map((button) => button.textContent)).toEqual(['Bangkok', 'Hanoi', 'Singapore']);
      expect(buttons[0]!.getAttribute('aria-pressed')).toBe('true');
      expect(block.classList.contains('filters-grid-theme-blue')).toBe(true);
    },
  );

  it('uses the first authored mode with a default, not the last default selected', async () => {
    const block = createItemBlock();
    const categories = block.querySelector('[data-aue-prop="categorySettings"]')!;
    categories.innerHTML = `
      <hr><p>false</p><ul><li>capella-hotels:experience/culture</li></ul><p>green</p>
      <hr><p>true</p><ul><li>capella-hotels:experience/nature</li></ul><p>pink</p><hr>
    `;
    await decorate(block);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Experience');
    expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Nature');
    expect(block.querySelector('.filters-grid-filter[aria-pressed="true"]')?.textContent).toBe('Nature');
  });

  it.each(['', 'white'])('defaults to white when the selected category colour is %s', async (color) => {
    const block = createItemBlock();
    const categories = block.lastElementChild!.lastElementChild!;
    categories.innerHTML = `
      <hr><p>true</p><ul><li>capella-hotels:destination/bangkok</li></ul><p>${color}</p><hr>
    `;
    await decorate(block);
    expect(block.classList.contains('filters-grid-theme-white')).toBe(true);
  });

  it('reuses cards for UE configuration replacements without waiting for another request', async () => {
    const main = document.createElement('main');
    document.body.append(main);
    let current = createItemBlock();
    current.dataset.aueResource = 'urn:aemconnection:/content/grid';
    main.append(current);
    const authored = current.cloneNode(true) as HTMLElement;
    await decorate(current);

    for (const color of ['green', 'pink', 'white']) {
      const replacement = authored.cloneNode(true) as HTMLElement;
      const categories = replacement.lastElementChild!.lastElementChild!;
      categories.innerHTML = `
        <hr><p>true</p><ul><li>capella-hotels:destination/bangkok</li></ul><p>${color}</p><hr>
      `;
      current.after(replacement);
      await decorate(replacement);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(replacement.classList.contains(`filters-grid-theme-${color}`)).toBe(true);
      expect(replacement.querySelectorAll('.filters-grid-card')).toHaveLength(1);
      current.remove();
      current = replacement;
    }

    const newScope = authored.cloneNode(true) as HTMLElement;
    newScope.children[4]!.firstElementChild!.textContent = '/content/dam/other-cards';
    current.after(newScope);
    await decorate(newScope);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toContain(';path=/content/dam/other-cards');
  });

  it('does not reuse cards between different editor resources or published grids', async () => {
    const main = document.createElement('main');
    document.body.append(main);
    for (const resource of ['urn:aemconnection:/content/grid-a', 'urn:aemconnection:/content/grid-b', '', '']) {
      const block = createItemBlock(false);
      if (resource) block.dataset.aueResource = resource;
      main.append(block);
      await decorate(block);
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('retries failed editor card requests instead of caching an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    const main = document.createElement('main');
    document.body.append(main);
    const block = createItemBlock();
    block.dataset.aueResource = 'urn:aemconnection:/content/grid';
    main.append(block);
    const replacement = block.cloneNode(true) as HTMLElement;
    await decorate(block);
    expect(block.querySelector('[role="alert"]')).not.toBeNull();
    block.after(replacement);
    await decorate(replacement);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(replacement.querySelector('[role="alert"]')).toBeNull();
    expect(replacement.querySelectorAll('.filters-grid-card')).toHaveLength(1);
  });

  it('reveals six more cards and resets the count when switching item filters', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          filterGridCardDetailsList: {
            items: Array.from({ length: 14 }, (_, index) => ({
              cardHeadline: `Card ${index}`,
              associatedFilterTags: ['capella-hotels:experience/culture', 'capella-hotels:experience/nature'],
            })),
          },
        },
      }),
    });
    const block = createItemBlock(false);
    block.lastElementChild!.remove();
    await decorate(block);
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(6);
    block.querySelector<HTMLButtonElement>('.filters-grid-reveal')!.click();
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(12);
    block.querySelector<HTMLButtonElement>('.filters-grid-reveal')!.click();
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(14);
    expect(block.querySelector<HTMLButtonElement>('.filters-grid-reveal')!.hidden).toBe(true);
    block.querySelectorAll<HTMLButtonElement>('.filters-grid-filter')[1]!.click();
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(6);
  });

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
      expect(block.querySelector('.filters-grid-filter')).toBeNull();
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
    expect(block.querySelector('.filters-grid-filter')).toBeNull();
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
    expect(block.querySelector('.filters-grid-filter')).toBeNull();
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
    expect(block.querySelector('.filters-grid-filter')).toBeNull();
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(0);
    expect(block.id).toBe('dynamic-grid');
    expect(block.querySelector('.filters-grid-reveal')?.textContent).toBe('Show More');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    block
      .querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('By Type');
    expect(block.querySelector('.filters-grid-filter')).toBeNull();
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(0);
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
      expect(block.querySelector('.filters-grid-filter')).toBeNull();
      expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(0);
    },
  );

  it.each(['', 'unknown mode'])('falls back to the first authored mode for default %s', async (defaultMode) => {
    const block = createDynamicBlock(defaultMode, [['Only Mode', 'capella-hotels:experience']]);
    await decorate(block);
    expect(block.querySelectorAll('[role="tab"]')).toHaveLength(0);
    expect(block.querySelector('.filters-grid-mode-label')?.textContent).toBe('Only Mode');
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
    expect(block.querySelectorAll('.filters-grid-card')).toHaveLength(1);
    expect(block.querySelector('.filters-grid-filter')).toBeNull();
    expect(block.querySelector('.filters-grid-controls')).toBeNull();
  });

  it('uses the configured default category to select its mode and category colour', async () => {
    const block = createConfiguredBlock(
      [
        ['Experience', 'capella-hotels:experience'],
        ['Destination', 'capella-hotels:destination'],
      ],
      [
        ['capella-hotels:experience/nature', 'Green', false],
        ['/content/cq:tags/capella-hotels/destination/bangkok', 'Dark brown', true],
      ],
    );
    await decorate(block);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
    expect(block.querySelector('.filters-grid-filter[aria-pressed="true"]')?.textContent).toBe('Bangkok');
    expect(block.classList.contains('filters-grid-theme-dark-brown')).toBe(true);
    block.querySelector<HTMLButtonElement>('[data-mode-key="mode-0"]')!.click();
    expect(block.classList.contains('filters-grid-theme-green')).toBe(true);
  });

  it('uses authored nested categories per mode without requesting child tags', async () => {
    const block = createNestedFilterBlock();
    await decorate(block);

    const tagRequests = fetchMock.mock.calls
      .map(([input]) => new URL(input as string))
      .filter((url) => url.pathname === '/content/servlet.childtags.json');
    expect(tagRequests).toHaveLength(0);
    expect(block.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
    expect(block.querySelector('.filters-grid-filter[aria-pressed="true"]')?.textContent).toBe('Bangkok');
    expect(block.classList.contains('filters-grid-theme-blue')).toBe(true);

    block.querySelector<HTMLButtonElement>('[data-mode-key="mode-0"]')?.click();
    expect(block.querySelector('.filters-grid-filter')?.textContent).toBe('Culture');
    expect(block.classList.contains('filters-grid-theme-green')).toBe(true);
    expect(block.querySelector('.filters-grid-card-title')?.textContent).toBe('Bangkok Experience');
  });

  it('parses nested categories from published markup without editor instrumentation', async () => {
    const block = createNestedFilterBlock();
    block.querySelectorAll('[data-aue-prop]').forEach((field) => field.removeAttribute('data-aue-prop'));
    await decorate(block);

    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
    expect(block.querySelector('.filters-grid-filter[aria-pressed="true"]')?.textContent).toBe('Bangkok');
    expect(block.classList.contains('filters-grid-theme-blue')).toBe(true);
    expect(
      fetchMock.mock.calls.some(([input]) => new URL(input as string).pathname === '/content/servlet.childtags.json'),
    ).toBe(false);
  });

  it('uses explicit categories even when no cards match them', async () => {
    const block = createConfiguredBlock(
      [
        ['Experience', 'capella-hotels:experience'],
        ['Destination', 'capella-hotels:destination'],
      ],
      [['capella-hotels:destination/singapore', 'blue', true]],
    );
    await decorate(block);
    expect(block.querySelector('[aria-selected="true"]')?.textContent).toBe('Destination');
    expect(block.querySelector('.filters-grid-filter[aria-pressed="true"]')?.textContent).toBe('Singapore');
    expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No matching results.');
  });

  it('shows a single mode as text and hides all mode labels with the global setting', async () => {
    const visible = createConfiguredBlock([['Experience', 'capella-hotels:experience']], []);
    await decorate(visible);
    expect(visible.querySelector('.filters-grid-mode-label')?.textContent).toBe('Experience');
    expect(visible.querySelector('[role="tab"]')).toBeNull();
    expect(visible.querySelector('.filters-grid-filter')).toBeNull();

    const hidden = createConfiguredBlock(
      [
        ['Experience', 'capella-hotels:experience'],
        ['Destination', 'capella-hotels:destination'],
      ],
      [['capella-hotels:destination/bangkok', 'blue', true]],
      false,
    );
    await decorate(hidden);
    expect(hidden.querySelector('.filters-grid-mode-label, [role="tab"]')).toBeNull();
    expect(hidden.querySelector('.filters-grid-filter')?.textContent).toBe('Bangkok');
    expect(hidden.classList.contains('filters-grid-theme-blue')).toBe(true);
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
    const block = createConfiguredBlock(
      [['By Interest', 'capella-hotels:interest']],
      [['capella-hotels:interest/culture', 'white', false]],
    );
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
    const block = createItemBlock();
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
    const block = createItemBlock();
    await decorate(block);
    expect(block.querySelector('.filters-grid-empty')?.textContent).toBe('No results are available.');
    expect(block.querySelectorAll('.filters-grid-mode-item:not(.is-inactive) .filters-grid-filter')).toHaveLength(2);
  });
});
