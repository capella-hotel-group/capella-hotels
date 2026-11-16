jest.mock('@/app/scripts.js', () => ({
  LANG_MAP: {},
  VALID_LANG_PRIMARIES: new Set(['en']),
}));

import { labelFromDocument, resolveTrail } from './labels';

function htmlDoc(head: string): Document {
  const doc = document.implementation.createHTMLDocument('');
  doc.head.innerHTML = head;
  return doc;
}

function page(head: string, ok = true) {
  return { ok, text: async () => `<html><head>${head}</head><body></body></html>` };
}

describe('labelFromDocument', () => {
  it('prefers the breadcrumb title override', () => {
    const doc = htmlDoc(
      '<meta name="breadcrumbtitle" content="Rooms"><meta name="pagetitle" content="Accommodation"><title>Acc</title>',
    );
    expect(labelFromDocument(doc)).toBe('Rooms');
  });

  it('falls back to the page title when the override is blank', () => {
    const doc = htmlDoc('<meta name="breadcrumbtitle" content="  "><meta name="pagetitle" content="Accommodation">');
    expect(labelFromDocument(doc)).toBe('Accommodation');
  });

  it('falls back to the document title', () => {
    expect(labelFromDocument(htmlDoc('<title>Acc</title>'))).toBe('Acc');
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
      url === '/singapore/en' ? page('<meta name="pagetitle" content="Capella Singapore">') : page('', false),
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

    expect(fetchMock).toHaveBeenCalledWith('/content/capella-hotels/singapore/en.html');
  });
});
