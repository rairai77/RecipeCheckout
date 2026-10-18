/**
 * Which store (or stores) to shop at, given the whole list searched at several stores. Pure: no React, no I/O, and
 * nothing chain-specific, so stores from other retailers can join later.
 *
 * Priority order: the shopper's preferred stores (in their order), then every other store nearest first.
 *
 * The main plan:
 *   a) the first preferred store that has everything;
 *   b) otherwise the nearest store that has everything;
 *   c) otherwise a split: each item at the first store in priority order that has it.
 * Since every preferred store ranks above every other store, (a) and (b) are both "the first store in priority order
 * that has everything". Next to a one-store plan, the split stays on offer when it saves money, starts at a preferred
 * store, or only uses clearly nearer stores.
 *
 * "Everything" means every item that at least one searched store has: an item no store has can't block a one-stop plan.
 * Whether a store has an item doesn't depend on skips; skips only change the totals (the caller passes 0 for them).
 */
import { haversineMiles } from './haversine';

export interface PlanStore {
  id: string;
  /** miles from the shopper's location */
  distanceMi: number;
}

export interface StoreOffer<S extends PlanStore = PlanStore> {
  store: S;
  status: 'pending' | 'done' | 'error';
  /**
   * What each item this store has adds to the total here (pack-adjusted; 0 when skipped or unpriced).
   * Items the store doesn't have are absent.
   */
  costs: Record<string, number>;
}

export interface PlanOption<S extends PlanStore = PlanStore> {
  /** the store id, or 'split' */
  id: string;
  kind: 'store' | 'split';
  /** stores in shopping order (just one for a one-store plan) */
  stores: S[];
  /** item id -> id of the store it's bought at */
  assign: Record<string, string>;
  total: number;
  /** the (first) store is one of the shopper's preferred stores */
  preferred: boolean;
}

export interface PlanResult<S extends PlanStore = PlanStore> {
  /** false while a store is still being searched (nothing below is final yet) */
  ready: boolean;
  /** stores that were searched successfully, in priority order */
  priority: S[];
  /** items at least one store has */
  needed: string[];
  /** stores that have everything, as one-store options, in priority order */
  oneStop: PlanOption<S>[];
  /** the split plan, when it needs 2 or more stores */
  split?: PlanOption<S>;
  /** the plan the rules pick */
  main?: PlanOption<S>;
  /** the plan to show: the shopper's choice when it is still an option, else `main` */
  shown?: PlanOption<S>;
  /** true when the shown plan is the shopper's own choice rather than the default */
  chosen: boolean;
  /** the split is worth offering next to a one-store main plan */
  splitAlternative: boolean;
  /** with 2+ one-stop options: the cheapest one (only when it is strictly cheapest) and the nearest one */
  cheapestId?: string;
  nearestId?: string;
  /** a one-stop option that costs at least NOTE_MIN_DOLLARS less than the shown plan */
  cheaper?: { option: PlanOption<S>; saving: number };
}

