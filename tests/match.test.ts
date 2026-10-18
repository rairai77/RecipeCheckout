import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickBest, scoreCandidates } from '../lib/server/match';
import type { Product } from '../lib/shared/types';

const p = (description: string, extra: Partial<Product> = {}): Product => ({
  productId: description,
  description,
  categories: ['Baking Goods'],
  price: 3,
  inStore: true,
  stockLevel: 'HIGH',
  aisle: { label: 'AISLE 7', number: '7', isNumbered: true },
  ...extra,
});

test('rejects non-food and avoid words, prefers closest name', () => {
  const products = [
    p('Simple Truth® Lemongrass Clementine Liquid Dish Soap', { categories: ['Cleaning Products', 'Natural & Organic'] }),
    p('Coro Salami Lemongrass', { categories: ['Deli'] }),
    p('Fresh Lemongrass', { categories: ['Produce'] }),
  ];
  const scored = scoreCandidates('lemongrass', { department: 'produce', avoidWords: ['salami'] }, products);
  const r = pickBest('i1', [{ term: 'lemongrass', scored }]);
  assert.equal(r.status, 'found');
  assert.equal(r.best?.description, 'Fresh Lemongrass');
  assert.equal(r.candidates.length, 1);
});

test('out of stock or off-catalog products are unavailable', () => {
  const products = [
    p('McCormick Ground Cumin', { stockLevel: 'TEMPORARILY_OUT_OF_STOCK' }),
    p('Kroger Ground Cumin', { aisle: undefined, inStore: false }),
  ];
  const scored = scoreCandidates('ground cumin', { department: 'spices', avoidWords: [] }, products);
  const r = pickBest('i1', [{ term: 'ground cumin', scored }]);
  assert.equal(r.status, 'unavailable');
});

test('falls through to alternate term attempts', () => {
  const first = scoreCandidates('cornstarch', { department: 'baking', avoidWords: [] }, [p('Argo Corn Starch')]);
  assert.equal(pickBest('i1', [{ term: 'cornstarch', scored: first }]).status, 'found');
  const none = scoreCandidates('xanthan gum', { department: 'baking', avoidWords: [] }, [p('Bubble Gum')]);
  assert.equal(pickBest('i1', [{ term: 'xanthan gum', scored: none }]).status, 'no_match');
});
