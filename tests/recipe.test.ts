import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractRecipe, linesFromText } from '../lib/server/recipe';

const fixture = (n: string) => readFileSync(new URL(`./fixtures/${n}.html`, import.meta.url), 'utf8');

test('JSON-LD extraction (plain and @graph)', () => {
  const bbc = extractRecipe(fixture('bbc'))!;
  assert.equal(bbc.method, 'jsonld');
  assert.equal(bbc.title, 'Chicken tikka masala');
  assert.equal(bbc.lines.length, 12);
  assert.ok(bbc.image?.startsWith('https://'));
  assert.equal(extractRecipe(fixture('pinch'))!.lines.length, 9);
  assert.equal(extractRecipe(fixture('tin'))!.lines.length, 30);
});

test('selector fallback', () => {
  const html = `<html><head><title>Soup</title></head><body><ul>
    <li class="wprm-recipe-ingredient">1 onion</li><li class="wprm-recipe-ingredient">2 &amp; 1/2 cups stock</li></ul></body></html>`;
  const r = extractRecipe(html)!;
  assert.equal(r.method, 'selectors');
  assert.deepEqual(r.lines, ['1 onion', '2 & 1/2 cups stock']);
});

test('no recipe returns undefined', () => {
  assert.equal(extractRecipe('<html><body><p>hello</p></body></html>'), undefined);
});

test('pasted text lines', () => {
  assert.deepEqual(linesFromText('Ingredients:\n- 1 onion\n• 2 carrots\n\n3. 1 cup rice'), ['1 onion', '2 carrots', '1 cup rice']);
});
