import { fetchLocations } from './location-source';

jest.mock('@/utils/env', () => ({ getBasePathBasedOnEnv: () => 'https://example.test' }));

describe('fetchLocations', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const respond = (body: unknown, ok = true): jest.Mock => {
    const fetchMock = jest.fn().mockResolvedValue({ ok, json: async () => body });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  it('requests the persisted query without the rendered .html suffix', async () => {
    const fetchMock = respond({});

    await fetchLocations('/content/dam/capella-hotels/booking-locations/list.html');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/graphql/execute.json/capella-hotels/Booking-locations;path=/content/dam/capella-hotels/booking-locations/list',
      { headers: { Accept: 'application/json' } },
    );
  });

  it('maps hotels in authored order and stringifies numeric Hotel IDs', async () => {
    respond({
      data: {
        bookingLocationsByPath: {
          item: {
            locations: [
              { hotelName: ' Capella Singapore ', hotelId: 75985 },
              { hotelName: 'Capella Shanghai', hotelId: '77645' },
            ],
          },
        },
      },
    });

    await expect(fetchLocations('/content/dam/list')).resolves.toEqual([
      { label: 'Capella Singapore', code: '75985' },
      { label: 'Capella Shanghai', code: '77645' },
    ]);
  });

  it('skips entries missing a name or Hotel ID', async () => {
    respond({
      data: {
        bookingLocationsByPath: {
          item: { locations: [{ hotelName: 'Kyoto' }, { hotelId: 1 }, { hotelName: 'Bangkok', hotelId: 2 }] },
        },
      },
    });

    await expect(fetchLocations('/content/dam/list')).resolves.toEqual([{ label: 'Bangkok', code: '2' }]);
  });

  it('returns an empty list when the request fails or the fragment is missing', async () => {
    respond({}, false);
    await expect(fetchLocations('/content/dam/list')).resolves.toEqual([]);

    respond({ data: { bookingLocationsByPath: { item: null } } });
    await expect(fetchLocations('/content/dam/list')).resolves.toEqual([]);

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    await expect(fetchLocations('/content/dam/list')).resolves.toEqual([]);
  });

  it('does not request anything without a path', async () => {
    const fetchMock = respond({});

    await expect(fetchLocations('')).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
