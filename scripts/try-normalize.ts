// Dev helper: one REAL LLM normalization call on a fixture (uses OR_KEY; use sparingly).
// npx tsx scripts/try-normalize.ts tests/fixtures/bbc.html
import { readFileSync } from 'node:fs';
import { extractRecipe } from '../lib/server/recipe';
import { normalizeIngredients } from '../lib/server/llm';

const r = extractRecipe(readFileSync(process.argv[2], 'utf8'))!;
const t = Date.now();
normalizeIngredients(r.lines).then(({ items, by }) => {
  console.log(`${by} in ${Date.now() - t}ms, ${r.lines.length} lines -> ${items.length} items`);
  for (const i of items) console.log(`${i.isPantryStaple ? '(staple) ' : ''}${i.searchTerm} | alt=${i.altTerms.join(',')} | ${i.department} | avoid=${i.avoidWords.join(',')} | ${i.quantity} ${i.unit} | ${i.name}`);
});
