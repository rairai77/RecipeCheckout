import type { ApiError, RecipeResponse, SearchRequest, SearchResponse, StoresResponse } from '../shared/types';

// Same-origin on web. For native builds set EXPO_PUBLIC_API_BASE to the deployed URL.
const BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';

export class ApiCallError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch {
    throw new ApiCallError('Network error, check your connection.', 'network');
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiCallError(`Server error (HTTP ${res.status}).`, 'server', res.status);
  }
  if (!res.ok) {
    const e = json as ApiError;
    throw new ApiCallError(e?.error ?? `Server error (HTTP ${res.status}).`, e?.code, res.status);
  }
  return json as T;
}

/** POST /api/recipe. Error code 'blocked' | 'no_recipe' | 'not_found' | 'network' | 'bad_url' means: offer "paste ingredients instead". */
export function fetchRecipe(input: { url: string } | { text: string }): Promise<RecipeResponse> {
  return call('/api/recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

/** GET /api/stores: nearest (up to 3) Kroger-family stores, nearest first. */
export function fetchStores(loc: { lat: number; lng: number } | { zip: string }): Promise<StoresResponse> {
  const q = 'zip' in loc ? `zip=${encodeURIComponent(loc.zip)}` : `lat=${loc.lat}&lng=${loc.lng}`;
  return call(`/api/stores?${q}`);
}

/** POST /api/search: search the given items at one store. */
export function searchStore(req: SearchRequest): Promise<SearchResponse> {
  return call('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
}
