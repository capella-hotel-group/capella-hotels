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

function getTurneoConfig() {
  const get = (name) => document.head.querySelector(`meta[name="${name}"]`)?.content ?? '';
  return {
    baseUrl: get('turneo-api-base-url') || 'https://api.turneo.com/v1',
    apiKey: get('turneo-api-key'),
    dynamicMock: get('turneo-dynamic-mock') || 'false',
  };
}

/**
 * Fetch a list of experiences.
 *
 * @param {object} [params]
 * @returns {Promise<Array>}
 */
export async function fetchExperiences(params) {
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
    throw new Error(
      `Turneo API error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.results;
}

/**
 * @param {string} experienceId
 * @param {string} rateId
 * @param {string} from
 * @param {string} until
 * @returns {Promise<object|null>}
 */
async function fetchRateDetail(experienceId, rateId, from, until) {
  const config = getTurneoConfig();
  const url = new URL(
    `${config.baseUrl}/experiences/${experienceId}/rates/${rateId}`,
  );
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
    // eslint-disable-next-line no-console
    console.error(`[turneo-api] Failed to fetch rate ${rateId}: ${response.status}`);
    return null;
  }

  return response.json();
}

/**
 * Fetch rates for a given experience.
 *
 * @param {object} params
 * @returns {Promise<Array>}
 */
export async function fetchRates(params) {
  const config = getTurneoConfig();

  // Step 1: list all rate IDs
  const listUrl = new URL(
    `${config.baseUrl}/experiences/${params.experienceId}/rates`,
  );
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
    throw new Error(
      `Turneo API error: ${listResponse.status} ${listResponse.statusText}`,
    );
  }

  const listData = await listResponse.json();

  // Extract rate IDs from nested array structure [[["id1"]], [["id2"]]]
  const rateIds = [];
  if (listData.results) {
    listData.results.forEach((group) => {
      group.forEach((inner) => {
        inner.forEach((id) => {
          if (id) rateIds.push(id);
        });
      });
    });
  }

  if (rateIds.length === 0) return [];

  // Step 2: fetch each rate detail in parallel
  const { experienceId, from, until } = params;
  const rateDetails = await Promise.all(
    rateIds.map((rateId) => fetchRateDetail(experienceId, rateId, from, until)),
  );

  return rateDetails.filter((r) => r !== null);
}
