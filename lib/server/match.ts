import type { Department, Item, ItemResult, Product } from '../shared/types';

// Heuristic product matching: no LLM. Picks the most plausible in-store product for a search term.

const NON_FOOD_CATEGORIES = /cleaning|beauty|personal care|health|pet|baby|household|office|electronics|apparel|garden|automotive|pharmacy|toys|party|floral|tobacco/i;

const DEPT_CATEGORIES: Record<Department, RegExp> = {
  produce: /produce/i,
  meat: /meat/i,
  seafood: /seafood|meat/i,
  dairy: /dairy|deli|cheese/i,
  eggs: /dairy|eggs/i,
  bakery: /bakery|bread/i,
  spices: /baking|spice|international/i,
  baking: /baking/i,
  pantry: /canned|packaged|pasta|grain|rice|international|breakfast|condiment|soup|baking|snacks/i,
  condiments: /condiment|sauce|international|dressing/i,
  international: /international|condiment|canned/i,
  frozen: /frozen/i,
  beverages: /beverage|adult|wine|beer/i,
  deli: /deli/i,
  other: /$^/,
};

const FILLER = new Set(['and', 'or', 'with', 'of', 'the', 'a', 'in', 'for', 'fresh', 'organic', 'natural', 'pack', 'pk', 'oz', 'lb', 'ct', 'each', 'big', 'deal', 'value', 'family', 'size']);
const BRANDISH = /^(kroger|simple truth( organic)?|private selection|heritage farm|psst|smart way|home chef|comforts|signature|big deal)$/i;

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function singular(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(ches|shes|sses|xes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function wordMatches(term: string, descTokens: string[]): boolean {
  const t = singular(term);
  return descTokens.some((d) => {
    const ds = singular(d);
    return ds === t || (t.length >= 4 && ds.startsWith(t) && ds.length - t.length <= 2);
  });
}

export function stripBrand(p: Product): string {
  let d = p.description;
  if (p.brand) d = d.replace(new RegExp(`^${p.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\W*`, 'i'), '');
  return d;
}

export function isAvailable(p: Product): boolean {
  if (p.stockLevel === 'TEMPORARILY_OUT_OF_STOCK') return false;
  if (p.aisle) return true;
  return p.price != null && p.inStore !== false;
}

export interface Scored {
  product: Product;
  score: number;
  relevant: boolean;
  available: boolean;
}

export function scoreCandidates(term: string, item: Pick<Item, 'department' | 'avoidWords'>, products: Product[]): Scored[] {
  const termTokens = tokens(term).filter((w) => !FILLER.has(w));
  const termSet = new Set(termTokens.map(singular));
  const avoid = item.avoidWords
    .map((w) => tokens(w).map(singular).join(' '))
    .filter((w) => w && !w.split(' ').every((t) => termSet.has(t)));
  const phrase = termTokens.map(singular).join(' ');

  return products.map((product, rank) => {
    const desc = stripBrand(product).replace(BRANDISH, '');
    const descTokens = tokens(desc);
    const descSingular = descTokens.map(singular);
    const cats = product.categories.join(' | ');

    const hasAll =
      termTokens.every((w) => wordMatches(w, descTokens)) ||
      descTokens.join('').includes(termTokens.map(singular).join('')); // "cornstarch" vs "Corn Starch"
    const descPhrase = ` ${descSingular.join(' ')} `;
    const hasAvoid = avoid.some((a) => (a.includes(' ') ? descPhrase.includes(` ${a} `) : descSingular.some((d) => d === a || d.startsWith(a))));
    const nonFood = product.categories.some((c) => NON_FOOD_CATEGORIES.test(c));
    const relevant = termTokens.length > 0 && hasAll && !hasAvoid && !nonFood;
    const available = isAvailable(product);

    let score = 0;
    if (descSingular.join(' ').includes(phrase)) score += 3;
    if (product.aisle) score += 2;
    if (product.stockLevel === 'HIGH') score += 1.5;
    else if (product.stockLevel === 'LOW') score += 0.5;
    if (!available) score -= 6;
    if (DEPT_CATEGORIES[item.department].test(cats)) score += 2;
    const extra = descTokens.filter((d) => !FILLER.has(d) && !BRANDISH.test(d) && !/^\d/.test(d) && !wordMatches(d, termTokens)).length;
    score -= Math.min(extra, 8) * 0.45;
    score -= rank * 0.15;
    return { product, score, relevant, available };
  });
}

export function pickBest(itemId: string, attempts: { term: string; scored: Scored[] }[]): ItemResult {
  // attempts are in order (searchTerm first, then altTerms); first attempt with a relevant hit wins
  for (const { term, scored } of attempts) {
    const relevant = scored.filter((s) => s.relevant).sort((a, b) => b.score - a.score);
    if (relevant.length === 0) continue;
    const avail = relevant.filter((s) => s.available);
    if (avail.length > 0) {
      return { itemId, status: 'found', termUsed: term, best: avail[0].product, candidates: avail.slice(0, 6).map((s) => s.product) };
    }
    return { itemId, status: 'unavailable', termUsed: term, best: relevant[0].product, candidates: [] };
  }
  const first = attempts[0];
  return { itemId, status: 'no_match', termUsed: first?.term ?? '', candidates: [] };
}
