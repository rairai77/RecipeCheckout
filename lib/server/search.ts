import type { ItemResult, SearchRequest } from '../shared/types';
import { searchProducts } from './kroger';
import { hasStrictHit, pickBest, scoreCandidates, type Scored } from './match';

export function limiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          }),
      );
      next();
    });
}

export async function searchItemsAtStore(req: SearchRequest): Promise<ItemResult[]> {
  const limit = limiter(6);
  return Promise.all(
    req.items.map(async (item) => {
      const terms = [item.searchTerm, ...item.altTerms].map((t) => t.trim()).filter((t, i, a) => t && a.indexOf(t) === i);
      const attempts: { term: string; scored: Scored[] }[] = [];
      try {
        for (const term of terms.slice(0, 3)) {
          const products = await limit(() => searchProducts(term, req.storeId));
          const scored = scoreCandidates(term, item, products);
          attempts.push({ term, scored });
          // an exact hit means the term works; only spend calls on alternates for loose or no matches
          if (hasStrictHit(scored)) break;
        }
      } catch (err) {
        console.error(`search failed for "${item.searchTerm}" at ${req.storeId}:`, (err as Error).message);
      }
      return pickBest(item.id, attempts, item);
    }),
  );
}
