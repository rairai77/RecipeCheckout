/**
 * Small shared building blocks for the home variants. All optional; variants may roll their own.
 * - HomeShell: full-height page with the logo top-left and a vertically centered body.
 * - LocationControl: compact "📍 Seattle · Capitol Hill ▾" trigger that opens a popover with preset / my location / ZIP.
 * - LoadingSteps: the 3-step "Reading recipe…" progress row.
 * - PasteBox: multiline ingredient box for the paste fallback.
 */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, shadow, transition, useBreakpoint, web } from '../theme';
import { Logo, pstate } from '../ui';
import { PRESET_SHORT_LABEL, type HomeForm } from './useHomeForm';

export function HomeShell({
  children,
  background,
  lightNav,
  below,
}: {
  children: ReactNode;
  /** Absolutely positioned layer behind the first screen (e.g. a photo). */
  background?: ReactNode;
  lightNav?: boolean;
  /** Content below the first screen (scrolls). */
  below?: ReactNode;
}) {
  const { isPhone } = useBreakpoint();
  const gutter = isPhone ? 16 : 32;
  return (
    <View style={styles.page}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.first, web({ minHeight: '100dvh' })]}>
          {background}
          <View style={[styles.nav, { paddingHorizontal: gutter }]}>
            <Logo light={lightNav} />
          </View>
          <View style={[styles.center, { paddingHorizontal: gutter }]}>{children}</View>
        </View>
        {below}
      </ScrollView>
    </View>
  );
}

const OPTIONS = [
  { key: 'preset', icon: '🏙️', label: PRESET_SHORT_LABEL },
  { key: 'gps', icon: '📍', label: 'Use my location' },
  { key: 'zip', icon: '🔢', label: 'ZIP code' },
] as const;

