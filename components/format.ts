import { formatAisle } from '../lib/shared/aisleSort';
import { unitPrice } from '../lib/shared/price';
import type { Aisle, Item, Product } from '../lib/shared/types';

export function qtyLabel(item: Pick<Item, 'quantity' | 'unit'>): string {
  return [item.quantity, item.unit].map((s) => s?.trim()).filter(Boolean).join(' ');
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Price the shopper will actually pay: promo when there is one. */
export function effectivePrice(p?: Product): number | undefined {
  return unitPrice(p);
}

export type StockTone = 'ok' | 'low' | 'out' | 'neutral';

/** Stock badge from what the store's data supports. With no stock level but a shelf location (or in-store flag),
 *  the store lists it here, so say "Carried here" rather than leaving a blank. */
export function stockBadge(p: Pick<Product, 'stockLevel' | 'inStore' | 'aisle'>): { label: string; tone: StockTone } | null {
  switch (p.stockLevel) {
    case 'HIGH':
      return { label: 'In stock', tone: 'ok' };
    case 'LOW':
      return { label: 'Low stock', tone: 'low' };
    case 'TEMPORARILY_OUT_OF_STOCK':
      return { label: 'Out of stock', tone: 'out' };
    default:
      return p.inStore || p.aisle ? { label: 'Carried here', tone: 'neutral' } : null;
  }
}

const DEPT: Record<string, { emoji: string; tint: string }> = {
  produce: { emoji: '🥕', tint: '#E6F2E4' },
  meat: { emoji: '🥩', tint: '#FBE6E2' },
  seafood: { emoji: '🐟', tint: '#E3EEF8' },
  dairy: { emoji: '🧈', tint: '#FFF4D9' },
  eggs: { emoji: '🥚', tint: '#FBF1E1' },
  bakery: { emoji: '🥖', tint: '#F8ECDD' },
  spices: { emoji: '🌶️', tint: '#FCE8E1' },
  baking: { emoji: '🧁', tint: '#F9E8EF' },
  pantry: { emoji: '🥫', tint: '#F6ECE2' },
  condiments: { emoji: '🫙', tint: '#F3EEDF' },
  international: { emoji: '🍛', tint: '#E4F0EE' },
  frozen: { emoji: '🧊', tint: '#E2F3F8' },
  beverages: { emoji: '🧃', tint: '#EEF5DF' },
  deli: { emoji: '🥪', tint: '#F8EEDF' },
  other: { emoji: '🛒', tint: '#EFEBE3' },
};

export function deptStyle(department: string): { emoji: string; tint: string } {
  return DEPT[department] ?? DEPT.other;
}

// Specific ingredients get their own emoji instead of the department's (onions aren't leafy greens).
const ITEM_EMOJI: [RegExp, string][] = [
  [/curry|tikka|masala|garam/i, '🍛'],
  [/\bonions?\b|shallots?|scallions?|leeks?/i, '🧅'],
  [/\bgarlic\b/i, '🧄'],
  [/bell peppers?|\b(red|green|yellow|orange) peppers?\b/i, '🫑'],
  [/chil(?:i|e|li)e?s?\b|jalape|serrano|habanero/i, '🌶️'],
  [/tomato(es)?\b(?!.*(paste|pur[eé]e|sauce))/i, '🍅'],
  [/potato(es)?/i, '🥔'],
  [/carrots?/i, '🥕'],
  [/lemons?|limes?/i, '🍋'],
  [/mushrooms?/i, '🍄'],
  [/cilantro|coriander|parsley|basil|mint|dill|herbs?\b|thyme|rosemary/i, '🌿'],
  [/spinach|lettuce|kale|cabbage|greens\b|arugula|chard/i, '🥬'],
  [/ginger/i, '🫚'],
  [/avocados?/i, '🥑'],
  [/cucumbers?/i, '🥒'],
  [/broccoli/i, '🥦'],
  [/corn\b/i, '🌽'],
  [/chicken|turkey/i, '🍗'],
  [/bacon/i, '🥓'],
  [/beef|steak|pork|lamb|mince/i, '🥩'],
  [/shrimp|prawns?/i, '🍤'],
  [/salmon|fish|cod|tuna/i, '🐟'],
  [/eggs?\b/i, '🥚'],
  [/cheese|parmesan|cheddar|mozzarella|feta/i, '🧀'],
  [/milk|cream\b|yogh?urt/i, '🥛'],
  [/butter/i, '🧈'],
  [/rice\b/i, '🍚'],
  [/pasta|spaghetti|noodles?|penne|linguine/i, '🍝'],
  [/bread|baguette|buns?\b|tortillas?/i, '🍞'],
  [/chutney|jam\b|honey|paste|pur[eé]e/i, '🫙'],
  [/olive oil/i, '🫒'],
];

/** Emoji for an ingredient: a specific one when the name says what it is, else the department's. */
export function itemStyle(item: Pick<Item, 'name' | 'department'>): { emoji: string; tint: string } {
  const d = deptStyle(item.department);
  const hit = ITEM_EMOJI.find(([re]) => re.test(item.name));
  return hit ? { ...d, emoji: hit[1] } : d;
}

export type SectionLook = { emoji: string; bg: string; fg: string; short?: string };

/** Store sections (non-numbered aisles) get an icon and color so they read like store signage. */
export function sectionLook(label: string): SectionLook {
  const l = label.toUpperCase();
  if (/VEG|PRODUCE|FRUIT|SALAD|HERB/.test(l)) return { emoji: '🥬', bg: '#E3F1E4', fg: '#1E6B3A', short: 'Produce' };
  if (/MEAT|POULTRY|BUTCHER/.test(l)) return { emoji: '🥩', bg: '#FBE4E1', fg: '#9F2A1C', short: 'Meat' };
  if (/SEAFOOD|FISH/.test(l)) return { emoji: '🐟', bg: '#E2EEF8', fg: '#1C5486', short: 'Seafood' };
  if (/DAIRY|MILK|CHEESE|EGG/.test(l)) return { emoji: '🧀', bg: '#FFF2CF', fg: '#795300', short: 'Dairy' };
  if (/DELI|BAKE|BREAD/.test(l)) return { emoji: '🥖', bg: '#F8EADA', fg: '#7A4A1C', short: 'Deli' };
  if (/FROZEN/.test(l)) return { emoji: '🧊', bg: '#E0F2F8', fg: '#14607A', short: 'Frozen' };
  if (/FLORAL/.test(l)) return { emoji: '💐', bg: '#F9E6EE', fg: '#8A2D55', short: 'Floral' };
  if (/WINE|BEER|LIQUOR/.test(l)) return { emoji: '🍷', bg: '#F5E3EA', fg: '#7A1F3D', short: 'Wine' };
  if (/WALL|END|CAP/.test(l)) return { emoji: '🧱', bg: '#EFEAE2', fg: '#5E5446', short: 'Back wall' };
  return { emoji: '🛒', bg: '#EFEAE2', fg: '#4E5A50' };
}

/** The aisle as the screen names it, for accessible names: "Produce", "Meat", "Aisle 1, left side, shelf 4". */
export function aisleSpoken(aisle?: Aisle): string {
  if (!aisle) return 'Aisle unknown';
  const name = aisle.isNumbered && aisle.number ? `Aisle ${aisle.number}` : (sectionLook(aisle.label).short ?? formatAisle(aisle));
  const side = sideWord(aisle.side);
  return [name, side ? `${side.toLowerCase()} side` : '', aisle.shelf ? `shelf ${aisle.shelf}` : ''].filter(Boolean).join(', ');
}

export function sideWord(side?: string): string | undefined {
  if (!side) return undefined;
  return side === 'L' ? 'Left' : side === 'R' ? 'Right' : side;
}

/** "Right side · shelf 2" style detail for under the product name. */
export function aisleDetail(a?: { side?: string; shelf?: string }): string {
  if (!a) return '';
  const parts: string[] = [];
  const s = sideWord(a.side);
  if (s) parts.push(`${s} side`);
  if (a.shelf) parts.push(`shelf ${a.shelf}`);
  return parts.join(' · ');
}

export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
