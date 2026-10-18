import type { Department, Item, ItemResult, Product } from '../shared/types';

// Heuristic product matching: no LLM. Picks the most plausible in-store product for a search term.

const NON_FOOD_CATEGORIES = /cleaning|beauty|personal care|health|pet|baby|household|office|electronics|apparel|garden|automotive|pharmacy|toys|party|floral|tobacco/i;

const SHELF_STABLE = /canned|packaged|pasta|grain|rice|international|breakfast|condiment|sauce|soup|baking|snack|spice|natural/i;
const DEPT_CATEGORIES: Record<Department, RegExp> = {
  produce: /produce/i,
  meat: /meat/i,
  seafood: /seafood|meat/i,
  dairy: /dairy|deli|cheese/i,
  eggs: /dairy|eggs/i,
  bakery: /bakery|bread/i,
  spices: SHELF_STABLE,
  baking: SHELF_STABLE,
  pantry: SHELF_STABLE,
  condiments: SHELF_STABLE,
  international: SHELF_STABLE,
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

// Words that mean "not the real thing" unless the search term itself asks for them.
const GLOBAL_AVOID = ['substitute', 'alternative', 'replacer', 'replacement', 'sweetener', 'zero', 'imitation', 'artificial', 'candle', 'scented'];

export interface Scored {
  product: Product;
  score: number;
  /** 2 = every term word matches, 1 = only the head noun matches (e.g. "Granulated Sugar" for "white sugar"), 0 = irrelevant */
  tier: 0 | 1 | 2;
  relevant: boolean;
  available: boolean;
}

export function scoreCandidates(term: string, item: Pick<Item, 'department' | 'avoidWords'>, products: Product[]): Scored[] {
  const termTokens = tokens(term).filter((w) => !FILLER.has(w));
  const termSet = new Set(termTokens.map(singular));
  const head = termTokens[termTokens.length - 1];
  const modifiers = termTokens.slice(0, -1);
  const avoid = [...item.avoidWords, ...GLOBAL_AVOID]
    .map((w) => tokens(w).map(singular).join(' '))
    .filter((w) => w && !w.split(' ').every((t) => termSet.has(t)));
  const phrase = termTokens.map(singular).join(' ');
  const deptRe = DEPT_CATEGORIES[item.department];

  return products.map((product, rank) => {
    const desc = stripBrand(product).replace(BRANDISH, '');
    const descTokens = tokens(desc);
    const descSingular = descTokens.map(singular);
    const cats = product.categories.join(' | ');

    const joinedMatch = descTokens.join('').includes(termTokens.map(singular).join('')); // "cornstarch" vs "Corn Starch"
    const modsMatched = modifiers.filter((w) => wordMatches(w, descTokens)).length;
    const headMatch = !!head && wordMatches(head, descTokens);
    const descPhrase = ` ${descSingular.join(' ')} `;
    const hasAvoid = avoid.some((a) => (a.includes(' ') ? descPhrase.includes(` ${a} `) : descSingular.some((d) => d === a || d.startsWith(a))));
    const nonFood = product.categories.some((c) => NON_FOOD_CATEGORIES.test(c));
    const deptMatch = deptRe.test(cats);
    const deptMismatch = item.department !== 'other' && product.categories.length > 0 && !deptMatch;
    let tier: Scored['tier'] = 0;
    if (!hasAvoid && !nonFood) {
      const full = joinedMatch || (headMatch && modsMatched === modifiers.length);
      // exact words in the wrong department ("Lemongrass Seltzer" for fresh lemongrass) only count as a loose match;
      // head noun only is a loose match, and never from the wrong department ("Zero Sugar" sports drink for "white sugar")
      if (full) tier = deptMismatch ? 1 : 2;
      else if (headMatch && !deptMismatch) tier = 1;
    }
    const available = isAvailable(product);

    let score = 0;
    if (descPhrase.includes(` ${phrase} `)) score += 3;
    score += modsMatched * 1.5;
    if (product.aisle) score += 2;
    if (product.stockLevel === 'HIGH') score += 1.5;
    else if (product.stockLevel === 'LOW') score += 0.5;
    if (!available) score -= 6;
    if (deptMatch) score += 2;
    else if (deptMismatch) score -= 2.5;
    const extra = descTokens.filter((d) => !FILLER.has(d) && !BRANDISH.test(d) && !/^\d/.test(d) && !wordMatches(d, termTokens)).length;
    score -= Math.min(extra, 8) * 0.45;
    score -= rank * 0.15;
    return { product, score, tier, relevant: tier > 0, available };
  });
}

/** True when an attempt already has an exact (tier 2) hit, so alternate terms aren't needed. */
export function hasStrictHit(scored: Scored[]): boolean {
  return scored.some((s) => s.tier === 2);
}

export function pickBest(itemId: string, attempts: { term: string; scored: Scored[] }[]): ItemResult {
  // Pool every attempt (searchTerm first, then altTerms). Exact matches beat head-noun-only matches,
  // then score; later attempts get a small penalty so the primary term wins ties.
  const pool = new Map<string, { s: Scored; term: string; rankScore: number }>();
  attempts.forEach(({ term, scored }, ai) => {
    for (const s of scored) {
      if (!s.relevant) continue;
      const rankScore = s.tier * 100 + s.score - ai * 0.5;
      const prev = pool.get(s.product.productId);
      if (!prev || rankScore > prev.rankScore) pool.set(s.product.productId, { s, term, rankScore });
    }
  });
  const ranked = [...pool.values()].sort((a, b) => b.rankScore - a.rankScore);
  const avail = ranked.filter((r) => r.s.available);
  if (avail.length > 0) {
    return { itemId, status: 'found', termUsed: avail[0].term, best: avail[0].s.product, candidates: avail.slice(0, 6).map((r) => r.s.product) };
  }
  if (ranked.length > 0) {
    return { itemId, status: 'unavailable', termUsed: ranked[0].term, best: ranked[0].s.product, candidates: [] };
  }
  return { itemId, status: 'no_match', termUsed: attempts[0]?.term ?? '', candidates: [] };
}
