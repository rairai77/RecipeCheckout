/**
 * "Cheaper option" hint: is there a candidate at this store, as good a match as the pick, that costs meaningfully less
 * for what the recipe needs? It never changes the pick; the row only offers the swap.
 *
 * Costs are pack-adjusted: price × packs from the pack math, when that math is confident for both products.
 * Otherwise (e.g. "Recipe needs 2 cups" vs a weighed product) only products of about the same size or larger are
 * compared, price for price, so a tiny pack never looks like a saving.
 */
import { scoreCandidates } from '../server/match';
import { packMagnitude, packPlan } from './packs';
import { lineCost } from './price';
import type { Item, Product } from './types';

export const CHEAPER_MIN_DOLLARS = 1;
export const CHEAPER_MIN_SHARE = 0.2;

export interface CheaperOption {
  product: Product;
  /** dollars saved for the recipe's need */
  saving: number;
}

export function cheaperOption(
  item: Pick<Item, 'name' | 'searchTerm' | 'department' | 'avoidWords'> & Partial<Pick<Item, 'quantity' | 'unit'>>,
  termUsed: string | undefined,
  current: Product,
  candidates: Product[],
): CheaperOption | undefined {
  const terms = [...new Set([item.searchTerm, termUsed].map((t) => t?.trim()).filter((t): t is string => !!t))];
  if (!terms.length) return undefined;
  const tier = (p: Product) => Math.max(...terms.map((t) => scoreCandidates(t, item, [p])[0]?.tier ?? 0));
  const cost = (p: Product) => {
    const plan = packPlan(item, p);
    const total = lineCost(p, plan.packs);
    return total === undefined ? undefined : { total, confident: plan.confident, size: packMagnitude(p.size) };
  };

  const cur = cost(current);
  if (!cur || cur.total <= 0) return undefined;
  const curTier = tier(current);

  let best: CheaperOption | undefined;
  for (const p of candidates) {
    if (p.productId === current.productId) continue;
    const c = cost(p);
    if (!c) continue;
    const comparable = (cur.confident && c.confident) || (!!cur.size && !!c.size && c.size >= cur.size * 0.9);
    if (!comparable) continue;
    const saving = cur.total - c.total;
    if (saving < CHEAPER_MIN_DOLLARS || saving < cur.total * CHEAPER_MIN_SHARE) continue;
    if (tier(p) < curTier) continue;
    if (!best || saving > best.saving) best = { product: p, saving };
  }
  return best;
}
