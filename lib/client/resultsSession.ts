// sessionStorage mirror of what the shopper changed on /results (swaps, skips, one-stop choice), so a refresh keeps it.
// Keyed by the recipe, the selected items and the stores' location, so a different list never inherits old choices.

const KEY = 'recipecheckout:results';

export type ResultsChoices = {
  picks: Record<string, string>;
  skipped: Record<string, boolean>;
  /** store id when the shopper chose "all at one store" */
  oneStop: string | null;
};

export const NO_CHOICES: ResultsChoices = { picks: {}, skipped: {}, oneStop: null };

export function readChoices(key: string): ResultsChoices {
  try {
    if (typeof window === 'undefined') return NO_CHOICES;
    const raw = window.sessionStorage?.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as { key?: string } & Partial<ResultsChoices>) : null;
    if (!v || v.key !== key) return NO_CHOICES;
    return {
      picks: v.picks && typeof v.picks === 'object' ? v.picks : {},
      skipped: v.skipped && typeof v.skipped === 'object' ? v.skipped : {},
      oneStop: typeof v.oneStop === 'string' ? v.oneStop : null,
    };
  } catch {
    return NO_CHOICES;
  }
}

export function writeChoices(key: string, c: ResultsChoices): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage?.setItem(KEY, JSON.stringify({ key, ...c }));
  } catch {
    // private mode or quota: choices just won't survive a refresh
  }
}
