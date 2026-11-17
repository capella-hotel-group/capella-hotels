import { labelFromDocument, resolveTrail } from './labels';

function htmlDoc(head: string): Document {
  const doc = document.implementation.createHTMLDocument('');
  doc.head.innerHTML = head;
  return doc;
}

function page(head: string, ok = true, body = '<main></main>') {
  return { ok, text: async () => `<html><head>${head}</head><body>${body}</body></html>` };
}

describe('labelFromDocument', () => {
  it('prefers the breadcrumb title override', () => {
    const doc = htmlDoc('<meta name="breadcrumbtitle" content="Rooms"><title>Acc</title>');
    expect(labelFromDocument(doc)).toBe('Rooms');
  });

  it('falls back to the document title when the override is blank', () => {
    const doc = htmlDoc('<meta name="breadcrumbtitle" content="  "><title>Accommodation</title>');
    expect(labelFromDocument(doc)).toBe('Accommodation');
  });

  it('ignores a pagetitle meta tag', () => {
    const doc = htmlDoc('<meta name="pagetitle" content="Old"><title>Accommodation</title>');
    expect(labelFromDocument(doc)).toBe('Accommodation');
  });

  it('returns an empty string without any title', () => {
    expect(labelFromDocument(htmlDoc(''))).toBe('');
  });
});

describe('resolveTrail', () => {
  const trail = [
    ['singapore', 'en'],
    ['singapore', 'en', 'accommodation'],
    ['singapore', 'en', 'accommodation', 'colonial-manor'],
  ];

  it('drops failed ancestors and de-slugs an untitled current page', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url === '/singapore/en' ? page('<title>Capella Singapore</title>') : page('', false),
    );

    const crumbs = await resolveTrail(trail, false, htmlDoc(''), fetchMock as unknown as typeof fetch);

    expect(crumbs).toEqual([
      { label: 'Capella Singapore', href: '/singapore/en', current: false },
      { label: 'Colonial Manor', href: '/singapore/en/accommodation/colonial-manor', current: true },
    ]);
  });

  it('drops ancestors whose request throws or which have no title', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url === '/singapore/en') throw new Error('network');
      return page('');
    });

    const crumbs = await resolveTrail(
      trail,
      false,
      htmlDoc('<title>Colonial</title>'),
      fetchMock as unknown as typeof fetch,
    );

    expect(crumbs).toEqual([{ label: 'Colonial', href: '/singapore/en/accommodation/colonial-manor', current: true }]);
  });

  it('drops an ancestor that answers without page content, like an author folder listing', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url === '/singapore/en/accommodation'
        ? page('<title>accommodation</title>', true, '<ul><li>child</li></ul>')
        : page('<title>Singapore</title>'),
    );

    const crumbs = await resolveTrail(
      trail,
      false,
      htmlDoc('<title>Colonial</title>'),
      fetchMock as unknown as typeof fetch,
    );

    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Singapore', 'Colonial']);
  });

  it('requests author URLs in the editor', async () => {
    const fetchMock = jest.fn(async () => page('<title>Root</title>'));

    await resolveTrail(
      [
        ['singapore', 'en'],
        ['singapore', 'en', 'x'],
      ],
      true,
      htmlDoc(''),
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledWith('/content/capella-hotels/singapore/en/home.html', expect.anything());
  });

  it('links the root crumb to the home page when it exists', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url === '/singapore/en/home'
        ? page('<meta name="breadcrumbtitle" content="Singapore"><title>Home</title>')
        : page('<title>en</title>'),
    );

    const crumbs = await resolveTrail(
      trail.slice(0, 1).concat([trail[2]!]),
      false,
      htmlDoc('<title>Colonial</title>'),
      fetchMock as unknown as typeof fetch,
    );

    expect(crumbs[0]).toEqual({ label: 'Singapore', href: '/singapore/en/home', current: false });
  });

  it('requests the home page and the root page at the same time', async () => {
    const fetchMock = jest.fn(() => new Promise(() => {}));

    void resolveTrail(
      [trail[0]!, trail[2]!],
      false,
      htmlDoc('<title>Colonial</title>'),
      fetchMock as unknown as typeof fetch,
    );
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith('/singapore/en/home', expect.anything());
    expect(fetchMock).toHaveBeenCalledWith('/singapore/en', expect.anything());
  });

  it('falls back to the language root when there is no home page', async () => {
    const fetchMock = jest.fn(async (url: string) =>
      url === '/singapore/en' ? page('<title>Sanya</title>') : page('', false),
    );

    const crumbs = await resolveTrail(
      trail.slice(0, 1).concat([trail[2]!]),
      false,
      htmlDoc('<title>Colonial</title>'),
      fetchMock as unknown as typeof fetch,
    );

    expect(crumbs[0]).toEqual({ label: 'Sanya', href: '/singapore/en', current: false });
  });

  it('drops an ancestor whose request does not answer in time', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );

    const pending = resolveTrail(
      trail,
      false,
      htmlDoc('<title>Colonial</title>'),
      fetchMock as unknown as typeof fetch,
    );
    await jest.advanceTimersByTimeAsync(10000);
    const crumbs = await pending;
    jest.useRealTimers();

    expect(crumbs).toEqual([{ label: 'Colonial', href: '/singapore/en/accommodation/colonial-manor', current: true }]);
  });
});
