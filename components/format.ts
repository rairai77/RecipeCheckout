import type { Item, Product } from '../lib/shared/types';

export function qtyLabel(item: Pick<Item, 'quantity' | 'unit'>): string {
  return [item.quantity, item.unit].filter(Boolean).join(' ');
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Price the shopper will actually pay: promo when there is one. */
export function effectivePrice(p?: Product): number | undefined {
  if (!p) return undefined;
  if (p.promoPrice !== undefined && p.promoPrice > 0 && (p.price === undefined || p.promoPrice < p.price)) return p.promoPrice;
  return p.price;
}

export function stockBadge(level?: string): { label: string; tone: 'ok' | 'low' | 'out' } | null {
  switch (level) {
    case 'HIGH':
      return { label: 'In stock', tone: 'ok' };
    case 'LOW':
      return { label: 'Low stock', tone: 'low' };
    case 'TEMPORARILY_OUT_OF_STOCK':
      return { label: 'Out of stock', tone: 'out' };
    default:
      return null;
  }
}