/** Smallest saving worth a "has everything for $X less" note. */
export const NOTE_MIN_DOLLARS = 0.5;
/** A split is offered next to a one-store plan when it saves at least this much... */
export const SPLIT_MIN_SAVING = 1;
/** ...or when every one of its stops is at least this much nearer than the one store. */
export const SPLIT_NEARER_MI = 1;
/** Preferred stores farther than this are still used, but their distance is called out. */
export const FAR_MI = 25;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Preferred stores first (in the shopper's order), then the rest nearest first. Stable for ties. */
export function priorityOrder<S extends PlanStore>(stores: S[], preferredIds: string[]): S[] {
  const rank = (s: S) => {
    const i = preferredIds.indexOf(s.id);
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  return stores
    .map((s, i) => ({ s, i }))
    .sort((a, b) => rank(a.s) - rank(b.s) || a.s.distanceMi - b.s.distanceMi || a.i - b.i)
    .map((x) => x.s);
}

/**
 * The stores to search: the nearest few plus the preferred stores (each once). Preferred stores that aren't among the
 * nearest get their distance from `origin`. `allowedIds` limits preferred stores to a known set (the recorded stores
 * in the demo replay). Returned in priority order.
 */
export function candidateStores<S extends PlanStore & { lat: number; lng: number }>(
  nearest: S[],
  preferred: Omit<S, 'distanceMi'>[],
  origin: { lat: number; lng: number } | undefined,
  allowedIds?: Set<string>,
): S[] {
  const out = [...nearest];
  const seen = new Set(nearest.map((s) => s.id));
  for (const p of preferred) {
    if (seen.has(p.id)) continue;
    if (allowedIds && !allowedIds.has(p.id)) continue;
    if (!origin) continue;
    seen.add(p.id);
    const distanceMi = Math.round(haversineMiles(origin.lat, origin.lng, p.lat, p.lng) * 10) / 10;
    out.push({ ...p, distanceMi } as unknown as S);
  }
  return priorityOrder(
    out,
    preferred.map((p) => p.id),
  );
}

/** Distance label: one decimal, or whole miles once it is far. */
export function milesLabel(mi: number): string {
  return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
}

export function choosePlan<S extends PlanStore>(input: {
  itemIds: string[];
  offers: StoreOffer<S>[];
  preferredIds: string[];
  /** the shopper's manual choice: a store id or 'split' */
  choice?: string | null;
}): PlanResult<S> {
  const { itemIds, offers, preferredIds, choice } = input;
  const ready = offers.every((o) => o.status !== 'pending');
  const done = offers.filter((o) => o.status === 'done');
  const byId = new Map(done.map((o) => [o.store.id, o]));
  const priority = priorityOrder(
    done.map((o) => o.store),
    preferredIds,
  );
  const needed = itemIds.filter((id) => done.some((o) => id in o.costs));
  const isPreferred = (s: S) => preferredIds.includes(s.id);
  const empty: PlanResult<S> = { ready, priority, needed, oneStop: [], chosen: false, splitAlternative: false };
  if (!ready || !needed.length) return empty;

  const totalOf = (assign: Record<string, string>) =>
    round2(Object.entries(assign).reduce((t, [item, store]) => t + (byId.get(store)?.costs[item] ?? 0), 0));

  const oneStop: PlanOption<S>[] = priority
    .filter((s) => needed.every((id) => id in byId.get(s.id)!.costs))
    .map((s) => {
      const assign = Object.fromEntries(needed.map((id) => [id, s.id]));
      return { id: s.id, kind: 'store', stores: [s], assign, total: totalOf(assign), preferred: isPreferred(s) };
    });

  // Split: each item at the first store in priority order that has it.
  const assign: Record<string, string> = {};
  for (const id of needed) assign[id] = priority.find((s) => id in byId.get(s.id)!.costs)!.id;
  const used = priority.filter((s) => Object.values(assign).includes(s.id));
  const split: PlanOption<S> | undefined =
    used.length >= 2 ? { id: 'split', kind: 'split', stores: used, assign, total: totalOf(assign), preferred: isPreferred(used[0]) } : undefined;

  const main = oneStop[0] ?? split;
  // Next to a one-store plan the split always means another stop, so it is only offered when that buys something:
  // it costs at least SPLIT_MIN_SAVING less, it starts at a preferred store, or all its stops are clearly nearer.
  const splitAlternative =
    !!split &&
    main?.kind === 'store' &&
    (split.total <= main.total - SPLIT_MIN_SAVING ||
      split.preferred ||
      Math.max(...split.stores.map((s) => s.distanceMi)) <= main.stores[0].distanceMi - SPLIT_NEARER_MI);
  const options = [...oneStop, ...(splitAlternative ? [split!] : [])];
  const picked = choice ? options.find((o) => o.id === choice) : undefined;
  const shown = picked ?? main;

  let cheapestId: string | undefined;
  let nearestId: string | undefined;
  if (oneStop.length >= 2) {
    const byPrice = [...oneStop].sort((a, b) => a.total - b.total);
    if (byPrice[1].total - byPrice[0].total >= 0.005) cheapestId = byPrice[0].id;
    nearestId = [...oneStop].sort((a, b) => a.stores[0].distanceMi - b.stores[0].distanceMi)[0].id;
  }

  let cheaper: PlanResult<S>['cheaper'];
  if (shown) {
    const best = oneStop.filter((o) => o.id !== shown.id).sort((a, b) => a.total - b.total)[0];
    const saving = best ? round2(shown.total - best.total) : 0;
    if (best && saving >= NOTE_MIN_DOLLARS) cheaper = { option: best, saving };
  }

  return { ready, priority, needed, oneStop, split, main, shown, chosen: !!picked && picked.id !== main?.id, splitAlternative, cheapestId, nearestId, cheaper };
}
