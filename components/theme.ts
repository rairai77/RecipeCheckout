import { Platform, useWindowDimensions, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  bg: '#FBF7F0', // warm off-white
  bgDeep: '#F4EEE3',
  card: '#FFFFFF',
  text: '#1D2A21',
  muted: '#5E6A60',
  faint: '#646E66', // 5.3:1 on white, ≥4.9:1 on the cream and tint backgrounds
  border: '#ECE5D8',
  borderStrong: '#DCD3C3',
  accent: '#1F7A4D',
  accentBright: '#2E9E62',
  accentDark: '#155C39',
  accentSoft: '#E6F2EA',
  accentTint: '#F2F8F3',
  tomato: '#D9472B',
  tomatoSoft: '#FCEBE5',
  saffron: '#E9A23B',
  saffronSoft: '#FBF0DC',
  danger: '#B93815',
  dangerSoft: '#FDEDE7',
  warn: '#8A5A00',
  warnSoft: '#FBF1DC',
  sign: '#1E6B47', // highway-sign green
  overlay: 'rgba(29,42,33,0.04)',
  ink: '#14201A',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

/** Fonts are injected at runtime on web (see app/_layout.tsx); fall back to system fonts elsewhere. */
export const fonts = {
  display: Platform.select({ web: '"Fraunces", Georgia, "Times New Roman", serif', default: undefined }),
  body: Platform.select({
    web: '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    default: undefined,
  }),
};

export const type = {
  display: { fontFamily: fonts.display, fontWeight: '700', color: colors.text, letterSpacing: -0.5 } as TextStyle,
  body: { fontFamily: fonts.body, color: colors.text } as TextStyle,
};

/** Style that only applies on web (CSS-only props like boxShadow strings, transitions, sticky). */
export function web(style: Record<string, unknown>): ViewStyle {
  return (Platform.OS === 'web' ? style : {}) as ViewStyle;
}

export const shadow = {
  sm: web({ boxShadow: '0 1px 2px rgba(29,42,33,0.06), 0 1px 1px rgba(29,42,33,0.04)' }),
  md: web({ boxShadow: '0 1px 2px rgba(29,42,33,0.05), 0 8px 24px -8px rgba(29,42,33,0.12)' }),
  lg: web({ boxShadow: '0 2px 4px rgba(29,42,33,0.04), 0 24px 48px -16px rgba(29,42,33,0.22)' }),
};

export const transition = web({
  transitionProperty: 'background-color, border-color, box-shadow, transform, opacity',
  transitionDuration: '160ms',
  transitionTimingFunction: 'ease-out',
});

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export function useBreakpoint(): { bp: Breakpoint; width: number; isPhone: boolean; isDesktop: boolean } {
  const { width } = useWindowDimensions();
  const bp: Breakpoint = width < 640 ? 'phone' : width < 1024 ? 'tablet' : 'desktop';
  return { bp, width, isPhone: bp === 'phone', isDesktop: bp === 'desktop' };
}

/** Chain brand-ish colors for store headers. */
export function chainColor(chain: string): { bg: string; soft: string; initials: string } {
  const c = chain.toUpperCase();
  if (c.includes('QFC') || c.includes('QUALITY FOOD')) return { bg: '#C8202F', soft: '#FBE8EA', initials: 'QFC' };
  if (c.includes('FRED')) return { bg: '#0B5CAB', soft: '#E6EFFA', initials: 'FM' };
  if (c.includes('RALPHS')) return { bg: '#D52B1E', soft: '#FCE9E7', initials: 'R' };
  if (c.includes('KROGER')) return { bg: '#134A9C', soft: '#E7EEF8', initials: 'K' };
  return { bg: colors.accent, soft: colors.accentSoft, initials: c.replace(/[^A-Z]/g, '').slice(0, 2) || '•' };
}
