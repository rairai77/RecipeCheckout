/**
 * The ONLY URLs the probe can reach. Callers pick a retailer key + template kind and pass validated
 * params ({q} search term, {store} digits, {zip} 5 digits, {id} short alnum); they never pass a URL.
 */
export interface Template {
  url: string;
  method?: 'GET' | 'POST';
  /** POST body with the same placeholders; values are JSON-escaped */
  body?: string;
  headers?: Record<string, string>;
}

export interface Retailer {
  label: string;
  templates: Record<string, Template>;
  /** XHR/fetch URLs matching this are captured (bodies) in browser mode */
  capture?: RegExp;
}

const SAFEWAY_SEARCH_KEY = '5e790236c84e46338f4290aa1050cdd4';
const TARGET_KEY = '9f36aeafbe60771e321a7cc95a78140772ab3e96';
const TARGET_VISITOR = '0192E4B1C7A80201A5C0D3F0B1E4A7C2';

export const RETAILERS: Record<string, Retailer> = {
  example: {
    label: 'example.com (browser timing baseline)',
    templates: { home: { url: 'https://example.com/' } },
  },
  safeway: {
    label: 'Safeway / Albertsons',
    capture: /pgmsearch|search\/products|productsearch|aisle|product-details/i,
    templates: {
      robots: { url: 'https://www.safeway.com/robots.txt' },
      home: { url: 'https://www.safeway.com/' },
      search: { url: 'https://www.safeway.com/shop/search-results.html?q={q}' },
      product: { url: 'https://www.safeway.com/shop/product-details.{id}.html' },
      // public web key, embedded in every safeway.com page as apimProgramSubscriptionKey
      api: {
        url: 'https://www.safeway.com/abs/pub/xapi/pgmsearch/v1/search/products?request-id=1792345000000&url=https://www.safeway.com&pageurl=https://www.safeway.com&pagename=search&rows=12&start=0&search-type=keyword&storeid={store}&featured=false&q={q}&sort=&dvid=web-4.1search&channel=instore&banner=safeway',
        headers: { 'ocp-apim-subscription-key': SAFEWAY_SEARCH_KEY, Accept: 'application/json' },
      },
      stores: { url: 'https://www.safeway.com/abs/pub/xapi/storeresolver/zipcodetoshopping?zipcode={zip}' },
      stores2: { url: 'https://local.safeway.com/search.html?q={zip}' },
    },
  },
  target: {
    label: 'Target',
    capture: /redsky|plp_search|fulfillment|nearby_stores|pdp_client/i,
    templates: {
      robots: { url: 'https://www.target.com/robots.txt' },
      // www.target.com/s? (search) is robots-disallowed, so no search-page template; product pages are allowed
      apiRobots: { url: 'https://redsky.target.com/robots.txt' },
      home: { url: 'https://www.target.com/' },
      page: { url: 'https://www.target.com/p/-/A-{id}' },
      stores: {
        url: `https://redsky.target.com/redsky_aggregations/v1/web/nearby_stores_v1?limit=5&within=25&place={zip}&key=${TARGET_KEY}&channel=WEB&page=%2Fs%2F{q}`,
      },
      api: {
        url: `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2?key=${TARGET_KEY}&channel=WEB&count=12&default_purchasability_filter=true&include_sponsored=false&keyword={q}&offset=0&page=%2Fs%2F{q}&platform=desktop&pricing_store_id={store}&store_ids={store}&visitor_id=${TARGET_VISITOR}&zip={zip}`,
      },
      product: {
        url: `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1?key=${TARGET_KEY}&tcin={id}&is_bot=false&store_id={store}&pricing_store_id={store}&has_pricing_store_id=true&has_financing_options=false&include_obsolete=true&visitor_id=${TARGET_VISITOR}&skip_personalized=true&skip_variation_hierarchy=true&channel=WEB&page=%2Fp%2FA-{id}`,
      },
      fulfillment: {
        url: `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_v1?key=${TARGET_KEY}&is_bot=false&tcin={id}&store_id={store}&zip={zip}&state=WA&required_store_id={store}&has_required_store_id=true&scheduled_delivery_store_id={store}&paid_membership=false&base_membership=false&card_membership=false&visitor_id=${TARGET_VISITOR}&channel=WEB&page=%2Fp%2FA-{id}`,
      },
    },
  },
  walmart: {
    label: 'Walmart',
    capture: /orchestra|graphql|search/i,
    templates: {
      robots: { url: 'https://www.walmart.com/robots.txt' },
      home: { url: 'https://www.walmart.com/' },
      // /search and /api/ are robots-disallowed; only product pages (/ip/) are probed
      page: { url: 'https://www.walmart.com/ip/{id}' },
    },
  },
  wholefoods: {
    label: 'Whole Foods Market',
    capture: /\/api\//i,
    templates: {
      robots: { url: 'https://www.wholefoodsmarket.com/robots.txt' },
      home: { url: 'https://www.wholefoodsmarket.com/' },
      search: { url: 'https://www.wholefoodsmarket.com/search?text={q}' },
      api: { url: 'https://www.wholefoodsmarket.com/api/search?text={q}&store={store}&limit=12&offset=0' },
      stores: { url: 'https://www.wholefoodsmarket.com/stores' },
      storepage: { url: 'https://www.wholefoodsmarket.com/stores/{id}' },
      product: { url: 'https://www.wholefoodsmarket.com/product/{id}' },
    },
  },
  traderjoes: {
    label: "Trader Joe's",
    capture: /graphql/i,
    templates: {
      robots: { url: 'https://www.traderjoes.com/robots.txt' },
      home: { url: 'https://www.traderjoes.com/home' },
      terms: { url: 'https://www.traderjoes.com/home/terms-of-use' },
      search: { url: 'https://www.traderjoes.com/home/search?q={q}&section=products&global=yes' },
      api: {
        url: 'https://www.traderjoes.com/api/graphql',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: '{"operationName":"SearchProducts","variables":{"storeCode":"{store}","availability":"1","published":"1","search":"{q}","currentPage":1,"pageSize":12},"query":"query SearchProducts($search: String, $pageSize: Int, $currentPage: Int, $storeCode: String = \\"701\\", $availability: String = \\"1\\", $published: String = \\"1\\") { products(search: $search, filter: {store_code: {eq: $storeCode}, published: {eq: $published}, availability: {match: $availability}}, pageSize: $pageSize, currentPage: $currentPage) { items { sku item_title sales_size sales_uom_description retail_price availability } total_count } }"}',
      },
    },
  },
  pcc: {
    label: 'PCC Community Markets',
    capture: /api|graphql|search/i,
    templates: {
      robots: { url: 'https://www.pccmarkets.com/robots.txt' },
      home: { url: 'https://www.pccmarkets.com/' },
      shop: { url: 'https://www.pccmarkets.com/shop/' },
    },
  },
  uwajimaya: {
    label: 'Uwajimaya',
    capture: /api|graphql|search/i,
    templates: {
      robots: { url: 'https://www.uwajimaya.com/robots.txt' },
      home: { url: 'https://www.uwajimaya.com/' },
      search: { url: 'https://www.uwajimaya.com/?s={q}' },
    },
  },
  instacart: {
    label: 'Instacart marketplace',
    capture: /graphql/i,
    templates: {
      // robots.txt is "User-Agent: * Disallow: /" for non-search bots, so only robots.txt is probed
      robots: { url: 'https://www.instacart.com/robots.txt' },
    },
  },
};

