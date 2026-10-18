import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RecipeResponse, StoresResponse } from '../shared/types';
import { locationKey, SEATTLE_PRESET, toStoresQuery, type UserLocation } from './location';
import { client } from './mock';

export type StoresState =
  | { status: 'idle' }
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; data: StoresResponse }
  | { status: 'error'; key: string; message: string };

type AppState = {
  recipe: RecipeResponse | null;
  selectedIds: string[];
  location: UserLocation;
  stores: StoresState;
  /** Sets the recipe and selects every non-staple item. */
  setRecipe: (r: RecipeResponse | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  setLocation: (loc: UserLocation) => void;
  /** Fetch stores for the current (or given) location; deduped and cached per location. */
  loadStores: (loc?: UserLocation) => Promise<StoresResponse>;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [recipe, setRecipeState] = useState<RecipeResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [location, setLocationState] = useState<UserLocation>(SEATTLE_PRESET);
  const [stores, setStores] = useState<StoresState>({ status: 'idle' });
  const inflight = useRef(new Map<string, Promise<StoresResponse>>());
  const cache = useRef(new Map<string, StoresResponse>());
  const locationRef = useRef(location);

  const setRecipe = useCallback((r: RecipeResponse | null) => {
    setRecipeState(r);
    setSelectedIds(r ? r.items.filter((i) => !i.isPantryStaple).map((i) => i.id) : []);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const loadStores = useCallback((loc?: UserLocation) => {
    const target = loc ?? locationRef.current;
    const key = locationKey(target);
    const isCurrent = () => locationKey(locationRef.current) === key;
    const cached = cache.current.get(key);
    if (cached) {
      if (isCurrent()) setStores({ status: 'ready', key, data: cached });
      return Promise.resolve(cached);
    }
    const existing = inflight.current.get(key);
    if (existing) return existing;
    if (isCurrent()) setStores({ status: 'loading', key });
    const p = client
      .fetchStores(toStoresQuery(target))
      .then((data) => {
        cache.current.set(key, data);
        if (isCurrent()) setStores({ status: 'ready', key, data });
        return data;
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (isCurrent()) setStores({ status: 'error', key, message });
        throw e;
      })
      .finally(() => inflight.current.delete(key));
    inflight.current.set(key, p);
    return p;
  }, []);

  const setLocation = useCallback(
    (loc: UserLocation) => {
      locationRef.current = loc;
      setLocationState(loc);
      // Fetch in the background: also prewarms the serverless function + Kroger token.
      loadStores(loc).catch(() => {});
    },
    [loadStores],
  );

  const value = useMemo<AppState>(
    () => ({ recipe, selectedIds, location, stores, setRecipe, setSelectedIds, toggleSelected, setLocation, loadStores }),
    [recipe, selectedIds, location, stores, setRecipe, toggleSelected, setLocation, loadStores],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside <AppStateProvider>');
  return v;
}
