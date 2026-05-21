/**
 * Turneo Proxy API — frontend client.
 * Calls a server-side proxy that handles Turneo API authentication.
 * No API key required on the browser — credentials stay on the server.
 *
 * Configuration is read from a <meta> tag on the page:
 *   <meta name="turneo-proxy-base-url" content="https://your-proxy.example.com/api/turneo">
 */

function getTurneoProxyConfig() {
  const baseUrl = document.head.querySelector('meta[name="turneo-proxy-base-url"]')?.content ?? '';
  return { baseUrl };
}

// ─── Experiences ─────────────────────────────────────────────────────────────

/**
 * Search experiences via proxy.
 *
 * @param {object} [params]
 * @returns {Promise<Array>}
 */
export async function fetchExperiencesViaProxy(params) {
  const { baseUrl } = getTurneoProxyConfig();
  const url = new URL(`${baseUrl}/experiences`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Turneo Proxy error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.results;
}

// ─── Rates ────────────────────────────────────────────────────────────────────

/**
 * Get rates for an experience via proxy.
 *
 * @param {{ experienceId: string, from: string, until: string }} params
 * @returns {Promise<Array>}
 */
export async function fetchRatesViaProxy(params) {
  const { baseUrl } = getTurneoProxyConfig();
  const url = new URL(`${baseUrl}/experiences/${params.experienceId}/rates`);
  url.searchParams.set('from', params.from);
  url.searchParams.set('until', params.until);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Turneo Proxy error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ─── Availabilities ───────────────────────────────────────────────────────────

/**
 * Get availabilities for an experience via proxy.
 *
 * @param {string} experienceId
 * @param {string} from
 * @param {string} until
 * @returns {Promise<unknown>}
 */
export async function fetchAvailabilitiesViaProxy(experienceId, from, until) {
  const { baseUrl } = getTurneoProxyConfig();
  const url = new URL(`${baseUrl}/experiences/${experienceId}/availabilities`);
  url.searchParams.set('from', from);
  url.searchParams.set('until', until);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Turneo Proxy error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * Create a new order via proxy.
 *
 * @param {{ travelerInformation: object, bookings: Array }} params
 * @returns {Promise<object>}
 */
export async function createOrderViaProxy(params) {
  const { baseUrl } = getTurneoProxyConfig();

  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Turneo Proxy error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Confirm an order via proxy.
 *
 * @param {string} orderId
 * @returns {Promise<object>}
 */
export async function confirmOrderViaProxy(orderId) {
  const { baseUrl } = getTurneoProxyConfig();

  const response = await fetch(`${baseUrl}/orders/${orderId}/confirm`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Turneo Proxy error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Add a booking to an existing order via proxy.
 *
 * @param {string} orderId
 * @param {object} booking
 * @returns {Promise<object>}
 */
export async function addBookingViaProxy(orderId, booking) {
  const { baseUrl } = getTurneoProxyConfig();

  const response = await fetch(`${baseUrl}/orders/${orderId}/add`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(booking),
  });

  if (!response.ok) {
    throw new Error(`Turneo Proxy error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Remove a booking from an order via proxy.
 *
 * @param {string} orderId
 * @param {string} bookingId
 * @returns {Promise<object>}
 */
export async function removeBookingViaProxy(orderId, bookingId) {
  const { baseUrl } = getTurneoProxyConfig();

  const response = await fetch(`${baseUrl}/orders/${orderId}/remove`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bookingId }),
  });

  if (!response.ok) {
    throw new Error(`Turneo Proxy error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
