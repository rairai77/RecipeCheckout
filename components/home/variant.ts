export type HomeVariant = 'a' | 'b' | 'c';

const KEY = 'recipecheckout:home';
let cached: HomeVariant | undefined;

/** `?home=a|b|c` picks the home page design; remembered in sessionStorage for the tab. Default 'a'. */
export function getHomeVariant(): HomeVariant {
  if (cached) return cached;
  let v: HomeVariant = 'a';
  if (typeof window !== 'undefined' && window.location) {
    try {
      const p = new URLSearchParams(window.location.search).get('home')?.toLowerCase();
      if (p === 'a' || p === 'b' || p === 'c') {
        v = p;
        window.sessionStorage?.setItem(KEY, p);
      } else {
        const s = window.sessionStorage?.getItem(KEY);
        if (s === 'a' || s === 'b' || s === 'c') v = s;
      }
    } catch {
      // sessionStorage can throw in private mode; ignore.
    }
  }
  cached = v;
  return v;
}
