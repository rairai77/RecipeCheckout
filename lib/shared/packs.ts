/**
 * Deterministic pack math: how many of a store product the recipe needs, from the recipe's quantity/unit and the
 * product's size string ("1 lb", "14.5 oz", "4 sticks / 16 oz / 2 pk", "1 ct"). No AI involved.
 *
 * It only multiplies when it is confident (count to count, same-dimension units, or a count item sold by weight that
 * has a typical weight below). Otherwise it keeps 1 and says so, and the UI shows the recipe's need as a hint.
 */

export type Dim = 'mass' | 'volume';
export interface Amount {
  dim: Dim;
  /** grams for mass, millilitres for volume */
  value: number;
}

const MASS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, kilo: 1000, kilos: 1000, oz: 28.3495, onz: 28.3495, ounce: 28.3495, ounces: 28.3495, lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592 };
const VOLUME: Record<string, number> = {
  ml: 1,
  millilitre: 1,
  milliliter: 1,
  millilitres: 1,
  milliliters: 1,
  l: 1000,
  litre: 1000,
  liter: 1000,
  litres: 1000,
  liters: 1000,
  tsp: 4.93,
  teaspoon: 4.93,
  teaspoons: 4.93,
  tbsp: 14.79,
  tbs: 14.79,
  tablespoon: 14.79,
  tablespoons: 14.79,
  cup: 236.6,
  cups: 236.6,
  'fl oz': 29.57,
  floz: 29.57,
  pt: 473.2,
  pint: 473.2,
  pints: 473.2,
  qt: 946.4,
  quart: 946.4,
  quarts: 946.4,
  gal: 3785,
  gallon: 3785,
  gallons: 3785,
};
/** Containers: "2 cans" of tomatoes is two of whatever can the store sells. */
const CONTAINER = /^(cans?|tins?|jars?|bottles?|packs?|packets?|packages?|pkgs?|boxes?|bags?|cartons?|tubs?|bunch(es)?|heads?|loaf|loaves)$/i;
/** Tiny amounts: one of anything covers them. */
const TINY = /^(pinch(es)?|dash(es)?|sprigs?|handfuls?|splash(es)?|drizzle|knob|to taste)$/i;
/** Counted things ("4 onions", "2 large red peppers"). */
const COUNT = /^(|whole|large|medium|small|pieces?|pcs?|items?|fillets?|breasts?|thighs?|cloves?|stalks?|sticks?|slices?)$/i;

/** Typical weight in pounds of one counted item, for things a store sells by weight. Most specific first. */
const TYPICAL_LB: [RegExp, number][] = [
  [/sweet potato/i, 0.6],
  [/chicken breast/i, 0.5],
  [/chicken thigh/i, 0.3],
  [/chicken drumstick/i, 0.25],
  [/shallot/i, 0.1],
  [/onion/i, 0.5],
  [/potato/i, 0.5],
  [/tomato(es)?\b(?!.*(paste|pur[eé]e|sauce|can|tin))/i, 0.3],
  [/bell pepper|\b(red|green|yellow|orange) peppers?\b/i, 0.4],
  [/carrot/i, 0.15],
  [/zucchini|courgette/i, 0.45],
  [/cucumber/i, 0.6],
  [/eggplant|aubergine/i, 1],
  [/apple/i, 0.4],
  [/lemon/i, 0.25],
  [/lime/i, 0.15],
  [/avocado/i, 0.4],
  [/banana/i, 0.3],
];

const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

/** "8" -> 8, "1 1/2" -> 1.5, "½" -> 0.5, "2-3" -> 3 (buy for the top of a range). */
export function parseQuantity(q: string | undefined): number | undefined {
  if (!q) return undefined;
  let s = q.trim().replace(/[½⅓⅔¼¾⅛]/g, (c) => ` ${FRACTIONS[c]}`);
  const range = s.split(/\s*(?:-|–|to)\s*/);
  if (range.length === 2 && range[1]) s = range[1];
  let total = 0;
  let any = false;
  for (const part of s.trim().split(/\s+/)) {
    const frac = part.match(/^(\d+)\/(\d+)$/);
    const n = frac ? Number(frac[1]) / Number(frac[2]) : Number(part);
    if (!Number.isFinite(n)) return any ? total : undefined;
    total += n;
    any = true;
  }
  return any && total > 0 ? total : undefined;
}

function unitAmount(n: number, unit: string): Amount | undefined {
  const u = unit.toLowerCase().replace(/\.$/, '').trim();
  if (MASS[u]) return { dim: 'mass', value: n * MASS[u] };
  if (VOLUME[u]) return { dim: 'volume', value: n * VOLUME[u] };
  return undefined;
}

/** Product size: total mass/volume and count. "4 sticks / 16 oz / 2 pk" -> 32 oz; "4 ct / 14.5 oz" -> 4 × 14.5 oz. */
export function parseSize(size: string | undefined): { amount?: Amount; count?: number } {
  if (!size) return {};
  const s = size.toLowerCase();
  let amount: Amount | undefined;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|onz|oz|lbs?|kg|g|ml|l|pt|qt|gal)\b/);
  if (m) amount = unitAmount(Number(m[1]), m[2].startsWith('fl') ? 'fl oz' : m[2]);
  const pk = s.match(/(\d+)\s*(pk|pack)\b/);
  const ct = s.match(/(\d+(?:\.\d+)?)\s*(ct|count|each)\b/) ?? (/\beach\b/.test(s) ? ['1', '1'] : null);
  const mult = pk ? Number(pk[1]) : 1;
  if (amount) amount = { ...amount, value: amount.value * mult * (ct && m ? Number(ct[1]) : 1) };
  const count = ct ? Number(ct[1]) * mult : pk && !amount ? mult : undefined;
  return { amount, count };
}

