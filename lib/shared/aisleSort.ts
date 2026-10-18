import type { Aisle } from './types';

/** Produce sections ("VEGETABLES", "PRODUCE", "FRUIT"...): most stores put them by the entrance. */
export function isProduceAisle(aisle?: Aisle): boolean {
  return !!aisle && !aisle.isNumbered && /VEG|PRODUCE|FRUIT|SALAD|HERB/i.test(aisle.label);
}

/** Walking order: produce first (by the entrance), then numbered aisles ascending, then other sections, unknown last. */
export function aisleSortKey(aisle?: Aisle): [number, number, string] {
  if (!aisle) return [3, 0, ''];
  if (isProduceAisle(aisle)) return [0, 0, aisle.label];
  if (aisle.isNumbered && aisle.number) return [1, parseInt(aisle.number, 10), aisle.side ?? ''];
  return [2, 0, aisle.label];
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

/** Heading for a group of items in the same aisle or section: "Produce", "Aisle 9", "Meat". */
export function aisleGroupName(aisle?: Aisle): string {
  if (isProduceAisle(aisle)) return 'Produce';
  if (aisle?.isNumbered && aisle.number) return `Aisle ${aisle.number}`;
  return aisle ? formatAisle(aisle) : 'Aisle unknown';
}
