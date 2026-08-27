/**
 * Turneo Experiences API — direct client.
 * Wraps fetch calls to the Turneo API with proper headers.
 *
 * ⚠️  This module calls the Turneo API directly from the browser and requires
 *     an API key. For production use prefer turneo-proxy-api.js (no key needed
 *     on the frontend) or turneo-appbuilder-api.js (App Builder proxy).
 *
 * Configuration is read from <meta> tags on the page:
 *   <meta name="turneo-api-base-url"  content="https://api.turneo.com/v1">
 *   <meta name="turneo-api-key"       content="YOUR_KEY">
 *   <meta name="turneo-dynamic-mock"  content="false">
 */

interface TurneoConfig {
  baseUrl: string;
  apiKey: string;
  dynamicMock: string;
}

function getTurneoConfig(): TurneoConfig {
  const get = (name: string) => document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? '';
  return {
    baseUrl: get('turneo-api-base-url') || 'https://api.turneo.com/v1',
    apiKey: get('turneo-api-key'),
    dynamicMock: get('turneo-dynamic-mock') || 'false',
  };
}

/**
 * Fetch a list of experiences.
 */
export async function fetchExperiences(params?: Record<string, string | undefined>): Promise<unknown[]> {
  const config = getTurneoConfig();
  const url = new URL(`${config.baseUrl}/experiences`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': config.apiKey,
      Prefer: `code=200, dynamic=${config.dynamicMock}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Turneo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results;
}

async function fetchRateDetail(
  experienceId: string,
  rateId: string,
  from: string,
  until: string,
): Promise<unknown | null> {
  const config = getTurneoConfig();
  const url = new URL(`${config.baseUrl}/experiences/${experienceId}/rates/${rateId}`);
  url.searchParams.set('from', from);
  url.searchParams.set('until', until);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': config.apiKey,
      Prefer: 'code=200, dynamic=true',
    },
  });

  if (!response.ok) {
    console.error(`[turneo-api] Failed to fetch rate ${rateId}: ${response.status}`);
    return null;
  }

  return response.json();
}

export interface FetchRatesParams {
  experienceId: string;
  from: string;
  until: string;
}

/**
 * Fetch rates for a given experience.
 */
export async function fetchRates(params: FetchRatesParams): Promise<unknown[]> {
  const config = getTurneoConfig();

  // Step 1: list all rate IDs
  const listUrl = new URL(`${config.baseUrl}/experiences/${params.experienceId}/rates`);
  listUrl.searchParams.set('from', params.from);
  listUrl.searchParams.set('until', params.until);

  const listResponse = await fetch(listUrl.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': config.apiKey,
      Prefer: `code=200, dynamic=${config.dynamicMock}`,
    },
  });

  if (!listResponse.ok) {
    throw new Error(`Turneo API error: ${listResponse.status} ${listResponse.statusText}`);
  }

  const listData = await listResponse.json();

  // Extract rate IDs from nested array structure [[["id1"]], [["id2"]]]
  const rateIds: string[] = [];
  if (listData.results) {
    (listData.results as unknown[][][]).forEach((group) => {
      group.forEach((inner) => {
        inner.forEach((id) => {
          if (id) rateIds.push(String(id));
        });
      });
    });
  }

  if (rateIds.length === 0) return [];

  // Step 2: fetch each rate detail in parallel
  const { experienceId, from, until } = params;
  const rateDetails = await Promise.all(rateIds.map((rateId) => fetchRateDetail(experienceId, rateId, from, until)));

  return rateDetails.filter((r) => r !== null);
}
