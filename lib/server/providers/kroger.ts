import { nearestStores, searchProducts } from '../kroger';
import type { GroceryProvider } from './types';

/** The official Kroger API (QFC, Fred Meyer, ...): price, stock and per-store aisle locations. */
export const krogerProvider: GroceryProvider = {
  id: 'kroger',
  chain: 'Kroger family',
  capabilities: { aisles: true, stock: true, storePricing: true },
  // Kroger location ids are 8-digit numbers, e.g. "70100123"
  ownsStoreId: (storeId) => /^\d{5,12}$/.test(storeId),
  nearestStores,
  searchProducts,
};
