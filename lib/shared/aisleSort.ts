import type { Aisle } from './types';

/** Numbered aisles first (ascending), then named sections alphabetically, unknown last. */
export function aisleSortKey(aisle?: Aisle): [number, number, string] {
  if (!aisle) return [2, 0, ''];
  if (aisle.isNumbered && aisle.number) return [0, parseInt(aisle.number, 10), aisle.side ?? ''];
  return [1, 0, aisle.label];
}

export function compareAisles(a?: Aisle, b?: Aisle): number {
  const ka = aisleSortKey(a);
  const kb = aisleSortKey(b);
  for (let i = 0; i < 3; i++) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

export function formatAisle(aisle?: Aisle): string {
  if (!aisle) return 'Aisle unknown';
  if (aisle.isNumbered) {
    const parts = [`Aisle ${aisle.number}`];
    if (aisle.side) parts.push(aisle.side === 'L' ? 'left' : aisle.side === 'R' ? 'right' : aisle.side);
    if (aisle.shelf) parts.push(`shelf ${aisle.shelf}`);
    return parts.join(' · ');
  }
  const label = aisle.label
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+\d+$/, '');
  return label;
}
