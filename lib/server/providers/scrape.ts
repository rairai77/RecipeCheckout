import type { Aisle, Department, Product } from '../../shared/types';

/**
 * DESIGN PROTOTYPE of a generic "LLM-powered" store-page scraper. Nothing here calls a model: the two model-shaped
 * interfaces below have heuristic stand-ins, and the request builders only produce the bodies a real call would send.
 *
 *   page text (fetch / r.jina.ai reader / headless Chromium)
 *     -> Stage 1, Jev  (fast, typed classification): is this a product listing, a bot wall, or something else?
 *     -> Stage 2, Claude (free-form extraction):      [{ product, price, size, aisle, inStock }]
 *     -> Stage 3, Jev  (per recipe item):             which candidate matches, which department, in stock yes/no
 *
 * Jev (TypeSafe's "System One" model) answers typed questions over a `state`: `choice` (<=255 options), `score`,
 * `noul` (probability a statement is true). It cannot generate text, so extraction stays with Claude.
 */

// ---------- shared shapes ----------

export interface PageSnapshot {
  url: string;
  via: 'fetch' | 'reader' | 'browser';
  /** markdown or visible text; HTML should be reduced first (reader output already is) */
  text: string;
}

export interface ExtractedItem {
  product: string;
  price?: number;
  /** regular price when a sale price is shown */
  regularPrice?: number;
  size?: string;
  aisle?: string;
  inStock?: boolean;
  url?: string;
}

export type PageKind = 'product_listing' | 'product_detail' | 'bot_challenge' | 'other';

// ---------- Jev-shaped requests (POST https://api.typesafe.ai/v1/systemone) ----------

export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'noul'; instructions: string };

export interface JevRequest {
  model: string;
  state: unknown;
  questions: Record<string, JevQuestion>;
}

export type JevAnswer =
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'noul'; noul: number };

export interface JevResponse {
  answers: Record<string, JevAnswer>;
}

/** Pin a version once thresholds are tuned; aliases like jev-latest move. */
export const JEV_MODEL = 'jev-1.14.0';
/** Jev's default limit is ~32k tokens for state + one question; keep page excerpts far below it. */
const STATE_CHARS = 12_000;

export function buildPageKindRequest(page: PageSnapshot): JevRequest {
  return {
    model: JEV_MODEL,
    state: { url: page.url, text: page.text.slice(0, STATE_CHARS) },
    questions: {
      page_kind: {
        type: 'choice',
        instructions: 'What kind of grocery web page is `text`?',
        criteria: {
          product_listing: 'Search or category results listing several products, usually with prices',
          product_detail: 'A single product page',
          bot_challenge: 'A captcha, "verify you are human", "Access Denied" or "Just a moment" security page',
          other: 'Anything else: home page, store locator, error page, recipe page',
        },
      },
      store_scoped: { type: 'noul', instructions: 'The page names a specific store location whose prices or stock it shows' },
    },
  };
}

const DEPARTMENTS: Department[] = [
  'produce', 'meat', 'seafood', 'dairy', 'eggs', 'bakery', 'spices', 'baking', 'pantry', 'condiments',
  'international', 'frozen', 'beverages', 'deli', 'other',
];

/** One call per recipe item: pick the best candidate, its department, and per-candidate in-stock probabilities. */
export function buildMatchRequest(ingredient: { name: string; searchTerm: string; avoidWords: string[] }, candidates: ExtractedItem[]): JevRequest {
  const list = candidates.slice(0, 254);
  const criteria: Record<string, string> = { none: 'None of the products is a reasonable buy for this ingredient' };
  list.forEach((c, i) => (criteria[`c${i}`] = [c.product, c.size, c.price != null ? `$${c.price.toFixed(2)}` : ''].filter(Boolean).join(' | ')));
  const questions: Record<string, JevQuestion> = {
    best: {
      type: 'choice',
      instructions: `Which product should a shopper buy for the recipe ingredient "${ingredient.name}" (searched as "${ingredient.searchTerm}")? Products containing any of these words are wrong: ${ingredient.avoidWords.join(', ') || 'none'}.`,
      criteria,
    },
    department: {
      type: 'choice',
      instructions: `Which grocery department sells "${ingredient.searchTerm}"?`,
      criteria: Object.fromEntries(DEPARTMENTS.map((d) => [d, d])),
    },
  };
  list.slice(0, 12).forEach((c, i) => {
    questions[`in_stock_c${i}`] = { type: 'noul', instructions: `The page shows "${c.product}" as in stock or available at the store` };
  });
  return { model: JEV_MODEL, state: { ingredient, candidates: list }, questions };
}

