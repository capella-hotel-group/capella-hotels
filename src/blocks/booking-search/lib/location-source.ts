import { getBasePathBasedOnEnv } from '@/utils/env';
import type { Location } from './types';

const QUERY = '/graphql/execute.json/capella-hotels/Booking-locations';

interface RawLocation {
  hotelName?: unknown;
  hotelId?: unknown;
}

function toLocation({ hotelName, hotelId }: RawLocation): Location | null {
  const label = typeof hotelName === 'string' ? hotelName.trim() : '';
  const code = typeof hotelId === 'string' || typeof hotelId === 'number' ? String(hotelId).trim() : '';
  return label && code ? { label, code } : null;
}

/** Loads the hotel list from the Booking Locations Content Fragment; any failure yields an empty list. */
export async function fetchLocations(path: string): Promise<Location[]> {
  const cfPath = path.replace(/\.(?:html|json)$/i, '');
  if (!cfPath) return [];
  try {
    const response = await fetch(`${getBasePathBasedOnEnv()}${QUERY};path=${cfPath}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as {
      data?: { bookingLocationsByPath?: { item?: { locations?: RawLocation[] } | null } };
    };
    const raw = json.data?.bookingLocationsByPath?.item?.locations;
    return Array.isArray(raw) ? raw.map(toLocation).filter((location): location is Location => !!location) : [];
  } catch (error) {
    console.error('[booking-search] Failed to load locations:', cfPath, error);
    return [];
  }
}
