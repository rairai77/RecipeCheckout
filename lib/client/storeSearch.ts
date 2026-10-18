// Whole-list store searches for /results, remembered for the tab (in memory) so going back to the list and returning,
// or re-rendering with another plan, never searches the same store for the same items twice.
import type { SearchRequest, SearchResponse } from '../shared/types';
import { client, clientMode } from './mock';

const MAX_ENTRIES = 24;
const cache = new Map<string, Promise<SearchResponse>>();

const keyOf = (req: SearchRequest) => `${clientMode()}|${req.storeId}|${JSON.stringify(req.items)}`;

export function searchStoreCached(req: SearchRequest): Promise<SearchResponse> {
  const key = keyOf(req);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = client.searchStore(req);
  cache.set(key, p);
  p.catch(() => cache.delete(key)); // a failed search is retried next time
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return p;
}

/** "Search again": forget everything. */
export function clearSearchCache(): void {
  cache.clear();
}

/** Run `fn` over `items` with at most `limit` running at once (Kroger answers bursts with 403s). */
export async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