/** What the recipe needs, normalised. */
export type Need =
  | { kind: 'none' } // no quantity given ("fresh coriander, to garnish")
  | { kind: 'tiny' }
  | { kind: 'amount'; amount: Amount }
  | { kind: 'count'; n: number; each?: Amount } // "4" onions, "2 x 400g cans"
  | { kind: 'containers'; n: number }
  | { kind: 'unknown' };

export function parseNeed(quantity: string | undefined, unit: string | undefined): Need {
  const u = (unit ?? '').trim();
  const n = parseQuantity(quantity);
  if (TINY.test(u)) return { kind: 'tiny' };
  if (n === undefined) return quantity?.trim() ? { kind: 'unknown' } : { kind: 'none' };
  // "x 400g cans", "x 400 g tins"
  const each = u.match(/^x\s*(\d+(?:\.\d+)?)\s*([a-z ]+?)\s*(cans?|tins?|jars?|packs?|bottles?)?$/i);
  if (each) {
    const a = unitAmount(Number(each[1]), each[2]);
    if (a) return { kind: 'count', n, each: a };
  }
  const a = unitAmount(n, u);
  if (a) return { kind: 'amount', amount: a };
  if (CONTAINER.test(u)) return { kind: 'containers', n };
  if (COUNT.test(u)) return { kind: 'count', n };
  return { kind: 'unknown' };
}

/** True when the recipe needs only a little (spoons, a pinch, under 100 g/ml): any pack covers it. */
export function isSmallNeed(need: Need): boolean {
  return need.kind === 'tiny' || (need.kind === 'amount' && need.amount.value < 100);
}

export interface PackPlan {
  /** how many of the product to buy */
  packs: number;
  /** false when the math couldn't tell (we then keep 1 and show the recipe's need) */
  confident: boolean;
  /** "Recipe needs 8", when it's worth showing */
  needLabel?: string;
  /** "≈ 4 × 1 lb", when packs > 1 */
  packLabel?: string;
}

function typicalLb(text: string): number | undefined {
  return TYPICAL_LB.find(([re]) => re.test(text))?.[1];
}

/** Packs with a little slack, so a 14.5 oz can counts as a 400 g can and 1.02 packs isn't 2. */
const packsFor = (need: number, pack: number) => Math.max(1, Math.ceil(need / pack - 0.05));

export function packPlan(
  item: { name: string; searchTerm?: string; quantity?: string; unit?: string },
  product: { size?: string },
): PackPlan {
  const need = parseNeed(item.quantity, item.unit);
  const size = parseSize(product.size);
  const q = [item.quantity, item.unit].map((s) => s?.trim()).filter(Boolean).join(' ');
  const needLabel = q ? `Recipe needs ${q}` : undefined;
  const result = (packs: number, confident: boolean): PackPlan => ({
    packs,
    confident,
    // Show the need when we multiplied, or when 1 might not be enough.
    needLabel: packs > 1 || (!confident && need.kind !== 'tiny' && !isSmallNeed(need)) ? needLabel : undefined,
    // "≈ 2 × 1 ct" says nothing "Recipe needs 2" doesn't, so single-count products get no pack label.
    packLabel: packs > 1 && !(size.count === 1 && !size.amount) ? `≈ ${packs} × ${product.size?.trim() || '1'}` : undefined,
  });

  switch (need.kind) {
    case 'none':
    case 'tiny':
      return result(1, true);
    case 'unknown':
      return result(1, false);
    case 'containers':
      if (size.count) return result(packsFor(need.n, size.count), true);
      return result(Math.ceil(need.n), true); // one store pack per can/jar/bunch asked for
    case 'count': {
      if (need.each) {
        const total: Amount = { dim: need.each.dim, value: need.each.value * need.n };
        if (size.amount && size.amount.dim === total.dim) return result(packsFor(total.value, size.amount.value), true);
        if (size.count) return result(packsFor(need.n, size.count), true);
        return result(1, false);
      }
      if (size.count && !size.amount) return result(packsFor(need.n, size.count), true);
      if (size.count && size.amount) return result(packsFor(need.n, size.count), true); // "4 ct / 14.5 oz"
      const lb = typicalLb(`${item.name} ${item.searchTerm ?? ''}`);
      if (lb && size.amount?.dim === 'mass') return result(packsFor(need.n * lb * MASS.lb, size.amount.value), true);
      if (need.n <= 1) return result(1, true);
      return result(1, false);
    }
    case 'amount': {
      const pack = size.amount;
      if (pack && pack.dim === need.amount.dim) return result(packsFor(need.amount.value, pack.value), true);
      // Weight vs volume: at roughly water density, a pack at least twice the need clearly covers it.
      if (pack && need.amount.value <= pack.value / 2) return result(1, true);
      if (!pack && isSmallNeed(need)) return result(1, true);
      return result(1, false);
    }
  }
}

/** Pack size in a comparable unit (g or ml, treating them as equal), for ranking smaller packs first. */
export function packMagnitude(size: string | undefined): number | undefined {
  return parseSize(size).amount?.value;
}
