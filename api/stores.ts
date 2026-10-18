import type { StoresResponse } from '../lib/shared/types';
import { errorJson, json } from '../lib/server/http';
import { nearestStores } from '../lib/server/providers';

const zipCache = new Map<string, { lat: number; lng: number; label: string }>();

async function geocodeZip(zip: string) {
  const cached = zipCache.get(zip);
  if (cached) return cached;
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return undefined;
  const j = (await res.json()) as any;
  const place = j?.places?.[0];
  if (!place) return undefined;
  const out = { lat: Number(place.latitude), lng: Number(place.longitude), label: `${place['place name']}, ${place['state abbreviation']} ${zip}` };
  zipCache.set(zip, out);
  return out;
}

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  let origin: StoresResponse['origin'];
  const zip = q.get('zip')?.trim();
  if (zip) {
    if (!/^\d{5}$/.test(zip)) return errorJson('Enter a 5-digit US ZIP code.', 400, 'bad_zip');
    const g = await geocodeZip(zip).catch(() => undefined);
    if (!g) return errorJson(`Couldn't find ZIP code ${zip}.`, 404, 'bad_zip');
    origin = g;
  } else {
    const lat = Number(q.get('lat'));
    const lng = Number(q.get('lng'));
    if (!q.get('lat') || !q.get('lng') || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return errorJson('Provide lat & lng or zip.', 400, 'bad_location');
    }
    origin = { lat, lng, label: q.get('label') || 'Your location' };
  }
  try {
    const stores = await nearestStores(origin.lat, origin.lng, 3);
    if (stores.length === 0) {
      return errorJson('No QFC, Fred Meyer or other Kroger stores within 30 miles.', 404, 'no_stores');
    }
    return json({ origin, stores } satisfies StoresResponse);
  } catch (err) {
    console.error('stores error', err);
    return errorJson('Store lookup failed.', 502, 'kroger');
  }
}
