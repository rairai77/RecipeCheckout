import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheaperOption } from '../lib/shared/cheaper';
import { lineCost } from '../lib/shared/price';
import type { Product } from '../lib/shared/types';

const p = (productId: string, description: string, size: string, price: number, promoPrice?: number): Product => ({
  productId,
  description,
  size,
  price,
  promoPrice,
  categories: ['Dairy'],
  inStore: true,
  stockLevel: 'HIGH',
});
const cream = { name: 'double cream', searchTerm: 'heavy cream', department: 'dairy' as const, avoidWords: [], quantity: '150', unit: 'ml' };

test('an equally good match that is at least $1 and 20% cheaper is offered', () => {
  const horizon = p('1', 'Horizon Organic Heavy Whipping Cream', '1 pt', 7.99);
  const kroger = p('2', 'Kroger Heavy Whipping Cream Pint', '1 pt', 3.49);
  const c = cheaperOption(cream, 'heavy cream', horizon, [horizon, kroger]);
  assert.equal(c?.product.productId, '2');
  assert.equal(c?.saving.toFixed(2), '4.50');
});

test('small savings and worse matches are not offered', () => {
  const a = p('1', 'Horizon Organic Heavy Whipping Cream', '1 pt', 4.49);
  const b = p('2', 'Kroger Heavy Whipping Cream Pint', '1 pt', 3.79); // $0.70: too small
  assert.equal(cheaperOption(cream, 'heavy cream', a, [a, b]), undefined);
  const pricey = p('3', 'Horizon Organic Heavy Whipping Cream', '1 pt', 7.99);
  const loose = p('4', 'Dairy Free Whipped Topping', '1 pt', 2.99); // not a heavy-cream match
  assert.equal(cheaperOption(cream, 'heavy cream', pricey, [pricey, loose]), undefined);
});

test('pack-adjusted: a smaller pack only counts when the pack math says it covers the need', () => {
  const tub = p('1', 'Plain Yogurt Tub', '32 oz', 5.49);
  const cup = p('2', 'Plain Yogurt Cup', '5.3 oz', 0.99);
  const yogurt = { name: 'natural yogurt', searchTerm: 'plain yogurt', department: 'dairy' as const, avoidWords: [], quantity: '2', unit: 'cups' };
  assert.equal(cheaperOption(yogurt, 'plain yogurt', tub, [tub, cup]), undefined);
});

test('"limit 2 at sale price" only discounts two', () => {
  const chicken = p('1', 'Chicken Breast (Limit 2 at sale price)', '1 lb', 7.49, 5.49);
  assert.equal(lineCost(chicken, 4)!.toFixed(2), (2 * 5.49 + 2 * 7.49).toFixed(2));
  assert.equal(lineCost(chicken, 2)!.toFixed(2), (2 * 5.49).toFixed(2));
});
