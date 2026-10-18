import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateStores, choosePlan, priorityOrder, type StoreOffer } from '../lib/shared/plan';
import { lineCost } from '../lib/shared/price';
import { packPlan } from '../lib/shared/packs';
import demo from '../lib/client/demo-run.json';
import type { Item, ItemResult, Store } from '../lib/shared/types';

type S = { id: string; distanceMi: number; lat: number; lng: number; name: string };
const store = (id: string, distanceMi: number): S => ({ id, distanceMi, lat: 0, lng: 0, name: id });
const A = store('A', 0.5);
const B = store('B', 0.7);
const C = store('C', 1.1);
const D = store('D', 3.0);

/** An offer from item -> price; items not listed aren't at the store. */
const offer = (s: S, costs: Record<string, number>, status: StoreOffer['status'] = 'done'): StoreOffer<S> => ({ store: s, status, costs });
const ITEMS = ['x', 'y', 'z'];
const all = (p: number) => ({ x: p, y: p, z: p });

test('the nearest store with everything wins, even if it is the 2nd nearest', () => {
  const r = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, { x: 1, y: 1 }), offer(B, all(2)), offer(C, all(1))] });
  assert.equal(r.ready, true);
  assert.equal(r.main?.id, 'B');
  assert.equal(r.main?.kind, 'store');
  assert.deepEqual(
    r.oneStop.map((o) => o.id),
    ['B', 'C'],
  );
  assert.equal(r.nearestId, 'B');
  assert.equal(r.cheapestId, 'C');
  assert.deepEqual({ id: r.cheaper?.option.id, saving: r.cheaper?.saving }, { id: 'C', saving: 3 });
});

test('a preferred store with everything beats a nearer one; several preferred follow the shopper order', () => {
  const offers = [offer(A, all(1)), offer(B, all(1)), offer(C, all(1))];
  assert.equal(choosePlan({ itemIds: ITEMS, preferredIds: ['C'], offers }).main?.id, 'C');
  assert.equal(choosePlan({ itemIds: ITEMS, preferredIds: ['C', 'B'], offers }).main?.id, 'C');
  assert.equal(choosePlan({ itemIds: ITEMS, preferredIds: ['B', 'C'], offers }).main?.id, 'B');
  // a preferred store that lacks something doesn't win over a complete one
  const r = choosePlan({ itemIds: ITEMS, preferredIds: ['C'], offers: [offer(A, all(1)), offer(C, { x: 1 })] });
  assert.equal(r.main?.id, 'A');
  assert.equal(r.main?.preferred, false);
});

test('no store has everything: split fills from preferred stores first, then by proximity', () => {
  const offers = [offer(A, { x: 1, y: 1 }), offer(B, { y: 2, z: 2 }), offer(C, { x: 3, z: 3 })];
  const r = choosePlan({ itemIds: ITEMS, preferredIds: [], offers });
  assert.equal(r.main?.kind, 'split');
  assert.deepEqual(r.main?.assign, { x: 'A', y: 'A', z: 'B' });
  assert.equal(r.main?.total, 4);
  assert.equal(r.splitAlternative, false);
  assert.equal(r.cheaper, undefined);

  const p = choosePlan({ itemIds: ITEMS, preferredIds: ['C'], offers });
  assert.deepEqual(p.main?.assign, { x: 'C', y: 'A', z: 'C' });
  assert.deepEqual(
    p.main?.stores.map((s) => s.id),
    ['C', 'A'],
  );
  assert.equal(p.main?.preferred, true);
});

test('the split is offered next to a one-store plan only when it buys something', () => {
  const r = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, { x: 1, y: 1 }), offer(B, all(2))] });
  assert.equal(r.main?.id, 'B');
  assert.equal(r.splitAlternative, true);
  assert.deepEqual(r.split?.assign, { x: 'A', y: 'A', z: 'B' });
  assert.equal(r.split?.total, 4);

  // costs more, starts at a store that isn't preferred and isn't clearly nearer: not worth the extra stop
  const pricier = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, { x: 2, y: 2 }), offer(B, all(1))] });
  assert.equal(pricier.split?.total, 5);
  assert.equal(pricier.splitAlternative, false);
  // ...unless it starts at a preferred store
  const pref = choosePlan({ itemIds: ITEMS, preferredIds: ['A'], offers: [offer(A, { x: 2, y: 2 }), offer(B, all(1))] });
  assert.equal(pref.main?.id, 'B');
  assert.equal(pref.splitAlternative, true);
  // ...or every stop is clearly nearer than the one store
  const near = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, { x: 2, y: 2 }), offer(B, { z: 2 }), offer(D, all(1))] });
  assert.equal(near.main?.id, 'D');
  assert.equal(near.splitAlternative, true);

  const top = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, all(1)), offer(B, { x: 1 })] });
  assert.equal(top.split, undefined);
  assert.equal(top.splitAlternative, false);
});

test('items no store has do not block a one-stop plan', () => {
  const r = choosePlan({ itemIds: [...ITEMS, 'nowhere'], preferredIds: [], offers: [offer(A, all(1)), offer(B, all(1))] });
  assert.deepEqual(r.needed, ITEMS);
  assert.equal(r.main?.id, 'A');
});

