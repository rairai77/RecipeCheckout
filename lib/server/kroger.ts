import type { Aisle, Product, Store } from '../shared/types';
import { haversineMiles } from '../shared/haversine';

const BASE = 'https://api.kroger.com/v1';

let tokenCache: { token: string; expiresAt: number } | undefined;
let tokenPromise: Promise<string> | undefined;

export async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const id = process.env.KR_ID;
    const secret = process.env.KR_SECRET;
    if (!id || !secret) throw new Error('Kroger credentials are not configured');
    const res = await fetch(`${BASE}/connect/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials&scope=product.compact',
    });
    if (!res.ok) throw new Error(`Kroger token request failed: HTTP ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 120) * 1000 };
    return json.access_token;
  })();
  try {
    return await tokenPromise;
  } finally {
    tokenPromise = undefined;
  }
}

async function krogerGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const token = await getToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return res.json();
    lastStatus = res.status;
    if (res.status === 401) tokenCache = undefined;
    // Kroger's gateway sporadically answers 403/429/5xx under bursts; back off and retry.
    if (![401, 403, 429, 500, 502, 503, 504].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 250 * 2 ** attempt + Math.random() * 200));
  }
  throw new Error(`Kroger ${path} failed: HTTP ${lastStatus}`);
}

// ---------- Locations ----------

const CHAIN_NAMES: Record<string, string> = {
  QFC: 'QFC',
  FRED: 'Fred Meyer',
  FREDMEYER: 'Fred Meyer',
  KROGER: 'Kroger',
  RALPHS: 'Ralphs',
  KINGSOOPERS: 'King Soopers',
  SMITHS: "Smith's",
  FRYS: "Fry's",
  HART: 'Harris Teeter',
  HARRISTEETER: 'Harris Teeter',
  DILLONS: 'Dillons',
  CITYMARKET: 'City Market',
  MARIANOS: "Mariano's",
  PICKNSAVE: "Pick 'n Save",
  METROMARKET: 'Metro Market',
  FOODSCO: 'Food 4 Less',
  FOOD4LESS: 'Food 4 Less',
  BAKERS: "Baker's",
  GERBES: 'Gerbes',
  JAYC: 'JayC',
  PAYLESS: 'Pay Less',
  RULER: 'Ruler Foods',
};

const storeCache = new Map<string, { at: number; stores: Store[] }>();

export async function nearestStores(lat: number, lng: number, limit = 3): Promise<Store[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = storeCache.get(key);
  let stores: Store[];
  if (cached && Date.now() - cached.at < 6 * 3600_000) {
    stores = cached.stores;
  } else {
    let data: any[] = [];
    for (const radius of ['10', '30']) {
      const json = await krogerGet('/locations', {
        'filter.lat.near': String(lat),
        'filter.lon.near': String(lng),
        'filter.radiusInMiles': radius,
        'filter.limit': '15',
      });
      data = json?.data ?? [];
      if (data.length > 0) break;
    }
    stores = data
      .filter((l) => l?.geolocation && l.chain && !/FUEL|PHARM|JEWEL/i.test(`${l.chain} ${l.name}`))
      .map((l): Store => {
        const a = l.address ?? {};
        const sLat = Number(l.geolocation.latitude);
        const sLng = Number(l.geolocation.longitude);
        const address = [titleCase(a.addressLine1 ?? ''), a.city ? titleCase(a.city) : '', a.state].filter(Boolean).join(', ');
        const chain = CHAIN_NAMES[String(l.chain).toUpperCase().replace(/[^A-Z0-9]/g, '')] ?? titleCase(String(l.chain));
        return {
          id: String(l.locationId),
          chain,
          name: shortStoreName(String(l.name ?? chain), chain),
          address,
          lat: sLat,
          lng: sLng,
          distanceMi: 0,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${l.name} ${address}`)}`,
        };
      });
    storeCache.set(key, { at: Date.now(), stores });
  }
  return stores
    .map((s) => ({ ...s, distanceMi: Math.round(haversineMiles(lat, lng, s.lat, s.lng) * 10) / 10 }))
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .slice(0, limit);
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

function shortStoreName(name: string, chain: string): string {
  // "QFC Quality Food Center - Broadway Market" -> "QFC Broadway Market"
  const parts = name.split(' - ');
  return parts.length > 1 ? `${chain} ${parts.slice(1).join(' - ')}` : name;
}

// ---------- Products ----------

function mapAisle(a: any): Aisle | undefined {
  if (!a) return undefined;
  const n = a.number != null ? String(a.number) : undefined;
  const num = n ? parseInt(n, 10) : NaN;
  const desc = String(a.description ?? '').trim();
  const isNumbered = Number.isFinite(num) && num >= 1 && num <= 99 && /^AISLE\b/i.test(desc || 'AISLE');
  return {
    label: desc || (n ? `Aisle ${n}` : 'Unknown'),
    number: n,
    side: a.side || undefined,
    shelf: a.shelfNumber || undefined,
    bay: a.bayNumber || undefined,
    isNumbered,
  };
}

function pickImage(images: any[] | undefined): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const img = images.find((i) => i.featured) ?? images[0];
  const sizes: any[] = img?.sizes ?? [];
  return (sizes.find((s) => s.size === 'medium') ?? sizes.find((s) => s.size === 'small') ?? sizes[0])?.url;
}

export function mapProduct(p: any): Product {
  const item = (p.items ?? [])[0] ?? {};
  const price = item.price ?? {};
  return {
    productId: String(p.productId),
    description: String(p.description ?? ''),
    brand: p.brand || undefined,
    size: item.size || undefined,
    price: typeof price.regular === 'number' && price.regular > 0 ? price.regular : undefined,
    promoPrice: typeof price.promo === 'number' && price.promo > 0 && price.promo < price.regular ? price.promo : undefined,
    stockLevel: item.inventory?.stockLevel || undefined,
    inStore: item.fulfillment?.inStore,
    aisle: mapAisle((p.aisleLocations ?? [])[0]),
    image: pickImage(p.images),
    categories: Array.isArray(p.categories) ? p.categories : [],
    url: p.productPageURI ? `https://www.kroger.com${String(p.productPageURI).split('?')[0]}` : undefined,
  };
}

const productCache = new Map<string, { at: number; products: Product[] }>();

export async function searchProducts(term: string, locationId: string, limit = 12): Promise<Product[]> {
  const key = `${locationId}|${term}`;
  const cached = productCache.get(key);
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.products;
  const json = await krogerGet('/products', {
    'filter.term': term.length < 3 ? `${term}  `.slice(0, 3) : term.slice(0, 100),
    'filter.locationId': locationId,
    'filter.limit': String(limit),
  });
  const products = ((json?.data ?? []) as any[]).map(mapProduct);
  productCache.set(key, { at: Date.now(), products });
  return products;
}
