import type { Product, Store } from '../../shared/types';
import { krogerProvider } from './kroger';
import type { GroceryProvider } from './types';
import { wholeFoodsProvider } from './wholefoods';

/**
 * Provider registry. Kroger is always on; anything else is opt-in through EXPERIMENTAL_PROVIDERS (comma list, e.g.
 * "wholefoods"). With the variable unset, every function here behaves exactly like calling lib/server/kroger directly.
 */
const EXPERIMENTAL: Record<string, GroceryProvider> = {
  wholefoods: wholeFoodsProvider,
};

type Env = Record<string, string | undefined>;

export function enabledProviders(env: Env = process.env): GroceryProvider[] {
  const keys = (env.EXPERIMENTAL_PROVIDERS ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const extra = keys.map((k) => EXPERIMENTAL[k]).filter((p): p is GroceryProvider => !!p);
  return [krogerProvider, ...extra.filter((p, i) => extra.indexOf(p) === i)];
}

export function providerForStoreId(storeId: string, providers: GroceryProvider[] = enabledProviders()): GroceryProvider {
  // fall back to Kroger so a disabled provider's id fails the same way any unknown id does today
  return providers.find((p) => p.id !== 'kroger' && p.ownsStoreId(storeId)) ?? krogerProvider;
}

/** Kroger's nearest `limit` stores, plus up to 2 nearby stores from each enabled experimental provider. */
export async function nearestStoresFrom(providers: GroceryProvider[], lat: number, lng: number, limit = 3): Promise<Store[]> {
  const [primary, ...rest] = providers;
  const base = await primary.nearestStores(lat, lng, limit);
  const extra = await Promise.all(
    rest.map((p) =>
      p.nearestStores(lat, lng, 2).catch((err: Error) => {
        console.error(`${p.id} store lookup failed:`, err.message);
        return [] as Store[];
      }),
    ),
  );
  if (extra.every((e) => e.length === 0)) return base;
  return [...base, ...extra.flat()].sort((a, b) => a.distanceMi - b.distanceMi);
}

export function nearestStores(lat: number, lng: number, limit = 3): Promise<Store[]> {
  return nearestStoresFrom(enabledProviders(), lat, lng, limit);
}

export function searchProducts(term: string, storeId: string, limit?: number): Promise<Product[]> {
  return providerForStoreId(storeId).searchProducts(term, storeId, limit);
}
