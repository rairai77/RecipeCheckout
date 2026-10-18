import { haversineMiles } from '../../shared/haversine';
import type { Product, Store } from '../../shared/types';
import type { GroceryProvider } from './types';

/**
 * PROTOTYPE, off by default (EXPERIMENTAL_PROVIDERS=wholefoods). Whole Foods Market via the JSON endpoint its own
 * search page calls: GET /api/search?text=&store=<storeCode>. Verified from a Vercel function (iad1) on 2026-10-18 with
 * a plain fetch: HTTP 200 in ~0.2-0.5 s, no bot challenge, robots.txt allows everything.
 *
 * PRICE ONLY: the response has store-scoped regular/sale prices, but no aisle, no stock level and no category.
 * Before shipping, read the Amazon.com Conditions of Use (incorporated by WFM's): they bar "data mining, robots, or
 * similar data gathering and extraction tools". See /mnt/project-files/plan/retailer-scraping.md.
 */

const BASE = 'https://www.wholefoodsmarket.com';
const ID_PREFIX = 'wfm_';

const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export interface WfmStore {
  code: string;
  slug: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Seed list read from the stores' own pages (/stores/<slug>) on 2026-10-18. No zip-to-store endpoint was found that
 * works without a session, so a real rollout would build this table from the store sitemap + parseStorePage().
 */
export const SEATTLE_STORES: WfmStore[] = [
  { code: '10216', slug: 'westlake', name: 'Westlake', address: '2210 Westlake Ave, Seattle, WA', lat: 47.618403, lng: -122.338189 },
  { code: '10275', slug: 'interbay', name: 'Interbay', address: '2001 15th Ave W, Seattle, WA', lat: 47.637163, lng: -122.376859 },
];

/** Pulls store code, name, address and coordinates out of a /stores/<slug> page. */
export function parseStorePage(html: string): WfmStore | undefined {
  const geo = html.match(
    /"locationName":"([^"]+)".*?"geocode":\{"latitude":(-?[\d.]+),"longitude":(-?[\d.]+)\},"address":\{"addressLines":\["([^"]+)"\],"city":"([^"]+)","state":"(\w+)"/s,
  );
  const code = html.match(/"wholeFoodsMarketFolder":"([^"]+)","storeCode":"(\d+)"/);
  if (!geo || !code) return undefined;
  const [, name, lat, lng, line1, city, state] = geo;
  return { code: code[2], slug: code[1], name, address: `${titleCase(line1)}, ${city}, ${state}`, lat: Number(lat), lng: Number(lng) };
}

function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()) : s;
}

export function toStore(s: WfmStore, originLat: number, originLng: number): Store {
  return {
    id: `${ID_PREFIX}${s.code}`,
    chain: 'Whole Foods Market',
    name: `Whole Foods ${s.name}`,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    distanceMi: Math.round(haversineMiles(originLat, originLng, s.lat, s.lng) * 10) / 10,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Whole Foods Market ${s.address}`)}`,
  };
}

const SIZE = /,\s*((?:\d+(?:\.\d+)?|\d+\/\d+)\s*(?:fl\.?\s*oz|oz|lbs?|ct|count|g|kg|ml|l|ea|each|pack|pk)\b.*)$/i;

/** "Organic Unsalted Butter, 8 OZ" -> { name: "Organic Unsalted Butter", size: "8 oz" } */
export function splitSize(name: string): { name: string; size?: string } {
  const m = name.match(SIZE);
  if (!m) return { name: name.trim() };
  return { name: name.slice(0, m.index).trim(), size: m[1].replace(/\s+/g, ' ').toLowerCase() };
}

export interface WfmSearchResult {
  name: string;
  slug: string;
  brand?: string;
  regularPrice?: number;
  salePrice?: number;
  /** Prime-member price; ignored because we can't know the shopper is a member */
  incrementalSalePrice?: number;
  imageThumbnail?: string;
  store?: number;
  isLocal?: boolean;
}

export function mapWfmProduct(r: WfmSearchResult): Product {
  const { name, size } = splitSize(r.name);
  const brand = r.brand?.trim() || undefined;
  const description = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
  const regular = typeof r.regularPrice === 'number' && r.regularPrice > 0 ? r.regularPrice : undefined;
  const sale = typeof r.salePrice === 'number' && regular && r.salePrice > 0 && r.salePrice < regular ? r.salePrice : undefined;
  return {
    productId: r.slug,
    description,
    brand,
    size,
    price: regular,
    promoPrice: sale,
    // no stock or aisle data in this source: leave undefined so the matcher treats priced items as available
    image: r.imageThumbnail,
    categories: [],
    url: `${BASE}/product/${r.slug}`,
  };
}

export function storeCode(storeId: string): string | undefined {
  const m = storeId.match(/^wfm_(\d{5})$/);
  return m?.[1];
}

export function createWholeFoodsProvider(opts: { fetch?: typeof fetch; stores?: WfmStore[] } = {}): GroceryProvider {
  const doFetch = opts.fetch ?? fetch;
  const stores = opts.stores ?? SEATTLE_STORES;
  const cache = new Map<string, { at: number; products: Product[] }>();
  return {
    id: 'wholefoods',
    chain: 'Whole Foods Market',
    capabilities: { aisles: false, stock: false, storePricing: true },
    ownsStoreId: (storeId) => storeCode(storeId) != null,
    async nearestStores(lat, lng, limit) {
      return stores
        .map((s) => toStore(s, lat, lng))
        .filter((s) => s.distanceMi <= 15)
        .sort((a, b) => a.distanceMi - b.distanceMi)
        .slice(0, limit);
    },
    async searchProducts(term, storeId, limit = 12) {
      const code = storeCode(storeId);
      if (!code) throw new Error(`Not a Whole Foods store id: ${storeId}`);
      const key = `${code}|${term}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < 30 * 60_000) return hit.products;
      const url = new URL(`${BASE}/api/search`);
      url.searchParams.set('text', term.slice(0, 80));
      url.searchParams.set('store', code);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', '0');
      const res = await doFetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Whole Foods search failed: HTTP ${res.status}`);
      const json = (await res.json()) as { results?: WfmSearchResult[] };
      const products = (json.results ?? []).filter((r) => r?.slug && r?.name).map(mapWfmProduct);
      cache.set(key, { at: Date.now(), products });
      return products;
    },
  };
}

export const wholeFoodsProvider = createWholeFoodsProvider();
