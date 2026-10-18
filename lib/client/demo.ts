import type { RecipeResponse, SearchRequest, SearchResponse, StoresResponse } from '../shared/types';
import run from './demo-run.json';

// Recorded real run (see README "Demo replay"). Delays roughly match the live app.
const recorded = run as unknown as {
  recipe: RecipeResponse;
  stores: StoresResponse;
  searches: Record<string, SearchResponse>;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The recorded recipe, for "See a sample run" (no wait). */
export function sampleRecipe(): RecipeResponse {
  return recorded.recipe;
}

/** Where the recorded run searched from (its nearest stores are in `stores`). */
export function sampleOrigin(): StoresResponse['origin'] {
  return recorded.stores.origin;
}

export async function fetchRecipe(): Promise<RecipeResponse> {
  await wait(2500);
  return recorded.recipe;
}

export async function fetchStores(): Promise<StoresResponse> {
  await wait(300);
  return recorded.stores;
}

export async function searchStore(req: SearchRequest): Promise<SearchResponse> {
  await wait(1200);
  const rec = recorded.searches[req.storeId];
  const ids = new Set(req.items.map((i) => i.id));
  return { storeId: req.storeId, ms: rec?.ms ?? 0, results: (rec?.results ?? []).filter((r) => ids.has(r.itemId)) };
}
