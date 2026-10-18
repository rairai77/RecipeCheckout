/**
 * Mock data + dev switch.
 *
 * Load the web app with `?mock=1` and every screen uses the mock functions below instead of the real API.
 * The flag is remembered in sessionStorage for the tab (so it survives client-side navigation);
 * `?mock=0` turns it off again.
 *
 * Screens should import `client` from this module, never call lib/client/api.ts directly.
 */
import * as real from './api';
import * as demo from './demo';
import { ApiCallError } from './api';
import { SEATTLE_PRESET, type UserLocation } from './location';
import type {
  Aisle,
  Department,
  Item,
  ItemResult,
  ItemStatus,
  Product,
  RecipeResponse,
  SearchRequest,
  SearchResponse,
  Store,
  StoresResponse,
} from '../shared/types';

// ---------------------------------------------------------------------------
// Dev switch
// ---------------------------------------------------------------------------

const flags: Record<string, boolean | undefined> = {};

/** Reads a `?name=1` URL flag, remembered in sessionStorage for the tab; `?name=0` clears it. */
function urlFlag(name: string): boolean {
  if (flags[name] !== undefined) return flags[name]!;
  flags[name] = false;
  if (typeof window === 'undefined' || !window.location) return false;
  const key = `recipecheckout:${name}`;
  try {
    const p = new URLSearchParams(window.location.search).get(name);
    if (p === '1') {
      window.sessionStorage?.setItem(key, '1');
      flags[name] = true;
    } else if (p === '0') {
      window.sessionStorage?.removeItem(key);
    } else {
      flags[name] = window.sessionStorage?.getItem(key) === '1';
    }
  } catch {
    // sessionStorage can throw in private mode; ignore.
  }
  return flags[name]!;
}

export function isMockMode(): boolean {
  return urlFlag('mock');
}

/** `?demo=1`: replay a recorded real run (BBC Good Food chicken tikka masala, Seattle) with no network calls. */
export function isDemoMode(): boolean {
  return urlFlag('demo');
}

const SAMPLE_KEY = 'recipecheckout:sample';

/**
 * "See a sample run" on the home page: turn the recorded replay on for this tab without the URL flag.
 * It only lasts until the person submits their own recipe (see endSampleRun), unlike `?demo=1`.
 */
export function startSampleRun(): void {
  flags.demo = true;
  try {
    window.sessionStorage?.setItem('recipecheckout:demo', '1');
    window.sessionStorage?.setItem(SAMPLE_KEY, '1');
  } catch {
    // ignore: the in-memory flag still works for this page load
  }
}

/** Turns the replay off again if it was started by startSampleRun (not by `?demo=1`). Returns true if it did. */
export function endSampleRun(): boolean {
  let sample = false;
  try {
    sample = window.sessionStorage?.getItem(SAMPLE_KEY) === '1';
    if (sample) {
      window.sessionStorage?.removeItem(SAMPLE_KEY);
      window.sessionStorage?.removeItem('recipecheckout:demo');
    }
  } catch {
    // ignore
  }
  if (sample) flags.demo = false;
  return sample;
}

/** The default "Seattle" location: the recorded run's origin in the replay, so labels match its stores. */
export function presetLocation(): UserLocation {
  if (!isDemoMode()) return SEATTLE_PRESET;
  const o = demo.sampleOrigin();
  return { lat: o.lat, lng: o.lng, label: o.label };
}

/** "Seattle (Capitol Hill)" -> "Seattle · Capitol Hill" for compact controls. */
export function shortLocationLabel(label: string): string {
  const m = label.match(/^(.*?)\s*\((.+)\)$/);
  if (!m) return label;
  const both = `${m[1]} · ${m[2]}`;
  return both.length > 22 ? m[2] : both; // "South Lake Union" rather than a truncated "Seattle · South Lak…"
}

