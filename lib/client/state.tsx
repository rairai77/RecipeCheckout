import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { RecipeResponse, StoresResponse } from '../shared/types';
import { locationKey, toStoresQuery, type UserLocation } from './location';
import { client, clientMode, presetLocation } from './mock';

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

/** Cache key for a location's stores; includes the data source so replay and live stores never mix. */
export function storesKey(loc: UserLocation): string {
  return `${clientMode()}|${locationKey(loc)}`;
}

// ---- sessionStorage mirror, so a refresh on /review or /results doesn't lose the flow ----

const SESSION_KEY = 'recipecheckout:state';

type Saved = {
  recipe?: RecipeResponse | null;
  selectedIds?: string[];
  location?: UserLocation;
  stores?: [string, StoresResponse][];
};

function readSaved(): Saved {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.sessionStorage?.getItem(SESSION_KEY);
    const v = raw ? (JSON.parse(raw) as Saved) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function writeSaved(v: Saved): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage?.setItem(SESSION_KEY, JSON.stringify(v));
  } catch {
    // quota or private mode: the app still works, it just won't survive a refresh
  }
}

function isLocation(v: unknown): v is UserLocation {
  const o = v as Record<string, unknown> | null;
  return !!o && typeof o.label === 'string' && (typeof o.zip === 'string' || (typeof o.lat === 'number' && typeof o.lng === 'number'));
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const saved = useRef<Saved | null>(null);
  if (saved.current === null) saved.current = readSaved();
  const s = saved.current;

  const [recipe, setRecipeState] = useState<RecipeResponse | null>(() => (s.recipe && Array.isArray(s.recipe.items) ? s.recipe : null));
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (Array.isArray(s.selectedIds) ? s.selectedIds.filter((x) => typeof x === 'string') : []));
  const [location, setLocationState] = useState<UserLocation>(() => (isLocation(s.location) ? s.location : presetLocation()));
  const cache = useRef(new Map<string, StoresResponse>(Array.isArray(s.stores) ? s.stores : []));
  const [stores, setStores] = useState<StoresState>(() => {
    const key = storesKey(location);
    const data = cache.current.get(key);
    return data ? { status: 'ready', key, data } : { status: 'idle' };
  });
  const inflight = useRef(new Map<string, Promise<StoresResponse>>());
  const locationRef = useRef(location);

  useEffect(() => {
    writeSaved({ recipe, selectedIds, location, stores: [...cache.current.entries()].slice(-6) });
  }, [recipe, selectedIds, location, stores]);

  const setRecipe = useCallback((r: RecipeResponse | null) => {
    setRecipeState(r);
    setSelectedIds(r ? r.items.filter((i) => !i.isPantryStaple).map((i) => i.id) : []);
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const loadStores = useCallback((loc?: UserLocation) => {
    const target = loc ?? locationRef.current;
    const key = storesKey(target);
    const isCurrent = () => storesKey(locationRef.current) === key;
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
