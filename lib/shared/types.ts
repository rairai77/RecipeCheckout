export type Department =
  | 'produce'
  | 'meat'
  | 'seafood'
  | 'dairy'
  | 'eggs'
  | 'bakery'
  | 'spices'
  | 'baking'
  | 'pantry'
  | 'condiments'
  | 'international'
  | 'frozen'
  | 'beverages'
  | 'deli'
  | 'other';

export interface Item {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  searchTerm: string;
  altTerms: string[];
  department: Department;
  avoidWords: string[];
  isPantryStaple: boolean;
  raw: string[];
}

export interface RecipeResponse {
  title: string;
  image?: string;
  sourceUrl?: string;
  extraction: 'jsonld' | 'selectors' | 'llm' | 'text';
  normalizedBy: 'llm' | 'heuristic';
  items: Item[];
}

export interface Store {
  id: string;
  chain: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceMi: number;
  mapsUrl: string;
}

export interface StoresResponse {
  origin: { lat: number; lng: number; label: string };
  stores: Store[];
}

export interface Aisle {
  label: string;
  number?: string;
  side?: string;
  shelf?: string;
  bay?: string;
  /** true when this is a real numbered aisle (1-99), false for sections like VEGETABLES or MEAT */
  isNumbered: boolean;
}

export interface Product {
  productId: string;
  description: string;
  brand?: string;
  size?: string;
  price?: number;
  promoPrice?: number;
  stockLevel?: string;
  inStore?: boolean;
  aisle?: Aisle;
  image?: string;
  categories: string[];
  url?: string;
}

export type ItemStatus = 'found' | 'unavailable' | 'no_match';

export interface ItemResult {
  itemId: string;
  status: ItemStatus;
  termUsed: string;
  best?: Product;
  candidates: Product[];
}

export interface SearchRequest {
  storeId: string;
  items: Pick<Item, 'id' | 'name' | 'searchTerm' | 'altTerms' | 'department' | 'avoidWords'>[];
}

export interface SearchResponse {
  storeId: string;
  results: ItemResult[];
  ms: number;
}

export interface ApiError {
  error: string;
  code?: string;
}