// ---------- Claude-shaped extraction (structured output) ----------

export const EXTRACT_SYSTEM = `You read one grocery store web page (as markdown) and list the products on it.
For each product output: product (brand + name as shown), price (the price a non-member pays now, number), regularPrice
(only if a higher crossed-out/regular price is also shown), size (e.g. "16 oz", "1 lb", "12 ct"), aisle (exactly as the
page states the in-store location, e.g. "Aisle 12" or "Dairy"; omit if the page does not say), inStock (false only if
the page says out of stock/unavailable; omit if not stated), url. Never guess a value the page does not show.
Ignore ads, recipes, navigation, filters and member-only prices.`;

export const EXTRACT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['product'],
        properties: {
          product: { type: 'string' },
          price: { type: 'number' },
          regularPrice: { type: 'number' },
          size: { type: 'string' },
          aisle: { type: 'string' },
          inStock: { type: 'boolean' },
          url: { type: 'string' },
        },
      },
    },
  },
} as const;

// ---------- pluggable stages ----------

export interface Classifier {
  classify(req: JevRequest): Promise<JevResponse>;
}

export interface Extractor {
  extract(page: PageSnapshot): Promise<ExtractedItem[]>;
}

const CHALLENGE = /verify (?:you are|you're) (?:a )?human|robot or human|captcha|access denied|just a moment|performing security verification|press (?:&|and) hold/i;
const PRICE = /\$\s?(\d{1,4}(?:\.\d{2})?)/g;

/** Heuristic stand-in for Jev stage 1 (and the in-stock questions of stage 3). */
export const heuristicClassifier: Classifier = {
  async classify(req) {
    const state = req.state as { text?: string };
    const text = state?.text ?? '';
    const answers: Record<string, JevAnswer> = {};
    for (const [id, q] of Object.entries(req.questions)) {
      if (id === 'page_kind' && q.type === 'choice') {
        const prices = text.match(PRICE)?.length ?? 0;
        const kind: PageKind = CHALLENGE.test(text) && prices < 3 ? 'bot_challenge' : prices >= 3 ? 'product_listing' : prices >= 1 ? 'product_detail' : 'other';
        answers[id] = { type: 'choice', choice: kind, confidence: 0.6, probabilities: { [kind]: 0.6 } };
      } else if (q.type === 'noul') {
        answers[id] = { type: 'noul', noul: /\b(?:aisle|pickup at|my store|your store)\b/i.test(text) ? 0.7 : 0.3 };
      }
    }
    return { answers };
  },
};

const SIZE = /\b(\d+(?:\.\d+)?\s?(?:fl\.?\s?oz|oz|lbs?|ct|count|g|kg|ml|l|pk|pack))\b/i;
const AISLE = /\b(?:aisle|isle)\s*[:#]?\s*([A-Z]?\d{1,3}[A-Z]?)\b/i;
const MEMBER_PRICE = /join prime to buy this item at \$\s?\d+(?:\.\d{2})?|member price:?\s*\$\s?\d+(?:\.\d{2})?/gi;

/**
 * Heuristic stand-in for the Claude extraction call. Understands reader-style markdown where each product is a
 * link whose text holds name, size and price ("[![img](..) Brand Name, 16oz $3.59](https://...)"), or one product
 * per line. Good enough to exercise the pipeline and the tests; the real thing is the EXTRACT_* prompt above.
 */
export const heuristicExtractor: Extractor = {
  async extract(page) {
    const items: ExtractedItem[] = [];
    const blocks = page.text.split(/\n\s*\n/);
    for (const block of blocks) {
      const link = block.match(/^\[(?:!\[[^\]]*\]\([^)]*\)\s*)?([^\]]+)\]\((https?:[^)\s]+)\)/);
      const line = (link ? link[1] : block).replace(/\s+/g, ' ').trim();
      const cleaned = line.replace(MEMBER_PRICE, ' ');
      const prices = [...cleaned.matchAll(PRICE)].map((m) => Number(m[1]));
      if (prices.length === 0 || line.length > 400) continue;
      const firstPrice = cleaned.search(/\$\s?\d/);
      let product = cleaned.slice(0, firstPrice).replace(/\d+% off.*$/i, '').replace(/\d+ flavors?$/i, '').trim();
      const size = product.match(SIZE)?.[1];
      if (size) product = product.replace(new RegExp(`,?\\s*${size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '').trim();
      if (product.length < 3) continue;
      const aisle = (block.match(AISLE) ?? [])[1];
      items.push({
        product,
        price: Math.min(...prices),
        regularPrice: prices.length > 1 && Math.max(...prices) > Math.min(...prices) ? Math.max(...prices) : undefined,
        size: size?.toLowerCase().replace(/\s+/g, ' '),
        aisle: aisle ? `Aisle ${aisle.toUpperCase()}` : undefined,
        inStock: /out of stock|unavailable|sold out/i.test(block) ? false : undefined,
        url: link?.[2]?.split('?')[0],
      });
    }
    return items;
  },
};

// ---------- pipeline ----------

export function parseAisle(s?: string): Aisle | undefined {
  if (!s) return undefined;
  const m = s.match(/^aisle\s+([A-Z]?)(\d{1,3})([A-Z]?)$/i);
  if (m && !m[1] && !m[3]) {
    const n = Number(m[2]);
    return { label: `AISLE ${n}`, number: String(n), isNumbered: n >= 1 && n <= 99 };
  }
  // lettered aisles like Target's "G23", or named sections like "Dairy": not walkable by number
  return { label: s.toUpperCase(), isNumbered: false };
}

export function toProduct(e: ExtractedItem, i: number): Product {
  return {
    productId: e.url ?? `x${i}`,
    description: e.product,
    size: e.size,
    price: e.regularPrice ?? e.price,
    promoPrice: e.regularPrice != null && e.price != null && e.price < e.regularPrice ? e.price : undefined,
    inStore: e.inStock,
    stockLevel: e.inStock === false ? 'TEMPORARILY_OUT_OF_STOCK' : undefined,
    aisle: parseAisle(e.aisle),
    categories: [],
    url: e.url,
  };
}

export interface ScrapeResult {
  kind: PageKind;
  products: Product[];
}

export async function scrapeProducts(
  page: PageSnapshot,
  stages: { classifier: Classifier; extractor: Extractor } = { classifier: heuristicClassifier, extractor: heuristicExtractor },
): Promise<ScrapeResult> {
  const cls = await stages.classifier.classify(buildPageKindRequest(page));
  const pk = cls.answers.page_kind;
  const kind = (pk?.type === 'choice' ? pk.choice : 'other') as PageKind;
  if (kind !== 'product_listing' && kind !== 'product_detail') return { kind, products: [] };
  const items = verifyAgainstPage(await stages.extractor.extract(page), page.text);
  return { kind, products: items.map(toProduct) };
}

/** Hallucination guard: drop any price or aisle the page text does not literally contain. */
export function verifyAgainstPage(items: ExtractedItem[], text: string): ExtractedItem[] {
  const has = (n?: number) => n != null && (text.includes(n.toFixed(2)) || (Number.isInteger(n) && new RegExp(`\\$\\s?${n}\\b`).test(text)));
  const flat = text.replace(/\s+/g, ' ').toLowerCase();
  const aisleOk = (a: string) => {
    const code = a.toLowerCase().match(/^aisle\s+(\w+)$/)?.[1];
    return code ? new RegExp(`\\b(?:aisle|isle)\\s*[:#]?\\s*${code}\\b`).test(flat) : flat.includes(a.toLowerCase());
  };
  return items.map((e) => ({
    ...e,
    price: has(e.price) ? e.price : undefined,
    regularPrice: has(e.regularPrice) ? e.regularPrice : undefined,
    aisle: e.aisle && aisleOk(e.aisle) ? e.aisle : undefined,
  }));
}

/** Rough token count for cost estimates (~4 characters per token for English markdown). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