/** Which data source the client is using; part of cache keys so demo and live data never mix. */
export function clientMode(): 'demo' | 'mock' | 'live' {
  return isDemoMode() ? 'demo' : isMockMode() ? 'mock' : 'live';
}

/** `?clean=1`: hide the DEMO/MOCK badge, for screenshots and the demo video. */
export function isCleanMode(): boolean {
  return urlFlag('clean');
}

/** Real or mock API, picked per call. */
export const client = {
  fetchRecipe: (input: { url: string } | { text: string }): Promise<RecipeResponse> =>
    isDemoMode() ? demo.fetchRecipe() : isMockMode() ? mockFetchRecipe(input) : real.fetchRecipe(input),
  fetchStores: (loc: { lat: number; lng: number } | { zip: string }): Promise<StoresResponse> =>
    isDemoMode() ? demo.fetchStores() : isMockMode() ? mockFetchStores(loc) : real.fetchStores(loc),
  searchStore: (req: SearchRequest): Promise<SearchResponse> =>
    isDemoMode() ? demo.searchStore(req) : isMockMode() ? mockSearchStore(req) : real.searchStore(req),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TILE_COLORS = ['#DCEFE2', '#FCE8D5', '#E5E9FB', '#FBE3E8', '#F3EED2', '#E1F1F6'];

/** Small inline SVG "product photo" so mock mode works offline. */
function tile(text: string): string {
  const bg = TILE_COLORS[hash(text) % TILE_COLORS.length];
  const letter = text.replace(/[^A-Za-z]/g, '').charAt(0).toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="16" fill="${bg}"/><text x="48" y="62" font-family="Helvetica,Arial,sans-serif" font-size="44" font-weight="700" text-anchor="middle" fill="#3b4a3e">${letter}</text></svg>`;
  // react-native-web URI-encodes the part after `utf8,` itself, so pass raw SVG markup here.
  return `data:image/svg+xml;utf8,${svg}`;
}

const aisle = (n: number, side: 'L' | 'R', shelf: number): Aisle => ({
  label: `AISLE ${n}`,
  number: String(n),
  side,
  shelf: String(shelf),
  isNumbered: true,
});
const section = (label: string, number = '0', side?: string, shelf?: string): Aisle => ({
  label,
  number,
  ...(side ? { side } : {}),
  ...(shelf ? { shelf } : {}),
  isNumbered: false,
});

type P = Omit<Product, 'categories' | 'image' | 'productId'> & { categories?: string[] };

function product(seed: string, p: P): Product {
  return {
    productId: String(1_000_000_000 + (hash(seed + p.description) % 8_999_999_999)).padStart(13, '0'),
    image: tile(p.description.replace(/^(Kroger®|Simple Truth( Organic)?™?|Private Selection™|Daisy|Lea & Perrins)\s*/, '')),
    categories: p.categories ?? [],
    inStore: true,
    ...p,
  };
}

// ---------------------------------------------------------------------------
// Recipe
// ---------------------------------------------------------------------------

type Seed = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  searchTerm: string;
  altTerms?: string[];
  department: Department;
  avoidWords?: string[];
  isPantryStaple?: boolean;
  raw: string;
  /** status at store #1, #2, #3 (nearest first) */
  statuses: [ItemStatus, ItemStatus, ItemStatus];
  products: P[];
};

const SEEDS: Seed[] = [
  {
    id: 'chicken-thighs', name: 'chicken thighs', quantity: '2', unit: 'lb', searchTerm: 'chicken thighs',
    altTerms: ['boneless chicken thighs'], department: 'meat', avoidWords: ['broth', 'seasoning', 'breaded'],
    raw: '2 lb boneless skinless chicken thighs, cut into bite-size pieces',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Boneless Skinless Chicken Thighs Family Pack', brand: 'Kroger', size: 'about 2.5 lb', price: 9.99, promoPrice: 7.49, stockLevel: 'HIGH', aisle: section('MEAT 101', '101', 'L', '4'), categories: ['Meat & Seafood'] },
      { description: 'Simple Truth® Natural Boneless Skinless Chicken Thighs', brand: 'Simple Truth', size: '1.5 lb', price: 8.99, stockLevel: 'HIGH', aisle: section('MEAT 101', '101', 'L', '3'), categories: ['Meat & Seafood'] },
      { description: 'Foster Farms Bone-In Chicken Thighs', brand: 'Foster Farms', size: '2 lb', price: 6.49, stockLevel: 'LOW', aisle: section('MEAT 101', '101', 'R', '2'), categories: ['Meat & Seafood'] },
    ],
  },
  {
    id: 'yogurt', name: 'plain whole-milk yogurt', quantity: '1', unit: 'cup', searchTerm: 'plain whole milk yogurt',
    altTerms: ['plain yogurt'], department: 'dairy', avoidWords: ['vanilla', 'strawberry'],
    raw: '1 cup plain whole-milk yogurt',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Plain Whole Milk Yogurt', brand: 'Kroger', size: '32 oz', price: 3.29, stockLevel: 'HIGH', aisle: section('DAIRY', '0'), categories: ['Dairy'] },
      { description: 'Mountain High Original Plain Whole Milk Yoghurt', brand: 'Mountain High', size: '32 oz', price: 4.79, promoPrice: 3.99, stockLevel: 'HIGH', aisle: section('DAIRY', '0'), categories: ['Dairy'] },
      { description: 'Fage Total Plain Greek Yogurt', brand: 'Fage', size: '17.6 oz', price: 6.29, stockLevel: 'LOW', aisle: section('DAIRY', '0'), categories: ['Dairy'] },
    ],
  },
  {
    id: 'garam-masala', name: 'garam masala', quantity: '2', unit: 'tbsp', searchTerm: 'garam masala',
    department: 'spices', raw: '2 tablespoons garam masala, divided',
    statuses: ['unavailable', 'found', 'found'],
    products: [
      { description: 'Simple Truth Organic™ Garam Masala', brand: 'Simple Truth Organic', size: '1.8 oz', price: 4.99, stockLevel: 'HIGH', aisle: aisle(9, 'L', 4), categories: ['Baking Goods'] },
      { description: 'McCormick Gourmet Garam Masala', brand: 'McCormick', size: '1.87 oz', price: 6.99, stockLevel: 'LOW', aisle: aisle(9, 'L', 5), categories: ['Baking Goods'] },
    ],
  },
  {
    id: 'turmeric', name: 'ground turmeric', quantity: '1', unit: 'tsp', searchTerm: 'ground turmeric',
    department: 'spices', raw: '1 teaspoon ground turmeric',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Ground Turmeric', brand: 'Kroger', size: '1.5 oz', price: 2.49, stockLevel: 'HIGH', aisle: aisle(9, 'L', 3), categories: ['Baking Goods'] },
      { description: 'McCormick Ground Turmeric', brand: 'McCormick', size: '0.95 oz', price: 5.29, stockLevel: 'HIGH', aisle: aisle(9, 'L', 4), categories: ['Baking Goods'] },
    ],
  },
  {
    id: 'cumin', name: 'ground cumin', quantity: '2', unit: 'tsp', searchTerm: 'ground cumin',
    department: 'spices', raw: '2 teaspoons ground cumin',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Ground Cumin', brand: 'Kroger', size: '1.75 oz', price: 2.49, stockLevel: 'LOW', aisle: aisle(9, 'L', 3), categories: ['Baking Goods'] },
      { description: 'Simply Organic Ground Cumin Seed', brand: 'Simply Organic', size: '2.31 oz', price: 6.49, stockLevel: 'HIGH', aisle: aisle(9, 'R', 5), categories: ['Baking Goods'] },
    ],
  },
  {
    id: 'crushed-tomatoes', name: 'crushed tomatoes', quantity: '1', unit: 'can (28 oz)', searchTerm: 'crushed tomatoes',
    altTerms: ['canned crushed tomatoes'], department: 'pantry', avoidWords: ['sauce', 'paste'],
    raw: '1 (28-ounce) can crushed tomatoes',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Crushed Tomatoes', brand: 'Kroger', size: '28 oz', price: 1.79, stockLevel: 'HIGH', aisle: aisle(6, 'R', 2), categories: ['Canned & Packaged'] },
      { description: 'Cento San Marzano Crushed Tomatoes', brand: 'Cento', size: '28 oz', price: 4.49, promoPrice: 3.99, stockLevel: 'HIGH', aisle: aisle(6, 'R', 3), categories: ['Canned & Packaged'] },
      { description: "Hunt's Crushed Tomatoes", brand: "Hunt's", size: '28 oz', price: 2.29, aisle: aisle(6, 'R', 2), categories: ['Canned & Packaged'] },
    ],
  },
  {
    id: 'heavy-cream', name: 'heavy cream', quantity: '1', unit: 'cup', searchTerm: 'heavy whipping cream',
    altTerms: ['heavy cream'], department: 'dairy', avoidWords: ['aerosol', 'topping'],
    raw: '1 cup heavy cream',
    statuses: ['unavailable', 'unavailable', 'found'],
    products: [
      { description: 'Kroger® Heavy Whipping Cream', brand: 'Kroger', size: '1 pt', price: 3.99, stockLevel: 'LOW', aisle: section('DAIRY', '0'), categories: ['Dairy'] },
      { description: 'Darigold Heavy Whipping Cream', brand: 'Darigold', size: '1 pt', price: 4.69, stockLevel: 'HIGH', aisle: section('DAIRY', '0'), categories: ['Dairy'] },
    ],
  },
  {
    id: 'onion', name: 'yellow onion', quantity: '1', unit: 'large', searchTerm: 'yellow onion',
    department: 'produce', avoidWords: ['powder', 'soup'], raw: '1 large yellow onion, finely chopped',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Yellow Onion', size: '1 each', price: 1.19, stockLevel: 'HIGH', aisle: section('VEGETABLES'), categories: ['Produce'] },
      { description: 'Kroger® Yellow Onions Bag', brand: 'Kroger', size: '3 lb', price: 3.49, stockLevel: 'HIGH', aisle: section('VEGETABLES'), categories: ['Produce'] },
    ],
  },
  {
    id: 'garlic', name: 'garlic', quantity: '6', unit: 'cloves', searchTerm: 'garlic',
    department: 'produce', avoidWords: ['powder', 'salt', 'bread'], raw: '6 garlic cloves, minced',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Fresh Garlic Bulb', size: '1 each', price: 0.69, stockLevel: 'HIGH', aisle: section('VEGETABLES'), categories: ['Produce'] },
      { description: 'Kroger® Peeled Garlic Cloves', brand: 'Kroger', size: '6 oz', price: 3.29, stockLevel: 'HIGH', aisle: section('VEGETABLES'), categories: ['Produce'] },
      { description: 'Spice World Minced Garlic', brand: 'Spice World', size: '8 oz', price: 3.99, stockLevel: 'HIGH', aisle: section('VEGETABLES'), categories: ['Produce'] },
    ],
  },
  {
    id: 'ginger', name: 'fresh ginger', quantity: '1', unit: 'tbsp', searchTerm: 'ginger root',
    altTerms: ['fresh ginger'], department: 'produce', avoidWords: ['ale', 'ground', 'candied'],
    raw: '1 tablespoon grated fresh ginger',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Fresh Ginger Root', size: 'per lb', price: 3.99, stockLevel: 'HIGH', aisle: section('VEGETABLES'), categories: ['Produce'] },
    ],
  },
  {
    id: 'cilantro', name: 'fresh cilantro', quantity: '1/4', unit: 'cup', searchTerm: 'cilantro',
    department: 'produce', avoidWords: ['dressing', 'sauce'], raw: '1/4 cup chopped fresh cilantro, for serving',
    statuses: ['unavailable', 'unavailable', 'unavailable'],
    products: [
      { description: 'Fresh Cilantro Bunch', size: '1 bunch', price: 0.99, stockLevel: 'TEMPORARILY_OUT_OF_STOCK', aisle: section('VEGETABLES'), categories: ['Produce'] },
    ],
  },
  {
    id: 'rice', name: 'basmati rice', quantity: '2', unit: 'cups', searchTerm: 'basmati rice',
    department: 'pantry', avoidWords: ['microwave', 'ready'], raw: '2 cups basmati rice, for serving',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Basmati Rice', brand: 'Kroger', size: '2 lb', price: 3.49, stockLevel: 'HIGH', aisle: aisle(4, 'L', 2), categories: ['Pasta, Sauces, Grain'] },
      { description: 'Royal Basmati Rice', brand: 'Royal', size: '2 lb', price: 5.99, promoPrice: 4.99, stockLevel: 'HIGH', aisle: aisle(4, 'L', 3), categories: ['Pasta, Sauces, Grain'] },
      { description: 'Mahatma Jasmine Rice', brand: 'Mahatma', size: '2 lb', price: 3.79, stockLevel: 'HIGH', aisle: aisle(4, 'L', 2), categories: ['Pasta, Sauces, Grain'] },
    ],
  },
  {
    id: 'kasuri-methi', name: 'dried fenugreek leaves', quantity: '1', unit: 'tsp', searchTerm: 'dried fenugreek leaves',
    altTerms: ['kasuri methi'], department: 'international', raw: '1 teaspoon kasuri methi (dried fenugreek leaves), optional',
    statuses: ['no_match', 'no_match', 'no_match'],
    products: [],
  },
  {
    id: 'butter', name: 'unsalted butter', quantity: '2', unit: 'tbsp', searchTerm: 'unsalted butter',
    department: 'dairy', avoidWords: ['spread', 'margarine'], raw: '2 tablespoons unsalted butter',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Unsalted Butter Sticks', brand: 'Kroger', size: '16 oz', price: 4.99, stockLevel: 'HIGH', aisle: section('DAIRY', '0'), categories: ['Dairy'] },
      { description: 'Kerrygold Pure Irish Unsalted Butter', brand: 'Kerrygold', size: '8 oz', price: 4.79, stockLevel: 'HIGH', aisle: section('DAIRY', '0'), categories: ['Dairy'] },
    ],
  },
  {
    id: 'salt', name: 'kosher salt', quantity: '', unit: '', searchTerm: 'kosher salt',
    department: 'spices', isPantryStaple: true, raw: 'Kosher salt, to taste',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: "Diamond Crystal Kosher Salt", brand: 'Diamond Crystal', size: '3 lb', price: 4.29, stockLevel: 'HIGH', aisle: aisle(9, 'R', 1), categories: ['Baking Goods'] },
    ],
  },
  {
    id: 'oil', name: 'vegetable oil', quantity: '2', unit: 'tbsp', searchTerm: 'vegetable oil',
    department: 'pantry', isPantryStaple: true, raw: '2 tablespoons neutral oil',
    statuses: ['found', 'found', 'found'],
    products: [
      { description: 'Kroger® Pure Vegetable Oil', brand: 'Kroger', size: '48 fl oz', price: 4.49, stockLevel: 'HIGH', aisle: aisle(8, 'L', 2), categories: ['Baking Goods'] },
    ],
  },
];

function seedToItem(s: Seed): Item {
  return {
    id: s.id,
    name: s.name,
    quantity: s.quantity,
    unit: s.unit,
    searchTerm: s.searchTerm,
    altTerms: s.altTerms ?? [],
    department: s.department,
    avoidWords: s.avoidWords ?? [],
    isPantryStaple: !!s.isPantryStaple,
    raw: [s.raw],
  };
}

const RECIPE_IMAGE =
  'data:image/svg+xml;utf8,' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#F2A65A"/><stop offset="0.55" stop-color="#D9622B"/><stop offset="1" stop-color="#8E3B1A"/></radialGradient></defs><rect width="800" height="450" fill="#F6EBDD"/><circle cx="400" cy="225" r="190" fill="#FFFFFF"/><circle cx="400" cy="225" r="160" fill="url(#g)"/><circle cx="350" cy="190" r="18" fill="#F7E3C2"/><circle cx="440" cy="250" r="22" fill="#F7E3C2"/><circle cx="380" cy="280" r="15" fill="#F7E3C2"/><circle cx="455" cy="180" r="9" fill="#4E9A3D"/><circle cx="330" cy="250" r="8" fill="#4E9A3D"/><circle cx="410" cy="215" r="7" fill="#4E9A3D"/></svg>';

export const MOCK_RECIPE: RecipeResponse = {
  title: 'Chicken Tikka Masala',
  image: RECIPE_IMAGE,
  sourceUrl: 'https://cooking.nytimes.com/recipes/1021014-chicken-tikka-masala',
  extraction: 'jsonld',
  normalizedBy: 'llm',
  items: SEEDS.map(seedToItem),
};

const STAPLE_RE = /\b(salt|pepper|oil|water|sugar|flour)\b/i;

function itemsFromText(text: string): Item[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean);
  return lines.map((line, i) => {
    const m = line.match(/^([\d½¼¾⅓/.\s-]+)?\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|lb|lbs|pounds?|oz|ounces?|cloves?|cans?)?\s*(.*)$/i);
    const quantity = (m?.[1] ?? '').trim();
    const unit = (m?.[2] ?? '').trim();
    const name = (m?.[3] ?? line).split(',')[0].trim() || line;
    const known = SEEDS.find((s) => name.toLowerCase().includes(s.searchTerm) || s.searchTerm.includes(name.toLowerCase()));
    return {
      id: known?.id ?? `line-${i}`,
      name,
      quantity,
      unit,
      searchTerm: known?.searchTerm ?? name.toLowerCase(),
      altTerms: [],
      department: known?.department ?? 'other',
      avoidWords: [],
      isPantryStaple: STAPLE_RE.test(name),
      raw: [line],
    };
  });
}

export async function mockFetchRecipe(input: { url: string } | { text: string }): Promise<RecipeResponse> {
  await sleep(1100);
  if ('text' in input) {
    const items = itemsFromText(input.text);
    if (!items.length) throw new ApiCallError('Paste at least one ingredient line.', 'no_recipe', 400);
    return { title: 'Your ingredients', extraction: 'text', normalizedBy: 'heuristic', items };
  }
  const url = input.url.trim();
  if (!/^https?:\/\/\S+\.\S+/i.test(url)) throw new ApiCallError("That doesn't look like a recipe link.", 'bad_url', 400);
  if (/allrecipes|seriouseats|foodnetwork|blocked/i.test(url))
    throw new ApiCallError("That site blocks automated readers, so we couldn't open the recipe.", 'blocked', 403);
  if (/no-?recipe|example\.com/i.test(url))
    throw new ApiCallError("We couldn't find an ingredient list on that page.", 'no_recipe', 422);
  return { ...MOCK_RECIPE, sourceUrl: url };
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export const MOCK_STORES: Store[] = [
  {
    id: '70500822', chain: 'QFC', name: 'QFC Broadway Market', address: '417 Broadway E, Seattle, WA 98102',
    lat: 47.6227, lng: -122.3207, distanceMi: 0.2,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=QFC%20417%20Broadway%20E%2C%20Seattle%2C%20WA%2098102',
  },
  {
    id: '70500847', chain: 'QFC', name: 'QFC Harvard Market', address: '1401 Broadway, Seattle, WA 98122',
    lat: 47.6136, lng: -122.3208, distanceMi: 0.5,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=QFC%201401%20Broadway%2C%20Seattle%2C%20WA%2098122',
  },
  {
    id: '70100140', chain: 'FRED MEYER', name: 'Fred Meyer Ballard', address: '915 NW 45th St, Seattle, WA 98107',
    lat: 47.6616, lng: -122.3685, distanceMi: 3.9,
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Fred%20Meyer%20915%20NW%2045th%20St%2C%20Seattle%2C%20WA%2098107',
  },
];

export async function mockFetchStores(loc: { lat: number; lng: number } | { zip: string }): Promise<StoresResponse> {
  await sleep(600);
  if ('zip' in loc) {
    if (loc.zip === '00000') throw new ApiCallError('Unknown ZIP code.', 'bad_zip', 400);
    if (loc.zip === '99999') return { origin: { lat: 0, lng: 0, label: loc.zip }, stores: [] };
    return { origin: { lat: 47.6205, lng: -122.3212, label: `ZIP ${loc.zip}` }, stores: MOCK_STORES };
  }
  return { origin: { lat: loc.lat, lng: loc.lng, label: 'Near you' }, stores: MOCK_STORES };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function genericProducts(term: string): P[] {
  const h = hash(term);
  const title = term.replace(/\b\w/g, (c) => c.toUpperCase());
  const n = 1 + (h % 20);
  const a: Aisle = h % 3 === 0 ? section('GROCERY', '0') : aisle(n, h % 2 ? 'L' : 'R', 1 + (h % 5));
  const price = 1.5 + (h % 600) / 100;
  return [
    { description: `Kroger® ${title}`, brand: 'Kroger', size: `${8 + (h % 24)} oz`, price: Math.round(price * 100) / 100, stockLevel: h % 4 ? 'HIGH' : 'LOW', aisle: a },
    { description: `Simple Truth Organic™ ${title}`, brand: 'Simple Truth Organic', size: `${6 + (h % 12)} oz`, price: Math.round((price + 1.8) * 100) / 100, stockLevel: 'HIGH', aisle: a },
  ];
}

function genericStatuses(term: string): [ItemStatus, ItemStatus, ItemStatus] {
  const r = hash(term) % 10;
  if (r === 0) return ['no_match', 'no_match', 'no_match'];
  if (r === 1 || r === 2) return ['unavailable', 'found', 'found'];
  if (r === 3) return ['unavailable', 'unavailable', 'found'];
  return ['found', 'found', 'found'];
}

export async function mockSearchStore(req: SearchRequest): Promise<SearchResponse> {
  const started = Date.now();
  const storeIdx = Math.max(0, MOCK_STORES.findIndex((s) => s.id === req.storeId));
  await sleep(900 + storeIdx * 250 + req.items.length * 30);
  const results: ItemResult[] = req.items.map((it) => {
    const seed = SEEDS.find((s) => s.id === it.id) ?? SEEDS.find((s) => s.searchTerm === it.searchTerm);
    const status = (seed?.statuses ?? genericStatuses(it.searchTerm))[Math.min(storeIdx, 2)];
    const raw = seed ? seed.products : genericProducts(it.searchTerm);
    // Vary prices slightly per store so the cards differ.
    const candidates = raw.map((p) =>
      product(req.storeId + it.id, {
        ...p,
        price: p.price !== undefined ? Math.round((p.price + storeIdx * 0.2) * 100) / 100 : undefined,
        ...(status === 'unavailable' ? { stockLevel: 'TEMPORARILY_OUT_OF_STOCK' } : {}),
      }),
    );
    if (status === 'no_match') return { itemId: it.id, status, termUsed: it.altTerms[0] ?? it.searchTerm, candidates: [] };
    return { itemId: it.id, status, termUsed: it.searchTerm, best: candidates[0], candidates };
  });
  return { storeId: req.storeId, results, ms: Date.now() - started };
}
