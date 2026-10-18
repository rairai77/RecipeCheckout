/**
 * Home variant B, "Focused card": one centered, elevated form card with two numbered steps
 * (1 Recipe link, 2 Where you shop) and a full-width primary button. All behaviour lives in useHomeForm.
 */
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, shadow, transition, useBreakpoint, web } from '../theme';
import { Button, FadeIn, Logo, pstate } from '../ui';
import { PRESET_SHORT_LABEL, useHomeForm, type LocationMode } from './useHomeForm';

export default function HomeB() {
  const form = useHomeForm();
  const { isPhone, bp } = useBreakpoint();
  const [focus, setFocus] = useState<'url' | 'text' | 'zip' | null>(null);

  const gutter = isPhone ? 16 : 32;
  const zipError = !!form.error && form.locMode === 'zip' && form.zipMissing && /ZIP/.test(form.error);
  const recipeError = form.error && !zipError ? form.error : null;
  const isUrl = form.mode === 'url';
  const ctaLabel = form.loading ? form.loadingSteps[form.loadingStep] : 'Build my grocery list';
  const placeholder = form.isDemo ? 'Demo: just press the button' : 'Paste a recipe link…';

  const segments: { key: LocationMode; label: string; a11y: string; onPress: () => void }[] = [
    { key: 'preset', label: isPhone ? 'Capitol Hill' : PRESET_SHORT_LABEL, a11y: `Shop near ${PRESET_SHORT_LABEL}`, onPress: form.choosePreset },
    { key: 'gps', label: form.locating ? 'Locating…' : 'My location', a11y: 'Use my location', onPress: () => void form.chooseMyLocation() },
    { key: 'zip', label: 'ZIP', a11y: 'Enter a ZIP code', onPress: form.chooseZip },
  ];

  return (
    <View style={styles.page}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.nav, { paddingHorizontal: gutter }]}>
          <Logo />
        </View>

        <View style={[styles.body, { paddingHorizontal: gutter }, isPhone && styles.bodyPhone]}>
          <FadeIn style={styles.column}>
            <Text style={[styles.h1, bp === 'tablet' && styles.h1Tablet, isPhone && styles.h1Phone]} accessibilityRole="header">
              Any recipe,{isPhone ? '\n' : ' '}
              <Text style={styles.h1Accent}>sorted by aisle.</Text>
            </Text>
            <Text style={[styles.lead, isPhone && styles.leadPhone]}>
              Paste a link and we’ll find every ingredient at your nearest QFC or Fred Meyer.
            </Text>
          </FadeIn>

          <FadeIn delay={100} style={styles.column}>
            <View style={[styles.card, isPhone && styles.cardPhone]}>
              {/* Step 1: recipe */}
              <StepLabel n={1} label={isUrl ? 'Recipe link' : 'Ingredients'} nativeID="homeb-step1" />
              {isUrl ? (
                <TextInput
                  style={[
                    styles.input,
                    focus === 'url' && styles.inputFocus,
                    recipeError && styles.inputError,
                    web({ outlineStyle: 'none' }),
                    transition,
                  ]}
                  value={form.url}
                  onChangeText={form.setUrl}
                  onFocus={() => setFocus('url')}
                  onBlur={() => setFocus(null)}
                  placeholder={placeholder}
                  placeholderTextColor={colors.faint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  inputMode="url"
                  returnKeyType="go"
                  onSubmitEditing={() => void form.submit()}
                  editable={!form.loading}
                  accessibilityLabel="Recipe link"
                  aria-invalid={!!recipeError}
                />
              ) : (
                <TextInput
                  style={[
                    styles.input,
                    styles.textarea,
                    focus === 'text' && styles.inputFocus,
                    recipeError && styles.inputError,
                    web({ outlineStyle: 'none' }),
                    transition,
                  ]}
                  value={form.text}
                  onChangeText={form.setText}
                  onFocus={() => setFocus('text')}
                  onBlur={() => setFocus(null)}
                  placeholder={'2 lb chicken thighs\n1 cup plain yogurt\n1 can crushed tomatoes\n…'}
                  placeholderTextColor={colors.faint}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!form.loading}
                  accessibilityLabel="Ingredient list, one per line"
                  aria-invalid={!!recipeError}
                />
              )}
              {recipeError ? <InlineError>{recipeError}</InlineError> : null}

              <View style={styles.underInput}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isUrl ? 'Paste the ingredient list instead of a link' : 'Use a recipe link instead'}
                  onPress={form.toggleMode}
                  disabled={form.loading}
                  style={(s) => [styles.quietLink, pstate(s).hovered && styles.quietLinkHover]}
                >
                  {(s) => (
                    <Text style={[styles.quietLinkText, pstate(s).hovered && { color: colors.accentDark }]}>
                      {isUrl ? 'No link? Paste ingredients instead' : 'Use a recipe link instead'}
                    </Text>
                  )}
                </Pressable>
              </View>
              {form.isMock && !form.isDemo && isUrl ? (
                <Text style={styles.hint}>Mock mode: any link works; one containing “allrecipes” shows the paste fallback.</Text>
              ) : null}

              <View style={styles.divider} />

              {/* Step 2: location */}
              <StepLabel n={2} label="Where you shop" nativeID="homeb-step2" />
              <View style={styles.segmented} accessibilityRole="radiogroup" aria-labelledby="homeb-step2">
                {segments.map((seg) => {
                  const on = form.locMode === seg.key;
                  const busy = seg.key === 'gps' && form.locating;
                  return (
                    <Pressable
                      key={seg.key}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on, busy }}
                      accessibilityLabel={seg.a11y}
                      onPress={seg.onPress}
                      style={(s) => [
                        styles.segment,
                        seg.key === 'preset' && !isPhone && { flex: 1.45 },
                        transition,
                        !on && pstate(s).hovered && styles.segmentHover,
                        on && styles.segmentOn,
                      ]}
                    >
                      {busy ? <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 6 }} /> : null}
                      <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
                        {seg.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {form.locMode === 'zip' ? (
                <View style={styles.zipRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.zipInput,
                      focus === 'zip' && styles.inputFocus,
                      zipError && styles.inputError,
                      web({ outlineStyle: 'none' }),
                      transition,
                    ]}
                    value={form.zip}
                    onChangeText={form.setZip}
                    onFocus={() => setFocus('zip')}
                    onBlur={() => setFocus(null)}
                    placeholder="ZIP code"
                    placeholderTextColor={colors.faint}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={5}
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={() => void form.submit()}
                    accessibilityLabel="5-digit ZIP code"
                    aria-invalid={zipError}
                  />
                </View>
              ) : null}
              {zipError ? <InlineError>{form.error}</InlineError> : null}
              <StoreLine form={form} />

              {/* CTA */}
              <Button
                label={ctaLabel}
                onPress={() => void form.submit()}
                loading={form.loading}
                style={styles.cta}
                accessibilityLabel="Build my grocery list"
              />
              {form.loading ? (
                <View style={styles.progress} accessibilityLiveRegion="polite" accessibilityLabel={ctaLabel}>
                  {form.loadingSteps.map((s, i) => (
                    <View key={s} style={[styles.progressBar, i <= form.loadingStep && styles.progressOn, i === form.loadingStep && styles.pulse]} />
                  ))}
                </View>
              ) : null}
            </View>
          </FadeIn>
        </View>
      </ScrollView>
    </View>
  );
}

