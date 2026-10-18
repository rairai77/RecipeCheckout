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
  const none = scoreCandidates('xanthan gum', { department: 'baking', avoidWords: [] }, [p('Bubble Gum', { categories: ['Candy'] })]);
  assert.equal(pickBest('i1', [{ term: 'xanthan gum', scored: none }]).status, 'no_match');
});

test('multi-word avoid phrases', () => {
  const products = [p('Patak’s Tikka Masala Simmer Sauce'), p('Patak’s Tikka Masala Curry Paste')];
  const scored = scoreCandidates('tikka masala paste', { department: 'international', avoidWords: ['simmer sauce'] }, products);
  const r = pickBest('i1', [{ term: 'tikka masala paste', scored }]);
  assert.equal(r.best?.description, 'Patak’s Tikka Masala Curry Paste');
  assert.equal(r.candidates.length, 1);
});

test('head-noun match when the exact words are missing, but alternates with exact hits win', () => {
  const white = scoreCandidates('white sugar', { department: 'baking', avoidWords: ['powdered', 'brown'] }, [
    p('Lakanto Classic Monkfruit Sweetener with Allulose - White Sugar Substitute'),
    p('Gatorade Zero Sugar Pink White Blue Sports Drink', { categories: ['Beverages'] }),
    p('Kroger Light Brown Sugar'),
    p('Smart Way Granulated Sugar'),
  ]);
  const r1 = pickBest('i1', [{ term: 'white sugar', scored: white }]);
  assert.equal(r1.best?.description, 'Smart Way Granulated Sugar');
  assert.equal(r1.candidates.length, 1);

  const flour = scoreCandidates('cake flour', { department: 'baking', avoidWords: [] }, [p('Gold Medal All-Purpose Flour'), p('Swans Down Cake Flour')]);
  assert.equal(pickBest('i2', [{ term: 'cake flour', scored: flour }]).best?.description, 'Swans Down Cake Flour');
});
