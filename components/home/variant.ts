export type HomeVariant = 'a' | 'b' | 'c' | 'ca' | 'cb' | 'cc';
const VARIANTS: readonly string[] = ['a', 'b', 'c', 'ca', 'cb', 'cc'];

const KEY = 'recipecheckout:home';
let cached: HomeVariant | undefined;

/** `?home=a|b|c|ca|cb|cc` picks the home page design; remembered in sessionStorage for the tab. Default 'a'. */
export function getHomeVariant(): HomeVariant {
  if (cached) return cached;
  let v: HomeVariant = 'a';
  if (typeof window !== 'undefined' && window.location) {
    try {
      const p = new URLSearchParams(window.location.search).get('home')?.toLowerCase();
      if (p && VARIANTS.includes(p)) {
        v = p as HomeVariant;
        window.sessionStorage?.setItem(KEY, p);
      } else {
        const s = window.sessionStorage?.getItem(KEY);
        if (s && VARIANTS.includes(s)) v = s as HomeVariant;
      }
    } catch {
      // sessionStorage can throw in private mode; ignore.
    }
  }
  cached = v;
  return v;
}