function StepLabel({ n, label, nativeID }: { n: number; label: string; nativeID: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepLabel} nativeID={nativeID}>
        {label}
      </Text>
    </View>
  );
}

function InlineError({ children }: { children: ReactNode }) {
  return (
    <View style={styles.errorRow} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <View style={styles.errorDot}>
        <Text style={styles.errorDotText}>!</Text>
      </View>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

/** One quiet line under the location control: nearest store, loading, or a problem. */
function StoreLine({ form }: { form: ReturnType<typeof useHomeForm> }) {
  if (form.locationNotice) return <Text style={[styles.storeLine, { color: colors.warn }]}>{form.locationNotice}</Text>;
  const { stores } = form;
  if (stores.status === 'loading')
    return (
      <View style={[styles.storeRow]}>
        <ActivityIndicator size="small" color={colors.faint} style={{ transform: [{ scale: 0.75 }] }} />
        <Text style={[styles.storeLine, styles.storeLineInline]}>Finding nearby stores…</Text>
      </View>
    );
  if (stores.status === 'ready' && stores.nearest)
    return (
      <Text style={styles.storeLine}>
        Nearest: <Text style={styles.storeName}>{stores.nearest.name}</Text> · {stores.nearest.distanceMi.toFixed(1)} mi
      </Text>
    );
  if (stores.status === 'empty')
    return <Text style={[styles.storeLine, { color: colors.danger }]}>No QFC or Fred Meyer stores found near there. Try another location.</Text>;
  if (stores.status === 'error')
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Retry loading stores" onPress={form.retryStores} style={styles.retry}>
        <Text style={[styles.storeLine, { color: colors.danger, marginTop: 0 }]}>
          Couldn’t load nearby stores. <Text style={{ textDecorationLine: 'underline', fontWeight: '700' }}>Retry</Text>
        </Text>
      </Pressable>
    );
  return null;
}

const CARD_MAX = 560;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  nav: { height: 68, flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 1184, alignSelf: 'center' },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    // Bias the block slightly above true center (balances the nav bar).
    paddingBottom: 84,
  },
  bodyPhone: { justifyContent: 'flex-start', paddingTop: 20, paddingBottom: 40 },
  column: { width: '100%', maxWidth: CARD_MAX },

  h1: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -1.1,
    textAlign: 'center',
  },
  h1Tablet: { fontSize: 42, lineHeight: 48 },
  h1Phone: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  h1Accent: { color: colors.accent, fontStyle: 'italic' },
  lead: {
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
    maxWidth: 440,
    alignSelf: 'center',
  },
  leadPhone: { fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 22, maxWidth: 320 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 32,
    ...shadow.lg,
  },
  cardPhone: { padding: 20, borderRadius: radius.lg + 2 },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800', color: colors.accentDark, lineHeight: 16 },
  stepLabel: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.ink, letterSpacing: -0.1 },

  input: {
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingHorizontal: 18,
    fontSize: 18,
    fontFamily: fonts.body,
    color: colors.text,
  },
  textarea: { minHeight: 168, paddingTop: 14, paddingBottom: 14, fontSize: 16, lineHeight: 24 },
  inputFocus: {
    borderColor: colors.accentBright,
    backgroundColor: '#fff',
    ...web({ boxShadow: '0 0 0 4px rgba(46,158,98,0.15)' }),
  },
  inputError: { borderColor: colors.danger, ...web({ boxShadow: '0 0 0 4px rgba(185,56,21,0.10)' }) },

  underInput: { flexDirection: 'row', justifyContent: 'flex-end' },
  quietLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 2, borderRadius: radius.sm },
  quietLinkHover: { opacity: 1 },
  quietLinkText: {
    fontFamily: fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
    textDecorationLine: 'underline',
    ...web({ textDecorationColor: colors.borderStrong, textUnderlineOffset: '3px' }),
  },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.faint, marginTop: -4, textAlign: 'right' },

  divider: { height: 1, backgroundColor: colors.border, marginTop: 8, marginBottom: 22 },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  segmentHover: { backgroundColor: 'rgba(255,255,255,0.55)' },
  segmentOn: { backgroundColor: '#fff', ...shadow.sm, ...web({ boxShadow: '0 1px 2px rgba(29,42,33,0.08), 0 2px 8px -2px rgba(29,42,33,0.12)' }) },
  segmentText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.muted },
  segmentTextOn: { color: colors.ink, fontWeight: '700' },

  zipRow: { marginTop: 12 },
  zipInput: { maxWidth: 200 },

  storeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, minHeight: 20 },
  storeLine: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.faint, marginTop: 12 },
  storeLineInline: { marginTop: 0, marginLeft: 4 },
  storeName: { color: colors.muted, fontWeight: '700' },
  retry: { minHeight: 44, justifyContent: 'center', marginTop: 2 },

  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  errorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  errorDotText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14, fontFamily: fonts.body },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.danger, fontWeight: '600' },

  cta: { marginTop: 28, minHeight: 58, borderRadius: radius.md },
  progress: { flexDirection: 'row', gap: 6, marginTop: 14 },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  progressOn: { backgroundColor: colors.accentBright },
  pulse: web({
    animationKeyframes: [{ '0%': { opacity: 1 }, '50%': { opacity: 0.4 }, '100%': { opacity: 1 } }],
    animationDuration: '1.1s',
    animationIterationCount: 'infinite',
  }),
});