/** Compact location trigger + popover. Place it near the input; wrap siblings below it are overlapped by the popover. */
export function LocationControl({
  form,
  tone = 'dark',
  align = 'center',
  style,
}: {
  form: HomeForm;
  tone?: 'dark' | 'light';
  align?: 'center' | 'left';
  style?: StyleProp<ViewStyle>;
}) {
  const [open, setOpen] = useState(false);
  const light = tone === 'light';

  const pick = (k: (typeof OPTIONS)[number]['key']) => {
    if (k === 'preset') {
      form.choosePreset();
      setOpen(false);
    } else if (k === 'gps') {
      setOpen(false);
      form.chooseMyLocation();
    } else {
      form.chooseZip();
    }
  };

  return (
    <View style={[styles.locWrap, open && { zIndex: 50 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Shopping near ${form.locationLabel}. Change location`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={(s) => [
          styles.trigger,
          transition,
          pstate(s).hovered && { backgroundColor: light ? 'rgba(255,255,255,0.14)' : colors.accentTint },
          open && { backgroundColor: light ? 'rgba(255,255,255,0.18)' : colors.accentSoft },
        ]}
      >
        {form.locating ? <ActivityIndicator size="small" color={light ? '#fff' : colors.accent} style={{ marginRight: 6 }} /> : <Text style={styles.triggerIcon}>📍</Text>}
        <Text style={[styles.triggerText, light && { color: '#fff' }]}>{form.locationLabel}</Text>
        <Text style={[styles.caret, light && { color: 'rgba(255,255,255,0.8)' }]}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open ? (
        <>
          <Pressable
            accessibilityLabel="Close location menu"
            onPress={() => setOpen(false)}
            style={[StyleSheet.absoluteFill, web({ position: 'fixed', inset: 0 })]}
          />
          <View style={[styles.popover, align === 'center' ? web({ left: '50%', transform: 'translateX(-50%)' }) : { left: 0 }]} accessibilityRole="radiogroup">
            <Text style={styles.popTitle}>Shopping near</Text>
            {OPTIONS.map((o) => {
              const on = form.locMode === o.key;
              return (
                <Pressable
                  key={o.key}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.label}
                  onPress={() => pick(o.key)}
                  style={(s) => [styles.opt, transition, on && styles.optOn, pstate(s).hovered && !on && { backgroundColor: colors.bg }]}
                >
                  <Text style={styles.optIcon}>{o.icon}</Text>
                  <Text style={[styles.optText, on && { color: colors.accentDark }]}>{o.label}</Text>
                  {on ? <Text style={styles.optCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
            {form.locMode === 'zip' ? (
              <TextInput
                style={[styles.zip, web({ outlineStyle: 'none' })]}
                value={form.zip}
                onChangeText={(v) => {
                  form.setZip(v);
                  if (v.replace(/\D/g, '').length === 5) setOpen(false);
                }}
                placeholder="5-digit ZIP"
                placeholderTextColor={colors.faint}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={5}
                autoFocus
                accessibilityLabel="Enter ZIP code"
              />
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Location problems worth a line of text (denied permission, half-typed ZIP, no stores nearby). */
export function locationHint(form: HomeForm): string | null {
  if (form.locationNotice) return form.locationNotice;
  if (form.stores.status === 'empty') return 'No QFC, Fred Meyer or other Kroger-family stores near there.';
  if (form.stores.status === 'error') return "Couldn't reach the store finder; we'll retry when you search.";
  return null;
}

export function LoadingSteps({
  form,
  tone = 'dark',
  center = true,
  compact,
}: {
  form: HomeForm;
  tone?: 'dark' | 'light';
  center?: boolean;
  /** Only the current step, with a 3-segment progress bar. */
  compact?: boolean;
}) {
  if (!form.loading) return null;
  const light = tone === 'light';
  if (compact) {
    return (
      <View style={[styles.compact, center && { alignItems: 'center' }]} accessibilityLiveRegion="polite">
        <View style={styles.segs}>
          {form.loadingSteps.map((s, i) => (
            <View
              key={s}
              style={[
                styles.seg,
                { backgroundColor: i <= form.loadingStep ? (light ? '#9FE0B8' : colors.accentBright) : light ? 'rgba(255,255,255,0.3)' : colors.border },
                i === form.loadingStep && styles.segPulse,
              ]}
            />
          ))}
        </View>
        <Text style={[styles.stepText, { color: light ? '#fff' : colors.muted }]}>{form.loadingSteps[form.loadingStep]}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.steps, center && { justifyContent: 'center' }]} accessibilityLiveRegion="polite">
      {form.loadingSteps.map((s, i) => {
        const on = i <= form.loadingStep;
        return (
          <View key={s} style={[styles.step, !on && { opacity: 0.55 }]}>
            <View style={[styles.dot, { backgroundColor: on ? (light ? '#9FE0B8' : colors.accentBright) : light ? 'rgba(255,255,255,0.4)' : colors.borderStrong }, i === form.loadingStep && styles.pulse]} />
            <Text style={[styles.stepText, { color: light ? '#fff' : on ? colors.text : colors.muted }]}>{s}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function PasteBox({ form, style, minHeight = 180 }: { form: HomeForm; style?: StyleProp<ViewStyle>; minHeight?: number }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[styles.paste, { minHeight }, focused && styles.pasteFocus, web({ outlineStyle: 'none' }), transition, style]}
      value={form.text}
      onChangeText={form.setText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={'2 lb chicken thighs\n1 cup plain yogurt\n1 can crushed tomatoes\n…'}
      placeholderTextColor={colors.faint}
      multiline
      numberOfLines={7}
      textAlignVertical="top"
      editable={!form.loading}
      autoFocus
      accessibilityLabel="Ingredient list"
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  first: { flexGrow: 1, minHeight: 560 },
  nav: { height: 68, flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 68, zIndex: 3 },
  locWrap: { position: 'relative', zIndex: 10, alignItems: 'center' },
  trigger: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, borderRadius: radius.pill },
  triggerIcon: { fontSize: 14, marginRight: 6 },
  triggerText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text },
  caret: { fontSize: 11, marginLeft: 6, color: colors.muted },
  popover: {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    width: 280,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    ...shadow.lg,
  },
  popTitle: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 4 },
  opt: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 10, borderRadius: radius.sm },
  optOn: { backgroundColor: colors.accentSoft },
  optIcon: { fontSize: 15, width: 26 },
  optText: { flex: 1, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', color: colors.text },
  optCheck: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  zip: {
    marginTop: 6,
    marginHorizontal: 2,
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  steps: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 6 },
  compact: { gap: 8 },
  segs: { flexDirection: 'row', gap: 4 },
  seg: { width: 28, height: 4, borderRadius: 2 },
  segPulse: web({
    animationKeyframes: [{ '0%': { opacity: 1 }, '50%': { opacity: 0.4 }, '100%': { opacity: 1 } }],
    animationDuration: '1s',
    animationIterationCount: 'infinite',
  }),
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stepText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600' },
  pulse: web({
    animationKeyframes: [{ '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.6)' }, '100%': { transform: 'scale(1)' } }],
    animationDuration: '1s',
    animationIterationCount: 'infinite',
  }),
  paste: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: '#fff',
    padding: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  pasteFocus: { borderColor: colors.accentBright, ...web({ boxShadow: '0 0 0 4px rgba(46,158,98,0.15)' }) },
});
