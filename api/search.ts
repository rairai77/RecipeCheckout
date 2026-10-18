import type { SearchRequest, SearchResponse } from '../lib/shared/types';
import { errorJson, json } from '../lib/server/http';
import { searchItemsAtStore } from '../lib/server/search';

export async function POST(request: Request): Promise<Response> {
  let body: SearchRequest;
  try {
    body = await request.json();
  } catch {
    return errorJson('Invalid JSON body', 400, 'bad_request');
  }
  if (!body?.storeId || !/^\w{4,12}$/.test(body.storeId) || !Array.isArray(body.items)) {
    return errorJson('storeId and items are required', 400, 'bad_request');
  }
  const items = body.items.slice(0, 60).map((it) => ({
    id: String(it.id),
    name: String(it.name ?? ''),
    searchTerm: String(it.searchTerm ?? '').slice(0, 80),
    altTerms: Array.isArray(it.altTerms) ? it.altTerms.map(String).slice(0, 2) : [],
    department: it.department ?? 'other',
    avoidWords: Array.isArray(it.avoidWords) ? it.avoidWords.map(String).slice(0, 10) : [],
  }));
  const start = Date.now();
  try {
    const results = await searchItemsAtStore({ storeId: body.storeId, items });
    return json({ storeId: body.storeId, results, ms: Date.now() - start } satisfies SearchResponse);
  } catch (err) {
    console.error('search error', err);
    return errorJson('Store search failed.', 502, 'kroger');
  }
}
