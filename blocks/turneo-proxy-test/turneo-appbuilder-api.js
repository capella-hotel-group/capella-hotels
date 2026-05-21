/* eslint-disable import/prefer-default-export */
/**
 * Turneo App Builder API service module.
 * Calls the Adobe App Builder runtime which proxies the Turneo API server-side.
 * No API key required on the frontend — authentication is handled internally.
 *
 * Base URL: https://3599957-turneoapp-stage.adobeioruntime.net/api/v1/web/turneo-app/get-experience-data.json
 */

// eslint-disable-next-line max-len
const APP_BUILDER_URL = 'https://3599957-turneoapp-stage.adobeioruntime.net/api/v1/web/turneo-app/get-experience-data.json';

/**
 * Fetch experiences from the App Builder runtime.
 * All params are optional and can be combined freely.
 *
 * @param {{ storeId?: string, country?: string, from?: string, until?: string }} [params]
 * @returns {Promise<Array<{
 *   id: string,
 *   title: string,
 *   description: string,
 *   highlight: string,
 *   image: string,
 *   duration: string,
 *   dateRange: { availableFrom: string|null, from: string, until: string },
 *   address: string,
 *   fullLocation: { city: string, country: string, latitude: number, longitude: number },
 *   included: string[],
 *   minPrice: { amount: number, currency: string, unit: string },
 *   maxPrice: { amount: number, currency: string, unit: string },
 * }>>}
 */
export async function fetchExperiencesViaAppBuilder(params) {
  const url = new URL(APP_BUILDER_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`App Builder API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.body?.results ?? [];
}
