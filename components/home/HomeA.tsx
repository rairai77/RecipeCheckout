import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, transition, useBreakpoint, web } from '../theme';
import { Button, FadeIn, Notice, pstate } from '../ui';
import { HomeShell, LoadingSteps, LocationControl, locationHint, PasteBox } from './shared';
import { useHomeForm } from './useHomeForm';

/** Variant A, "search engine": a headline and one big pill input, vertically centered. Almost nothing else. */
export default function HomeA() {
  const form = useHomeForm();
  const { isPhone } = useBreakpoint();
  const [focused, setFocused] = useState(false);
  const hint = locationHint(form);

  return (
    <HomeShell background={<View style={styles.glow} pointerEvents="none" />}>
      <View style={[styles.block, { marginBottom: isPhone ? 72 : 110 }]}>
        <FadeIn>
          <Text style={[styles.h1, isPhone && styles.h1Phone]} accessibilityRole="header">
            What are we <Text style={styles.accent}>cooking?</Text>
          </Text>
          <Text style={[styles.sub, isPhone && { fontSize: 16 }]}>Paste a recipe, get a list sorted by aisle.</Text>
        </FadeIn>

        {form.error ? (
          <View style={styles.errorWrap}>
            <Notice tone="error">{form.error}</Notice>
          </View>
        ) : null}

        {form.mode === 'url' ? (
          <View style={[styles.pill, isPhone && styles.pillPhone, focused && styles.pillFocus, transition]}>
            <Text style={[styles.icon, isPhone && { marginLeft: 16 }]}>🔗</Text>
            <TextInput
              style={[styles.input, isPhone && { fontSize: 16 }, web({ outlineStyle: 'none' })]}
              value={form.url}
              onChangeText={form.setUrl}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={form.urlPlaceholder}
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              returnKeyType="go"
              onSubmitEditing={form.submit}
              editable={!form.loading}
              autoFocus={!isPhone}
              accessibilityLabel="Recipe URL"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Build my shopping list"
              accessibilityState={{ busy: form.loading }}
              disabled={form.loading}
              onPress={form.submit}
              style={(s) => [
                styles.go,
                isPhone && styles.goPhone,
                transition,
                pstate(s).hovered && !form.loading && { backgroundColor: colors.accentDark },
                pstate(s).pressed && web({ transform: 'scale(0.97)' }),
              ]}
            >
              {form.loading ? <ActivityIndicator size="small" color="#fff" /> : null}
              {isPhone ? (
                form.loading ? null : <Text style={styles.goArrow}>→</Text>
              ) : (
                <Text style={[styles.goText, form.loading && { marginLeft: 8 }]}>{form.loading ? 'Reading…' : 'Get my list'}</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.pasteWrap}>
            <PasteBox form={form} minHeight={isPhone ? 200 : 220} style={styles.pasteBox} />
            <Button
              label={form.loading ? 'Reading recipe…' : 'Build my shopping list'}
              onPress={form.submit}
              loading={form.loading}
              style={[styles.pasteBtn, isPhone && { alignSelf: 'stretch' }]}
            />
          </View>
        )}

        <View style={styles.under}>
          <LocationControl form={form} />
          <Text style={styles.sep}>·</Text>
          <Pressable
            accessibilityRole="button"
            onPress={form.toggleMode}
            style={(s) => [styles.link, transition, pstate(s).hovered && { backgroundColor: colors.accentTint }]}
          >
            <Text style={styles.linkText}>
              {form.mode === 'url' ? (isPhone ? 'Paste ingredients' : 'Paste ingredients instead') : isPhone ? 'Use a link' : 'Use a recipe link instead'}
            </Text>
          </Pressable>
        </View>

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <View style={styles.loading}>
          <LoadingSteps form={form} compact />
        </View>
      </View>
    </HomeShell>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    ...web({
      backgroundImage:
        'radial-gradient(ellipse 60% 45% at 50% 46%, rgba(46,158,98,0.07) 0%, rgba(46,158,98,0) 72%), radial-gradient(ellipse 40% 30% at 62% 38%, rgba(233,162,59,0.09) 0%, rgba(233,162,59,0) 72%)',
    }),
  },
  block: { width: '100%', maxWidth: 680, alignItems: 'center' },
  h1: {
    fontFamily: fonts.display,
    fontSize: 60,
    lineHeight: 66,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -1.6,
    textAlign: 'center',
  },
  h1Phone: { fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  accent: { color: colors.accent, fontStyle: 'italic' },
  sub: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, color: colors.muted, textAlign: 'center', marginTop: 12, marginBottom: 32 },
  errorWrap: { width: '100%', maxWidth: 640 },
  pill: {
    width: '100%',
    maxWidth: 640,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...web({ boxShadow: '0 1px 2px rgba(29,42,33,0.05), 0 12px 32px -12px rgba(29,42,33,0.22)' }),
  },
  pillPhone: { height: 60 },
  pillFocus: { borderColor: colors.accentBright, ...web({ boxShadow: '0 0 0 5px rgba(46,158,98,0.14), 0 12px 32px -12px rgba(29,42,33,0.22)' }) },
  icon: { fontSize: 18, marginLeft: 24, marginRight: 10 },
  input: { flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.body, fontSize: 18, color: colors.text },
  go: {
    height: 48,
    marginRight: 7,
    marginLeft: 8,
    paddingHorizontal: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 132,
  },
  goPhone: { width: 46, height: 46, minWidth: 46, paddingHorizontal: 0, marginRight: 6 },
  goText: { fontFamily: fonts.body, fontSize: 16, fontWeight: '800', color: '#fff' },
  goArrow: { fontFamily: fonts.body, fontSize: 22, fontWeight: '800', color: '#fff', marginTop: -2 },
  pasteWrap: { width: '100%', maxWidth: 640 },
  pasteBox: { borderRadius: 24, ...web({ boxShadow: '0 12px 32px -12px rgba(29,42,33,0.22)' }) },
  pasteBtn: { alignSelf: 'flex-end', marginTop: 12, minWidth: 240, borderRadius: radius.pill },
  under: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, zIndex: 10 },
  sep: { color: colors.faint, marginHorizontal: 0, fontSize: 16 },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill },
  linkText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.accentDark },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.warn, textAlign: 'center', marginTop: 4, maxWidth: 520 },
  loading: { marginTop: 18, minHeight: 20, width: '100%' },
});
