import type { RecipeResponse, SearchRequest, SearchResponse, StoresResponse } from '../shared/types';
import meta from './demo-meta.json';

// Recorded real run (see README "Demo replay"). Delays roughly match the live app.
// The recording (~150 KB) is loaded on demand so ordinary visitors don't download it;
// demo-meta.json is the small part needed up front. Both are written by scripts/record-demo.ts.
type Recorded = {
  recipe: RecipeResponse;
  stores: StoresResponse;
  searches: Record<string, SearchResponse>;
};

let loading: Promise<Recorded> | undefined;
function recorded(): Promise<Recorded> {
  loading ??= import('./demo-run.json').then((m) => ((m as { default?: unknown }).default ?? m) as Recorded);
  return loading;
}

/** Start downloading the recording (e.g. when the demo flag is on), so the first replay step isn't slower. */
export function preloadDemo(): void {
  recorded().catch(() => {
    loading = undefined;
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The recorded recipe, for "See a sample run" (no artificial wait). */
export async function sampleRecipe(): Promise<RecipeResponse> {
  return (await recorded()).recipe;
}

/** Where the recorded run searched from (its nearest stores are in `stores`). */
export function sampleOrigin(): StoresResponse['origin'] {
  return (meta as { origin: StoresResponse['origin'] }).origin;
}

export async function fetchRecipe(): Promise<RecipeResponse> {
  const [run] = await Promise.all([recorded(), wait(2500)]);
  return run.recipe;
}

export async function fetchStores(): Promise<StoresResponse> {
  const [run] = await Promise.all([recorded(), wait(300)]);
  return run.stores;
}

export async function searchStore(req: SearchRequest): Promise<SearchResponse> {
  const [run] = await Promise.all([recorded(), wait(1200)]);
  const rec = run.searches[req.storeId];
  const ids = new Set(req.items.map((i) => i.id));
  return { storeId: req.storeId, ms: rec?.ms ?? 0, results: (rec?.results ?? []).filter((r) => ids.has(r.itemId)) };
}
