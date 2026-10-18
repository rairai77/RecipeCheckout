import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildMatchRequest,
  buildPageKindRequest,
  estimateTokens,
  heuristicExtractor,
  parseAisle,
  scrapeProducts,
  verifyAgainstPage,
  type Classifier,
  type Extractor,
  type PageSnapshot,
} from '../lib/server/providers/scrape';

const reader = readFileSync(new URL('./fixtures/wfm-search.reader.md', import.meta.url), 'utf8');
const page: PageSnapshot = { url: 'https://www.wholefoodsmarket.com/search?text=unsalted%20butter', via: 'reader', text: reader };

test('heuristic extractor reads product tiles from saved reader markdown', async () => {
  const items = await heuristicExtractor.extract(page);
  assert.ok(items.length >= 8, `got ${items.length}`);
  assert.deepEqual(items[0], {
    product: '365 by Whole Foods Market 365 Unsalted Butter',
    price: 3.59,
    regularPrice: undefined,
    size: '16oz',
    aisle: undefined,
    inStock: undefined,
    url: 'https://www.wholefoodsmarket.com/grocery/product/365-by-whole-foods-market-unsalted-butter-16-oz-b074vdj7kz',
  });
  const kerrygold = items.find((i) => i.product === 'kerrygold Kerrygold Unsalted Butter')!;
  assert.equal(kerrygold.price, 4.88); // sale price; the "Join Prime ... $4.39" member price is dropped
  assert.equal(kerrygold.regularPrice, 5.49);
  assert.ok(items.every((i) => !/add to cart/i.test(i.product)));
});

test('pipeline: listing pages are extracted, bot walls are not', async () => {
  const listing = await scrapeProducts(page);
  assert.equal(listing.kind, 'product_listing');
  assert.equal(listing.products[0].price, 3.59);
  const kerry = listing.products.find((p) => p.description === 'kerrygold Kerrygold Unsalted Butter')!;
  assert.equal(kerry.price, 5.49);
  assert.equal(kerry.promoPrice, 4.88);

  const wall: PageSnapshot = { url: 'https://www.walmart.com/ip/1', via: 'fetch', text: 'Robot or human? Activate and hold the button to confirm that you’re human.' };
  assert.deepEqual(await scrapeProducts(wall), { kind: 'bot_challenge', products: [] });
});

test('aisle text becomes an Aisle; lettered aisles and sections are not walkable numbers', async () => {
  // synthetic snippet in the shape a store page with locations would have
  const text = ['Barilla Spaghetti, 16 oz $1.99 Aisle 7', 'Kerrygold Butter 8 oz $4.49 aisle: G23', 'Fresh Basil $2.99 Out of stock', 'Organic Milk 64 fl oz $5.49'].join('\n\n');
  const items = await heuristicExtractor.extract({ url: 'https://example.test', via: 'browser', text });
  assert.deepEqual(items.map((i) => i.aisle), ['Aisle 7', 'Aisle G23', undefined, undefined]);
  assert.equal(items[2].inStock, false);
  assert.deepEqual(parseAisle('Aisle 7'), { label: 'AISLE 7', number: '7', isNumbered: true });
  assert.deepEqual(parseAisle('Aisle G23'), { label: 'AISLE G23', isNumbered: false });
  assert.deepEqual(parseAisle('Dairy'), { label: 'DAIRY', isNumbered: false });
});

test('stages are pluggable: a recorded model response replaces the heuristics', async () => {
  // how the real Jev + Claude stages get tested in CI: replay saved responses, never call the APIs
  const recordedJev: Classifier = { classify: async () => ({ answers: { page_kind: { type: 'choice', choice: 'product_listing', confidence: 0.98, probabilities: { product_listing: 0.98 } } } }) };
  const recordedClaude: Extractor = {
    extract: async () => [
      { product: 'Organic Valley Unsalted Butter', size: '16 oz', price: 9.49, inStock: true },
      // a hallucinated aisle and price: neither appears on the page, so the guard drops them
      { product: 'Horizon Organic Unsalted Organic Butter', size: '16 oz', price: 8.99, aisle: 'Aisle 12' },
    ],
  };
  const r = await scrapeProducts(page, { classifier: recordedJev, extractor: recordedClaude });
  assert.equal(r.products.length, 2);
  assert.equal(r.products[0].price, 9.49);
  assert.equal(r.products[0].inStore, true);
  assert.equal(r.products[1].price, undefined);
  assert.equal(r.products[1].aisle, undefined);

  const withAisle = { ...page, text: 'Barilla Spaghetti, 16 oz $1.99 Aisle 7' };
  const kept = verifyAgainstPage([{ product: 'Barilla Spaghetti', price: 1.99, aisle: 'Aisle 7' }, { product: 'x', price: 2, aisle: 'Aisle 9' }], withAisle.text);
  assert.deepEqual(kept.map((k) => [k.price, k.aisle]), [[1.99, 'Aisle 7'], [undefined, undefined]]);
});

test('Jev request bodies stay within its documented limits', async () => {
  const kind = buildPageKindRequest(page);
  assert.equal(kind.questions.page_kind.type, 'choice');
  assert.ok(estimateTokens(JSON.stringify(kind)) < 32_000);

  const items = await heuristicExtractor.extract(page);
  const match = buildMatchRequest({ name: 'Unsalted butter', searchTerm: 'unsalted butter', avoidWords: ['peanut'] }, items);
  const best = match.questions.best;
  assert.equal(best.type, 'choice');
  if (best.type === 'choice') {
    assert.ok(Object.keys(best.criteria).length <= 255);
    assert.equal(best.criteria.c0, '365 by Whole Foods Market 365 Unsalted Butter | 16oz | $3.59');
  }
  assert.equal(match.questions.department.type, 'choice');
  assert.ok(Object.keys(match.questions).some((k) => k.startsWith('in_stock_')));
});