export interface Params {
  q: string;
  store: string;
  zip: string;
  id: string;
}

const VALID: Record<keyof Params, RegExp> = {
  q: /^[a-zA-Z0-9 '\-]{1,40}$/,
  store: /^\d{1,6}$/,
  zip: /^\d{5}$/,
  id: /^[a-zA-Z0-9\-]{1,80}$/,
};

export function readParams(sp: URLSearchParams): Params | string {
  const p: Params = {
    q: sp.get('q') ?? 'milk',
    store: sp.get('store') ?? '0',
    zip: sp.get('zip') ?? '98101',
    id: sp.get('id') ?? '0',
  };
  for (const k of Object.keys(VALID) as (keyof Params)[]) if (!VALID[k].test(p[k])) return `bad param ${k}`;
  return p;
}

export function fill(t: Template, p: Params): { url: string; init: RequestInit } {
  const sub = (s: string, enc: (v: string) => string) =>
    s.replace(/\{(q|store|zip|id)\}/g, (_, k: keyof Params) => enc(p[k]));
  const url = sub(t.url, encodeURIComponent);
  const init: RequestInit = { method: t.method ?? 'GET', headers: t.headers };
  if (t.body) init.body = sub(t.body, (v) => JSON.stringify(v).slice(1, -1));
  return { url, init };
}
