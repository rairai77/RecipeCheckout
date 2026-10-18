// Dev helper: run the real Kroger search + matching locally (no LLM).
// npx tsx scripts/try-search.ts 70500887 "chicken thighs" "garlic" ...
import { heuristicNormalize } from '../lib/server/normalize';
import { searchItemsAtStore } from '../lib/server/search';
import { formatAisle } from '../lib/shared/aisleSort';

const [storeId, ...terms] = process.argv.slice(2);
const items = heuristicNormalize(terms);
let retries = 0;
const origErr = console.error;
console.error = (...a: unknown[]) => { retries++; origErr(...a); };
const t = Date.now();
searchItemsAtStore({ storeId, items }).then((results) => {
  for (const r of results) {
    const item = items.find((i) => i.id === r.itemId)!;
    console.log(`${r.status.padEnd(11)} ${item.searchTerm.padEnd(22)} -> ${r.best?.description ?? '-'} | ${formatAisle(r.best?.aisle)} | ${r.best?.stockLevel ?? ''} [${r.termUsed}]`);
  }
  console.log(`${Date.now() - t}ms`);
});
