jest.mock('@/utils/env.js', () => ({ getPublishBaseUrl: () => 'https://publish.example.com' }));

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

it('uses the authored title, batches sibling lookups, and preserves the tag ID', async () => {
  jest.resetModules();
  const { resolveTagTitle, setTagTitle } = await import('./tag-title');
  const tag = 'capella-hotels:destination/bangkok';
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        { path: '/content/cq:tags/capella-hotels/destination/bangkok', title: 'Bangkok new' },
        { path: '/content/cq:tags/capella-hotels/destination/hanoi', title: 'Hanoi title' },
      ],
    }),
  });
  global.fetch = fetchMock;
  expect(await resolveTagTitle(tag)).toBe('Bangkok new');
  expect(await resolveTagTitle('/content/cq:tags/capella-hotels/destination/hanoi')).toBe('Hanoi title');
  const label = document.createElement('span');
  label.textContent = 'Bangkok';
  setTagTitle(label, tag);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(label.textContent).toBe('Bangkok new');
  expect(tag).toBe('capella-hotels:destination/bangkok');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('retains the current label on unavailable titles and retries failed requests', async () => {
  jest.resetModules();
  const { resolveTagTitle, setTagTitle } = await import('./tag-title');
  const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 });
  global.fetch = fetchMock;
  const label = document.createElement('span');
  label.textContent = 'Bangkok';
  setTagTitle(label, 'capella-hotels:destination/bangkok');
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  expect(label.textContent).toBe('Bangkok');
  expect(await resolveTagTitle('capella-hotels:destination/bangkok')).toBe('');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(await resolveTagTitle('capella-hotels:destination/../invalid')).toBe('');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
