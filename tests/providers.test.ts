import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickBest, scoreCandidates } from '../lib/server/match';
import { enabledProviders, nearestStoresFrom, providerForStoreId } from '../lib/server/providers';
import { krogerProvider } from '../lib/server/providers/kroger';
import type { GroceryProvider } from '../lib/server/providers/types';
import { isPriceOnly } from '../lib/server/providers/types';
import {
  createWholeFoodsProvider,
  mapWfmProduct,
  parseStorePage,
  splitSize,
  type WfmSearchResult,
} from '../lib/server/providers/wholefoods';
import type { Store } from '../lib/shared/types';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const wfmSearch = JSON.parse(fixture('wfm-search-unsalted-butter.json')) as { results: WfmSearchResult[] };

test('experimental providers are off unless EXPERIMENTAL_PROVIDERS names them', () => {
  assert.deepEqual(enabledProviders({}).map((p) => p.id), ['kroger']);
  assert.deepEqual(enabledProviders({ EXPERIMENTAL_PROVIDERS: '' }).map((p) => p.id), ['kroger']);
  assert.deepEqual(enabledProviders({ EXPERIMENTAL_PROVIDERS: 'walmart' }).map((p) => p.id), ['kroger']);
  assert.deepEqual(enabledProviders({ EXPERIMENTAL_PROVIDERS: ' WholeFoods, wholefoods ' }).map((p) => p.id), ['kroger', 'wholefoods']);
});

test('store ids route to their provider; unknown or disabled ids fall back to Kroger', () => {
  const on = enabledProviders({ EXPERIMENTAL_PROVIDERS: 'wholefoods' });
  const off = enabledProviders({});
  assert.equal(providerForStoreId('70100123', on).id, 'kroger');
  assert.equal(providerForStoreId('wfm_10216', on).id, 'wholefoods');
  assert.equal(providerForStoreId('wfm_10216', off).id, 'kroger');
  assert.equal(krogerProvider.ownsStoreId('wfm_10216'), false);
  // the id must still pass api/search.ts's storeId check
  assert.match('wfm_10216', /^\w{4,12}$/);
});

test('Whole Foods is flagged price-only; Kroger is not', () => {
  const wfm = createWholeFoodsProvider();
  assert.equal(isPriceOnly(wfm), true);
  assert.equal(isPriceOnly(krogerProvider), false);
});

test('splitSize pulls the pack size off a Whole Foods product name', () => {
  assert.deepEqual(splitSize('Organic Unsalted Butter, 8 OZ'), { name: 'Organic Unsalted Butter', size: '8 oz' });
  assert.deepEqual(splitSize('Sea Salt Peanut Butter, 16 OZ'), { name: 'Sea Salt Peanut Butter', size: '16 oz' });
  assert.deepEqual(splitSize('Pistachio Butter'), { name: 'Pistachio Butter' });
});

test('maps saved Whole Foods search results to Products', () => {
  const products = wfmSearch.results.map(mapWfmProduct);
  assert.equal(products.length, 11);
  const nancys = products[0];
  assert.equal(nancys.description, 'Nancys Yogurt Organic Unsalted Butter');
  assert.equal(nancys.size, '8 oz');
  assert.equal(nancys.price, 6.29);
  assert.equal(nancys.aisle, undefined);
  assert.equal(nancys.url, 'https://www.wholefoodsmarket.com/product/nancys-yogurt-organic-unsalted-butter-8-oz-b0d2y59kdg');
  const kerrygold = products.find((p) => p.productId === 'kerrygold-unsalted-butter-sticks-8-oz-b01hxz022a')!;
  assert.equal(kerrygold.description, 'KERRYGOLD Unsalted Butter Sticks');
  assert.equal(kerrygold.price, 5.49);
  assert.equal(kerrygold.promoPrice, 4.88); // the $4.39 Prime price is ignored
  // the brand is not repeated when the name already contains it
  assert.equal(products.find((p) => p.brand === '365 by Whole Foods Market')?.description.startsWith('365 by Whole Foods Market'), true);
});

test('the existing matcher picks a sensible Whole Foods product without aisle or stock data', () => {
  const products = wfmSearch.results.map(mapWfmProduct);
  const scored = scoreCandidates('unsalted butter', { department: 'dairy', avoidWords: ['peanut', 'nut'] }, products);
  const r = pickBest('i1', [{ term: 'unsalted butter', scored }]);
  assert.equal(r.status, 'found');
  assert.match(r.best!.description, /unsalted butter/i);
  assert.doesNotMatch(r.best!.description, /peanut/i);
});

test('parses store code and location from a saved store page', () => {
  const s = parseStorePage(fixture('wfm-store-westlake.html'));
  assert.deepEqual(s, {
    code: '10216',
    slug: 'westlake',
    name: 'Westlake',
    address: '2210 Westlake Ave, Seattle, WA',
    lat: 47.618403,
    lng: -122.338189,
  });
});

test('Whole Foods searchProducts calls the store-scoped endpoint and caches', async () => {
  const calls: string[] = [];
  const fakeFetch = (async (url: URL | string) => {
    calls.push(String(url));
    return new Response(JSON.stringify(wfmSearch), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  const wfm = createWholeFoodsProvider({ fetch: fakeFetch });
  const a = await wfm.searchProducts('unsalted butter', 'wfm_10216', 12);
  const b = await wfm.searchProducts('unsalted butter', 'wfm_10216', 12);
  assert.equal(a.length, 11);
  assert.equal(b, a);
  assert.equal(calls.length, 1);
  const u = new URL(calls[0]);
  assert.equal(u.pathname, '/api/search');
  assert.equal(u.searchParams.get('store'), '10216');
  assert.equal(u.searchParams.get('text'), 'unsalted butter');
  await assert.rejects(wfm.searchProducts('butter', '70100123'));
});

test('Whole Foods search surfaces HTTP failures', async () => {
  const wfm = createWholeFoodsProvider({ fetch: (async () => new Response('nope', { status: 503 })) as typeof fetch });
  await assert.rejects(wfm.searchProducts('milk', 'wfm_10216'), /HTTP 503/);
});

test('store list merges experimental stores by distance and survives their failures', async () => {
  const kStore = (id: string, distanceMi: number): Store => ({ id, chain: 'QFC', name: id, address: '', lat: 0, lng: 0, distanceMi, mapsUrl: '' });
  const kroger: GroceryProvider = { ...krogerProvider, nearestStores: async () => [kStore('70100001', 0.8), kStore('70100002', 2.5)] };
  const wfm = createWholeFoodsProvider();
  // Seattle Center-ish origin: Westlake is ~0.4 mi, Interbay ~2 mi
  const merged = await nearestStoresFrom([kroger, wfm], 47.6205, -122.3493, 2);
  assert.deepEqual(merged.map((s) => s.id), ['wfm_10216', '70100001', 'wfm_10275', '70100002']);
  const broken: GroceryProvider = { ...wfm, nearestStores: async () => Promise.reject(new Error('boom')) };
  const onlyKroger = await nearestStoresFrom([kroger, broken], 47.6205, -122.3493, 2);
  assert.deepEqual(onlyKroger.map((s) => s.id), ['70100001', '70100002']);
  // far from Seattle: no Whole Foods stores in the seed list, Kroger list unchanged
  const far = await nearestStoresFrom([kroger, wfm], 45.52, -122.68, 2);
  assert.deepEqual(far.map((s) => s.id), ['70100001', '70100002']);
});