test('skips change totals, not who has everything', () => {
  // the caller passes 0 for a skipped item: B still needs to have it to count as "everything"
  const r = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, { x: 1, y: 1 }), offer(B, { x: 2, y: 2, z: 0 })] });
  assert.equal(r.main?.id, 'B');
  assert.equal(r.main?.total, 4);
});

test('not ready while a store is still being searched; errored stores are left out', () => {
  const pending = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, all(1)), offer(B, {}, 'pending')] });
  assert.equal(pending.ready, false);
  assert.equal(pending.main, undefined);

  const r = choosePlan({ itemIds: ITEMS, preferredIds: ['A'], offers: [offer(A, {}, 'error'), offer(B, all(1))] });
  assert.equal(r.main?.id, 'B');
  assert.deepEqual(
    r.priority.map((s) => s.id),
    ['B'],
  );
});

test("the shopper's choice is shown while it is an option; otherwise the default", () => {
  const offers = [offer(A, { x: 1, y: 1 }), offer(B, all(2)), offer(C, all(1))];
  const c = choosePlan({ itemIds: ITEMS, preferredIds: [], offers, choice: 'C' });
  assert.equal(c.shown?.id, 'C');
  assert.equal(c.chosen, true);
  assert.equal(c.cheaper, undefined); // C is the cheapest
  const s = choosePlan({ itemIds: ITEMS, preferredIds: [], offers, choice: 'split' });
  assert.equal(s.shown?.kind, 'split');
  assert.equal(s.cheaper?.option.id, 'C'); // split costs 1+1+2 = 4, C costs 3
  const gone = choosePlan({ itemIds: ITEMS, preferredIds: [], offers, choice: 'A' });
  assert.equal(gone.shown?.id, 'B');
  assert.equal(gone.chosen, false);
});

test('equal totals: no "cheapest" and no note', () => {
  const r = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, all(1)), offer(B, all(1))] });
  assert.equal(r.cheapestId, undefined);
  assert.equal(r.nearestId, 'A');
  assert.equal(r.cheaper, undefined);
  const tiny = choosePlan({ itemIds: ITEMS, preferredIds: [], offers: [offer(A, all(1)), offer(B, all(0.9))] });
  assert.equal(tiny.cheapestId, 'B');
  assert.equal(tiny.cheaper, undefined); // $0.30 is under the note threshold
});

test('priority order and candidate stores', () => {
  assert.deepEqual(
    priorityOrder([C, A, B], ['B']).map((s) => s.id),
    ['B', 'A', 'C'],
  );
  const far = { id: 'F', lat: 47.62 + 0.5, lng: -122.33, name: 'Far' };
  const origin = { lat: 47.62, lng: -122.33 };
  const near = [
    { ...A, lat: 47.62, lng: -122.33 },
    { ...B, lat: 47.62, lng: -122.33 },
  ];
  const c = candidateStores(near, [far, { id: 'A', lat: 1, lng: 1, name: 'A' }], origin);
  assert.deepEqual(
    c.map((s) => s.id),
    ['F', 'A', 'B'],
  );
  assert.equal(c[0].distanceMi, 34.5);
  assert.equal(c[1].lat, 47.62); // the nearby copy (with its API distance) wins over the saved one
  // demo replay: only the recorded stores
  assert.deepEqual(
    candidateStores(near, [far], origin, new Set(['A', 'B'])).map((s) => s.id),
    ['A', 'B'],
  );
});

test('demo replay: QFC Broadway Market is the one-stop main plan, QFC Harvard Market is cheaper', () => {
  const run = demo as unknown as { recipe: { items: Item[] }; stores: { stores: Store[] }; searches: Record<string, { results: ItemResult[] }> };
  const items = run.recipe.items.filter((i) => !i.isPantryStaple);
  const offers = run.stores.stores.map((s) => {
    const costs: Record<string, number> = {};
    for (const r of run.searches[s.id].results) {
      const item = items.find((i) => i.id === r.itemId);
      if (item && r.status === 'found' && r.best) costs[r.itemId] = lineCost(r.best, packPlan(item, r.best).packs) ?? 0;
    }
    return offer({ ...s, name: s.name }, costs);
  });
  const r = choosePlan({ itemIds: items.map((i) => i.id), preferredIds: [], offers });
  assert.equal(r.main?.stores[0].name, 'QFC Broadway Market');
  assert.equal(r.main?.total, 81.23);
  assert.equal(r.cheaper?.option.stores[0].name, 'QFC Harvard Market');
  assert.equal(r.cheaper?.option.total, 74.33);
  assert.equal(r.cheaper?.saving, 6.9);
  // the split (QFC Uptown, then QFC Broadway Market) costs more and means two stops: not offered
  assert.deepEqual(
    r.split?.stores.map((s) => s.name),
    ['QFC Uptown', 'QFC Broadway Market'],
  );
  assert.equal(r.splitAlternative, false);
  // with QFC Uptown preferred, Broadway is still the main plan (Uptown lacks 2 items) and the split is offered
  const u = choosePlan({ itemIds: items.map((i) => i.id), preferredIds: ['70500881'], offers });
  assert.equal(u.main?.stores[0].name, 'QFC Broadway Market');
  assert.equal(u.splitAlternative, true);
});
