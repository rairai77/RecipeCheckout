import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicNormalize, parseLine } from '../lib/server/normalize';

test('parseLine splits quantity, unit and name', () => {
  assert.deepEqual(parseLine('2 lb boneless skinless chicken thighs, cut into pieces'), {
    quantity: '2', unit: 'lb', name: 'boneless skinless chicken thighs',
  });
  assert.deepEqual(parseLine('1 1/2 cups (360ml) heavy cream'), { quantity: '1 1/2', unit: 'cups', name: 'heavy cream' });
  assert.equal(parseLine('Salt, to taste').name, 'Salt');
});

test('heuristicNormalize builds search terms and merges duplicates', () => {
  const items = heuristicNormalize([
    '2 lb boneless skinless chicken thighs',
    '3 cloves garlic, minced',
    '1 tsp ground cumin',
    '2 tbsp butter',
    '1 tbsp butter, melted',
    'kosher salt',
    '1/2 cup fresh cilantro, chopped',
  ]);
  const terms = items.map((i) => i.searchTerm);
  assert.deepEqual(terms, ['chicken thighs', 'garlic', 'ground cumin', 'butter', 'kosher salt', 'cilantro']);
  assert.equal(items.find((i) => i.searchTerm === 'butter')!.raw.length, 2);
  assert.equal(items.find((i) => i.searchTerm === 'kosher salt')!.isPantryStaple, true);
  assert.equal(items.find((i) => i.searchTerm === 'chicken thighs')!.department, 'meat');
});
