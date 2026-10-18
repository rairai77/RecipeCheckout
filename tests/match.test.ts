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

test('a pick that only came through an alternate term with an avoid word is labelled a substitute', () => {
  const item = { searchTerm: 'tikka masala paste', department: 'international' as const, avoidWords: ['sauce jar', 'simmer sauce', 'rice'] };
  const primary = scoreCandidates('tikka masala paste', item, [p('Kroger Tikka Masala Seasoned Rice')]);
  const alt = scoreCandidates('tikka masala simmer sauce', item, [p('Patak’s® Tikka Masala Spicy Curry Simmer Sauce')]);
  const r = pickBest('i4', [
    { term: 'tikka masala paste', scored: primary },
    { term: 'tikka masala simmer sauce', scored: alt },
  ], item);
  assert.equal(r.status, 'found'); // not dropped
  assert.equal(r.best?.description, 'Patak’s® Tikka Masala Spicy Curry Simmer Sauce');
  assert.ok(r.substitute, 'should be marked as a substitute');
  assert.equal(r.substitute!.reason, 'simmer sauce instead of tikka masala paste');
});

test('alternate-term picks that are exact for the primary term, and primary-term picks, are not substitutes', () => {
  const cil = { searchTerm: 'cilantro', department: 'produce' as const, avoidWords: ['seeds', 'dried'] };
  const viaAlt = pickBest('i12', [
    { term: 'cilantro', scored: [] },
    { term: 'coriander leaves', scored: scoreCandidates('coriander leaves', cil, [p('Fresh Cilantro Coriander Leaves', { categories: ['Produce'] })]) },
  ], cil);
  assert.equal(viaAlt.best?.description, 'Fresh Cilantro Coriander Leaves');
  assert.equal(viaAlt.substitute, undefined);

  const paste = { searchTerm: 'tikka masala paste', department: 'international' as const, avoidWords: ['simmer sauce'] };
  const direct = pickBest('i4', [{ term: 'tikka masala paste', scored: scoreCandidates('tikka masala paste', paste, [p('Patak’s Tikka Masala Curry Paste')]) }], paste);
  assert.equal(direct.substitute, undefined);
});

test('an alternate-term pick that is not an exact match for the primary term is a substitute', () => {
  const item = { searchTerm: 'double cream', department: 'dairy' as const, avoidWords: ['whipped'] };
  const r = pickBest('i10', [
    { term: 'double cream', scored: [] },
    { term: 'heavy cream', scored: scoreCandidates('heavy cream', item, [p('Kroger Heavy Cream', { categories: ['Dairy'] })]) },
  ], item);
  assert.equal(r.status, 'found');
  assert.equal(r.substitute?.reason, 'heavy cream instead of double cream');
});

test('retailer promo tags are stripped from product names', async () => {
  const { cleanDescription } = await import('../lib/server/kroger');
  assert.equal(cleanDescription('Kroger® Salted Butter Sticks BIG DEAL!'), 'Kroger® Salted Butter Sticks');
  assert.equal(cleanDescription('Kroger® Big Deal! Large White Eggs'), 'Kroger® Large White Eggs');
  assert.equal(cleanDescription('Patak’s® Tikka Masala Simmer Sauce'), 'Patak’s® Tikka Masala Simmer Sauce');
  assert.equal(cleanDescription('Brand New Potatoes'), 'Brand New Potatoes');
});

test('the packing liquid is not the product ("Crushed Tomatoes in Tomato Puree" is not tomato purée)', () => {
  const item = { department: 'pantry' as const, avoidWords: ['sauce', 'ketchup'] };
  const scored = scoreCandidates('tomato puree', item, [p('Kroger® Crushed Peeled Tomatoes in Tomato Puree'), p('Hunt’s Tomato Puree')]);
  assert.equal(scored[0].tier, 1);
  assert.equal(scored[1].tier, 2);
  assert.equal(pickBest('i8', [{ term: 'tomato puree', scored }]).best?.description, 'Hunt’s Tomato Puree');
  const diced = scoreCandidates('diced tomatoes', item, [p('Kroger® Petite Diced Tomatoes in Tomato Juice')]);
  assert.equal(diced[0].tier, 2);
});
