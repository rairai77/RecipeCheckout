import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, shadow, transition, useBreakpoint, web } from './theme';

type PState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };
/** Pressable state incl. the web-only `hovered` flag react-native-web passes. */
export const pstate = (s: PressableStateCallbackType) => s as PState;

/** Full-height page: scrollable centered column, optional sticky bottom bar. */
export function Page({
  children,
  footer,
  maxWidth = 1120,
  top,
}: {
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
  /** Full-bleed content above the column (e.g. a banner). */
  top?: ReactNode;
}) {
  const { isPhone } = useBreakpoint();
  const gutter = isPhone ? 16 : 32;
  return (
    <View style={styles.page}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: footer ? 24 : 56 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.column, { maxWidth: maxWidth + gutter * 2, paddingHorizontal: gutter }]}>
          <NavBar compact={isPhone} />
        </View>
        {top ? <View style={[styles.column, { maxWidth: maxWidth + gutter * 2, paddingHorizontal: isPhone ? 0 : gutter }]}>{top}</View> : null}
        <View style={[styles.column, { maxWidth: maxWidth + gutter * 2, paddingHorizontal: gutter }]}>{children}</View>
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, web({ backdropFilter: 'saturate(1.4) blur(12px)' })]}>
          <View style={[styles.column, { maxWidth: maxWidth + gutter * 2, paddingHorizontal: gutter }]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function NavBar({ compact }: { compact?: boolean } = {}) {
  return (
    <View style={[styles.nav, compact && { height: 54 }]}>
      <Logo size={compact ? 30 : 34} />
    </View>
  );
}

export function Logo({ size = 34, light }: { size?: number; light?: boolean }) {
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logoMark, { width: size, height: size, borderRadius: size * 0.3 }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.logoLine}>
            <View style={[styles.logoDot, i === 0 && { backgroundColor: colors.saffron }]} />
            <View style={[styles.logoBar, { width: size * (i === 1 ? 0.32 : 0.42) }]} />
          </View>
        ))}
      </View>
      <Text style={[styles.wordmark, { fontSize: Math.round(size * 0.65) }, light && { color: '#fff' }]}>
        Recipe<Text style={{ color: light ? '#9FE0B8' : colors.accent }}>Checkout</Text>
      </Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'light';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
  icon?: string;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, style, small, icon, accessibilityLabel }: ButtonProps) {
  const isDisabled = disabled || loading;
  const fg = variant === 'primary' ? '#fff' : variant === 'light' ? colors.text : colors.accentDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={(s) => {
        const { pressed, hovered } = pstate(s);
        return [
          styles.btn,
          small && styles.btnSmall,
          variant === 'primary' && styles.btnPrimary,
          variant === 'secondary' && styles.btnSecondary,
          variant === 'ghost' && styles.btnGhost,
          variant === 'light' && styles.btnLight,
          transition,
          hovered && !isDisabled && variant === 'primary' && { backgroundColor: colors.accentDark },
          hovered && !isDisabled && variant !== 'primary' && { backgroundColor: variant === 'light' ? '#fff' : '#D9EBDF' },
          hovered && !isDisabled && web({ transform: 'translateY(-1px)' }),
          pressed && !isDisabled && web({ transform: 'translateY(0px) scale(0.98)' }),
          isDisabled && !loading && styles.btnDisabled,
          style,
        ];
      }}
    >
      {loading ? <ActivityIndicator size="small" color={fg} style={{ marginRight: 10 }} /> : icon ? <Text style={[styles.btnIcon, { color: fg }]}>{icon}</Text> : null}
      <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Checkbox({ checked, size = 24 }: { checked: boolean; size?: number }) {
  return (
    <View style={[styles.checkbox, { width: size, height: size, borderRadius: size * 0.3 }, checked && styles.checkboxOn, transition]}>
      {checked ? <Text style={[styles.checkmark, { fontSize: size * 0.6, lineHeight: size * 0.75 }]}>✓</Text> : null}
    </View>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'warn'; children: ReactNode }) {
  const bg = tone === 'error' ? colors.dangerSoft : tone === 'warn' ? colors.warnSoft : colors.accentSoft;
  const fg = tone === 'error' ? colors.danger : tone === 'warn' ? colors.warn : colors.accentDark;
  const icon = tone === 'error' ? '⚠️' : tone === 'warn' ? '💡' : 'ℹ️';
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Text style={styles.noticeIcon}>{icon}</Text>
      <Text style={[styles.noticeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function BackLink({ label, onPress, light }: { label: string; onPress: () => void; light?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={(s) => [styles.back, light && styles.backLight, transition, pstate(s).hovered && { backgroundColor: light ? 'rgba(14,24,18,0.55)' : colors.accentSoft }]}
    >
      <Text style={[styles.backText, light && { color: '#fff' }]}>← {label}</Text>
    </Pressable>
  );
}

export function Pill({ children, tone = 'neutral', style }: { children: ReactNode; tone?: 'neutral' | 'green' | 'saffron' | 'light'; style?: StyleProp<ViewStyle> }) {
  const map = {
    neutral: [colors.bgDeep, colors.muted],
    green: [colors.accentSoft, colors.accentDark],
    saffron: [colors.saffronSoft, colors.warn],
    light: ['rgba(255,255,255,0.2)', '#fff'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

/** Small entrance animation: fade + rise. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Pulsing placeholder block (CSS animation on web). */
export function Skeleton({ width, height = 12, radius: r = 6, style }: { width: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width, height, borderRadius: r, backgroundColor: '#EDE7DC' }, styles.pulse, style]} />;
}

export function Spinner({ color = colors.accent }: { color?: string }) {
  return <ActivityIndicator size="small" color={color} />;
}

export const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg,
    // Short entrance so the switch from the dark home to the light pages feels intended; content is visible from frame 1.
    ...web({
      animationKeyframes: [{ '0%': { opacity: 0.4 }, '100%': { opacity: 1 } }],
      animationDuration: '180ms',
      animationTimingFunction: 'ease-out',
    }),
  },
  scroll: { flex: 1 },
  column: { width: '100%', alignSelf: 'center' },
  nav: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', gap: 3, ...shadow.sm },
  logoLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  logoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  logoBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.92)' },
  wordmark: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.text, letterSpacing: -0.4 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(251,247,240,0.92)',
    paddingVertical: 12,
    ...web({ boxShadow: '0 -8px 24px -12px rgba(29,42,33,0.18)' }),
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.md,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: radius.md,
  },
  btnSmall: { minHeight: 44, paddingHorizontal: 14, borderRadius: radius.sm },
  btnPrimary: { backgroundColor: colors.accent, ...web({ boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 6px 16px -6px rgba(31,122,77,0.55)' }) },
  btnSecondary: { backgroundColor: colors.accentSoft },
  btnGhost: { backgroundColor: 'transparent' },
  btnLight: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  btnTextSmall: { fontSize: 14 },
  btnIcon: { fontSize: 16, marginRight: 8 },
  checkbox: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: '#fff', fontWeight: '800' },
  notice: { flexDirection: 'row', borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14, gap: 10 },
  noticeIcon: { fontSize: 16, lineHeight: 21 },
  noticeText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, flex: 1, fontWeight: '500' },
  back: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  backLight: { backgroundColor: 'rgba(14,24,18,0.38)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', ...web({ backdropFilter: 'blur(8px)' }) },
  backText: { fontFamily: fonts.body, color: colors.accentDark, fontSize: 14, fontWeight: '700' },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700' },
  pulse: web({
    animationKeyframes: [{ '0%': { opacity: 1 }, '50%': { opacity: 0.45 }, '100%': { opacity: 1 } }],
    animationDuration: '1.4s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  }),
});
