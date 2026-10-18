import type { Product, Store } from '../../shared/types';

/** What a retailer's data can actually tell the shopper. Aisles are the point of the app. */
export interface ProviderCapabilities {
  /** per-store aisle or section location for each product */
  aisles: boolean;
  /** per-store stock signal (in stock / low / out) */
  stock: boolean;
  /** prices are specific to the chosen store, not national */
  storePricing: boolean;
}

export interface GroceryProvider {
  /** short key, also used in EXPERIMENTAL_PROVIDERS */
  id: string;
  chain: string;
  capabilities: ProviderCapabilities;
  /** true when a Store.id came from this provider (ids are namespaced per provider) */
  ownsStoreId(storeId: string): boolean;
  nearestStores(lat: number, lng: number, limit: number): Promise<Store[]>;
  searchProducts(term: string, storeId: string, limit?: number): Promise<Product[]>;
}

/** "Price/stock only" retailers have no aisle data; the UI should say so rather than show "Aisle unknown" everywhere. */
export function isPriceOnly(p: Pick<GroceryProvider, 'capabilities'>): boolean {
  return !p.capabilities.aisles;
}
