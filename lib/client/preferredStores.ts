// The shopper's preferred stores, in their order, kept in localStorage (so they last across visits).
// They rank above proximity when picking where to shop (see lib/shared/plan.ts). Nothing here is chain-specific: a
// store from another retailer is saved the same way, keyed by its id and labelled by its `chain`.
import { useSyncExternalStore } from 'react';
import type { Store } from '../shared/types';
import { clientMode } from './mock';

export type SavedStore = Pick<Store, 'id' | 'chain' | 'name' | 'address' | 'lat' | 'lng'> & { mapsUrl?: string };

/** Adding one more than this replaces the last in the order. */
export const MAX_PREFERRED = 5;

// Mock mode has made-up store ids, so it keeps its own list; the demo replay uses real stores and shares the live list.
const storageKey = () => (clientMode() === 'mock' ? 'recipecheckout:stores:mock' : 'recipecheckout:stores');

const EMPTY: SavedStore[] = [];
let cache: { key: string; list: SavedStore[] } | null = null;
const listeners = new Set<() => void>();

function isSaved(v: unknown): v is SavedStore {
  const o = v as Record<string, unknown> | null;
  return (
    !!o &&
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.chain === 'string' &&
    typeof o.address === 'string' &&
    typeof o.lat === 'number' &&
    typeof o.lng === 'number' &&
    Number.isFinite(o.lat) &&
    Number.isFinite(o.lng)
  );
}

function readStorage(key: string): SavedStore[] {
  try {
    if (typeof window === 'undefined') return EMPTY;
    const raw = window.localStorage?.getItem(key);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(v)) return EMPTY;
    const seen = new Set<string>();
    return v.filter((s): s is SavedStore => isSaved(s) && !seen.has(s.id) && !!seen.add(s.id)).slice(0, MAX_PREFERRED);
  } catch {
    return EMPTY;
  }
}

/** The preferred stores, first = most preferred. Same array until it changes (safe for useSyncExternalStore). */
export function getPreferred(): SavedStore[] {
  const key = storageKey();
  if (!cache || cache.key !== key) cache = { key, list: readStorage(key) };
  return cache.list;
}

function setPreferred(list: SavedStore[]): void {
  const key = storageKey();
  cache = { key, list };
  try {
    if (typeof window !== 'undefined') window.localStorage?.setItem(key, JSON.stringify(list));
  } catch {
    // private mode or quota: the choice still holds for this page
  }
  listeners.forEach((l) => l());
}

function toSaved(s: Store | SavedStore): SavedStore {
  return { id: s.id, chain: s.chain, name: s.name, address: s.address, lat: s.lat, lng: s.lng, ...(s.mapsUrl ? { mapsUrl: s.mapsUrl } : {}) };
}

export function isPreferred(id: string): boolean {
  return getPreferred().some((s) => s.id === id);
}

/** Star / unstar a store. A new one goes last in the order. */
export function togglePreferred(store: Store | SavedStore): void {
  const list = getPreferred();
  if (list.some((s) => s.id === store.id)) setPreferred(list.filter((s) => s.id !== store.id));
  else setPreferred([...list.slice(0, MAX_PREFERRED - 1), toSaved(store)]);
}

export function removePreferred(id: string): void {
  setPreferred(getPreferred().filter((s) => s.id !== id));
}

/** Move a store one place up (-1) or down (+1) in the order. */
export function movePreferred(id: string, delta: -1 | 1): void {
  const list = [...getPreferred()];
  const i = list.findIndex((s) => s.id === id);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  setPreferred(list);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the list.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== storageKey()) return;
    cache = null;
    listener();
  };
  if (typeof window !== 'undefined') window.addEventListener?.('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener?.('storage', onStorage);
  };
}

export function usePreferredStores(): SavedStore[] {
  return useSyncExternalStore(subscribe, getPreferred, () => EMPTY);
}

/** A Maps link for a saved store that came without one. */
export function mapsUrlFor(s: SavedStore): string {
  return s.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.address}`)}`;
}
