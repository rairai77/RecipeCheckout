// Re-record the store searches of the ?demo=1 replay (lib/client/demo-run.json) with the real Kroger API.
// The recipe part (a real LLM run) is kept as is; only `searches` (and, with --origin, `stores`) are replaced.
// Never edit the results by hand: this script is the only thing that should write them.
//
//   npx tsx scripts/record-demo.ts                         # dry run against the recorded stores
//   npx tsx scripts/record-demo.ts --origin 47.6205,-122.3212,"Seattle (Capitol Hill)"
//   npx tsx scripts/record-demo.ts --write                 # save into lib/client/demo-run.json
//
// Needs KR_ID / KR_SECRET in the environment.
import { readFileSync, writeFileSync } from 'node:fs';
import { nearestStores } from '../lib/server/kroger';
import { searchItemsAtStore } from '../lib/server/search';
import { formatAisle } from '../lib/shared/aisleSort';
import type { ItemResult, RecipeResponse, SearchResponse, StoresResponse } from '../lib/shared/types';

const FILE = new URL('../lib/client/demo-run.json', import.meta.url);
const args = process.argv.slice(2);
const write = args.includes('--write');
const originArg = args[args.indexOf('--origin') + 1];
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;

type Run = { recipe: RecipeResponse; stores: StoresResponse; searches: Record<string, SearchResponse> };
const run = JSON.parse(readFileSync(FILE, 'utf8')) as Run;

// searchItemsAtStore logs (and swallows) Kroger errors; a recording with a failed search would be wrong, so count them.
let failures = 0;
const logError = console.error;
console.error = (...a: unknown[]) => {
  failures++;
  logError(...a);
};

const price = (r: ItemResult) => r.best?.promoPrice ?? r.best?.price ?? 0;

async function main() {
  let stores = run.stores;
  if (args.includes('--origin') && originArg) {
    const [lat, lng, ...label] = originArg.split(',');
    const origin = { lat: Number(lat), lng: Number(lng), label: label.join(',').trim() || 'Seattle' };
    stores = { origin, stores: await nearestStores(origin.lat, origin.lng, 3) };
  }
  console.log(`Origin: ${stores.origin.label}`);
  stores.stores.forEach((s, i) => console.log(`  ${i + 1}. ${s.name} (${s.id}) ${s.distanceMi} mi`));

  const items = run.recipe.items.map(({ id, name, searchTerm, altTerms, department, avoidWords }) => ({ id, name, searchTerm, altTerms, department, avoidWords }));
  const searches: Record<string, SearchResponse> = {};
  for (const s of stores.stores) {
    const t = Date.now();
    const results = await searchItemsAtStore({ storeId: s.id, items });
    searches[s.id] = { storeId: s.id, results, ms: Date.now() - t };
  }

  // Simulate the client: selected (non-staple) items, nearest store first, 'unavailable' moves on.
  let pending = run.recipe.items.filter((i) => !i.isPantryStaple);
  console.log(`\nSelected items: ${pending.length}`);
  let total = 0;
  for (const s of stores.stores) {
    if (!pending.length) {
      console.log(`${s.name}: not needed`);
      continue;
    }
    const byId = new Map(searches[s.id].results.map((r) => [r.itemId, r]));
    const found = pending.filter((i) => byId.get(i.id)?.status === 'found');
    const next = pending.filter((i) => byId.get(i.id)?.status === 'unavailable');
    console.log(`${s.name}: ${found.length} of ${pending.length} found`);
    for (const i of pending) {
      const r = byId.get(i.id)!;
      const tag = r.substitute ? `  [closest match: ${r.substitute.reason}]` : '';
      console.log(`   ${r.status.padEnd(11)} ${i.name.padEnd(34)} -> ${r.best?.description ?? '-'} | ${formatAisle(r.best?.aisle)} | $${price(r).toFixed(2)} | ${r.best?.stockLevel ?? ''}${tag}`);
      if (r.status === 'found') total += price(r);
    }
    pending = next;
  }
  if (pending.length) console.log(`Not found nearby: ${pending.map((i) => i.name).join(', ')}`);
  console.log(`\nEstimated total (1 of each): $${total.toFixed(2)}`);

  if (failures) {
    console.log(`\n${failures} search(es) failed: not saving. Run it again.`);
    process.exit(1);
  }
  const out = { ...run, stores, searches };
  if (outArg) writeFileSync(outArg, JSON.stringify(out, null, 2) + '\n');
  if (write) {
    writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n');
    console.log(`Saved ${FILE.pathname}`);
  }
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
