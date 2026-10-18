import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packPlan, parseNeed, parseQuantity, parseSize } from '../lib/shared/packs';

const item = (name: string, quantity: string, unit: string) => ({ name, searchTerm: name.toLowerCase(), quantity, unit });

test('quantities and sizes parse', () => {
  assert.equal(parseQuantity('8'), 8);
  assert.equal(parseQuantity('1 1/2'), 1.5);
  assert.equal(parseQuantity('½'), 0.5);
  assert.equal(parseQuantity('2-3'), 3);
  assert.equal(parseQuantity(''), undefined);
  assert.deepEqual(parseSize('1 ct'), { amount: undefined, count: 1 });
  assert.equal(Math.round(parseSize('4 sticks / 16 oz / 2 pk').amount!.value), 907); // 2 lb
  assert.equal(Math.round(parseSize('1 pt').amount!.value), 473);
  assert.equal(parseSize('16 fl oz').amount!.dim, 'volume');
  assert.equal(parseSize('4 ct / 14.5 oz').count, 4);
  assert.deepEqual(parseNeed('2', 'x 400g cans'), { kind: 'count', n: 2, each: { dim: 'mass', value: 800 / 2 } });
});

test('count to count', () => {
  const p = packPlan(item('Red peppers', '2', ''), { size: '1 ct' });
  assert.deepEqual([p.packs, p.confident, p.needLabel, p.packLabel], [2, true, 'Recipe needs 2', undefined]);
  assert.equal(packPlan(item('Eggs', '6', ''), { size: '12 ct' }).packs, 1);
  assert.equal(packPlan(item('Limes', '3', ''), { size: '1 each' }).packs, 3);
});

test('count items sold by weight use a typical weight', () => {
  const chicken = packPlan(item('Boneless skinless chicken breasts', '8', ''), { size: '1 lb' });
  assert.deepEqual([chicken.packs, chicken.confident, chicken.packLabel], [4, true, '≈ 4 × 1 lb']);
  assert.equal(packPlan(item('Onions', '4', ''), { size: '1 lb' }).packs, 2);
  assert.equal(packPlan(item('Onions', '4', ''), { size: '3 lb' }).packs, 1);
  // no typical weight known: keep 1 and show the need
  const unknown = packPlan(item('Dragon fruit', '4', ''), { size: '1 lb' });
  assert.deepEqual([unknown.packs, unknown.confident, unknown.needLabel], [1, false, 'Recipe needs 4']);
});

test('same-dimension units round up to whole packs', () => {
  assert.equal(packPlan(item('Chopped tomatoes', '2', 'x 400g cans'), { size: '14.5 oz' }).packs, 2);
  assert.equal(packPlan(item('Chopped tomatoes', '2', 'x 400g cans'), { size: '28 oz' }).packs, 1);
  assert.equal(packPlan(item('Butter', '25', 'g'), { size: '4 sticks / 16 oz / 2 pk' }).packs, 1);
  assert.equal(packPlan(item('Chicken thighs', '2', 'lb'), { size: '1.5 lb' }).packs, 2);
  assert.equal(packPlan(item('Double cream', '150', 'ml'), { size: '1 pt' }).packs, 1);
  assert.equal(packPlan(item('Milk', '3', 'cups'), { size: '16 fl oz' }).packs, 2);
  const plan = packPlan(item('Stock', '1', 'l'), { size: '32 fl oz' });
  assert.deepEqual([plan.packs, plan.confident], [2, true]);
});

test('small or unclear amounts keep 1', () => {
  const puree = packPlan(item('Tomato purée', '4', 'tbsp'), { size: '28 oz' });
  assert.deepEqual([puree.packs, puree.confident, puree.needLabel], [1, true, undefined]);
  assert.deepEqual(packPlan(item('Fresh coriander', '', ''), { size: '1 ct' }).confident, true);
  assert.equal(packPlan(item('Salt', '1', 'pinch'), {}).packs, 1);
  // 2 cups of yogurt vs a 16 oz tub: weight vs volume, too close to call
  const close = packPlan(item('Yogurt', '2', 'cups'), { size: '16 oz' });
  assert.deepEqual([close.packs, close.confident], [1, false]);
});
