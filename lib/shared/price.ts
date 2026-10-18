import type { Product } from './types';

/** Price the shopper will actually pay for one: the promo price when there is a lower one. */
export function unitPrice(p?: Product): number | undefined {
  if (!p) return undefined;
  if (p.promoPrice !== undefined && p.promoPrice > 0 && (p.price === undefined || p.promoPrice < p.price)) return p.promoPrice;
  return p.price;
}

/** "(Limit 2 at sale price)" in a product name: how many the sale price covers. */
export function saleLimit(p: Product): number | undefined {
  const m = p.description.match(/limit\s+(\d+)/i);
  return m ? Number(m[1]) : undefined;
}

/** Cost of `packs` of a product, honouring a "limit N at sale price" cap (the rest at the regular price). */
export function lineCost(p: Product, packs: number): number | undefined {
  const each = unitPrice(p);
  if (each === undefined) return undefined;
  const limit = saleLimit(p);
  if (limit !== undefined && p.price !== undefined && each < p.price && packs > limit) return each * limit + p.price * (packs - limit);
  return each * packs;
}
