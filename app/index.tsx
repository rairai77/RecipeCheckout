import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LocationPicker, type LocationMode } from '../components/LocationPicker';
import { PreviewCard } from '../components/PreviewCard';
import { colors, fonts, radius, shadow, transition, useBreakpoint, web } from '../components/theme';
import { Button, FadeIn, Notice, Page, pstate } from '../components/ui';
import { ApiCallError } from '../lib/client/api';
import { isValidZip, SEATTLE_PRESET } from '../lib/client/location';
import { client, isDemoMode, isMockMode } from '../lib/client/mock';
import { useAppState } from '../lib/client/state';

/** Error codes where the right move is "paste the ingredients instead". */
const PASTE_FALLBACK_CODES = new Set(['blocked', 'no_recipe', 'not_found', 'network']);

const LOADING_STEPS = ['Reading recipe…', 'Finding the ingredient list…', 'Turning lines into grocery searches…'];

const STEPS = [
  { emoji: '🔗', tint: colors.saffronSoft, title: 'Paste a recipe', body: 'Any recipe link, or just paste the ingredient list.' },
  { emoji: '🔎', tint: colors.accentSoft, title: 'We find it on the shelves', body: 'Every ingredient matched to a real product at your nearest store, with price and stock.' },
  { emoji: '🛒', tint: colors.tomatoSoft, title: 'Walk it aisle by aisle', body: 'Your list is sorted by aisle, side and shelf. One loop, no zig-zagging.' },
];

export default function Home() {
  const router = useRouter();
  const { bp, isPhone, isDesktop } = useBreakpoint();
  const { setRecipe, location, loadStores } = useAppState();
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [locMode, setLocMode] = useState<LocationMode>(() =>
    'zip' in location ? 'zip' : location.label !== SEATTLE_PRESET.label ? 'gps' : 'preset',
  );
  const [zip, setZip] = useState(() => ('zip' in location ? location.zip : ''));
  const zipMissing = locMode === 'zip' && !isValidZip(zip);

  // Prewarm: fetch stores for the default location as soon as the page loads.
  useEffect(() => {
    loadStores().catch(() => {});
  }, [loadStores]);

  // Cycle the loading message so the wait feels alive.
  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1600);
    return () => clearInterval(t);
  }, [loading]);

  const submit = async () => {
    if (loading) return;
    setError(null);
    const input = mode === 'url' ? url.trim() : text.trim();
    if (!input && !isDemoMode()) {
      setError(mode === 'url' ? 'Paste a recipe link first.' : 'Paste at least one ingredient line.');
      return;
    }
    if (zipMissing) {
      setError('Enter a 5-digit ZIP code, or pick another location.');
      return;
    }
    setLoading(true);
    loadStores().catch(() => {}); // make sure stores are on their way while the recipe is read
    try {
      const recipe = await client.fetchRecipe(mode === 'url' ? { url: input } : { text: input });
      if (!recipe.items.length) {
        setError("We couldn't find any ingredients there. Paste them below instead.");
        setMode('text');
        return;
      }
      setRecipe(recipe);
      router.push('/review');
    } catch (e) {
      const code = e instanceof ApiCallError ? e.code : undefined;
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      if (mode === 'url' && code && PASTE_FALLBACK_CODES.has(code)) {
        setError(`${msg} Paste the ingredient list below instead.`);
        setMode('text');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const inlineSubmit = mode === 'url' && !isPhone;
  const submitLabel = loading ? LOADING_STEPS[0] : mode === 'url' ? 'Get my list' : 'Build my list';

  const form = (
    <View style={[styles.formCard, isPhone && { padding: 18 }]}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Text style={styles.label}>{mode === 'url' ? 'Recipe link' : 'Ingredients'}</Text>
      <View style={[inlineSubmit && styles.inlineRow]}>
        {mode === 'url' ? (
          <View style={[styles.inputWrap, focused && styles.inputFocus, inlineSubmit && { flex: 1 }, transition]}>
            <Text style={styles.inputIcon}>🔗</Text>
            <TextInput
              style={[styles.input, web({ outlineStyle: 'none' })]}
              value={url}
              onChangeText={setUrl}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={isDemoMode() ? 'Demo: just press the button' : 'Paste a recipe URL…'}
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              inputMode="url"
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!loading}
              accessibilityLabel="Recipe URL"
            />
          </View>
        ) : (
          <TextInput
            style={[styles.textarea, focused && styles.inputFocus, web({ outlineStyle: 'none' }), transition]}
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={'2 lb chicken thighs\n1 cup plain yogurt\n1 can crushed tomatoes\n…'}
            placeholderTextColor={colors.faint}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            editable={!loading}
            accessibilityLabel="Ingredient list"
          />
        )}
        {inlineSubmit ? <Button label={submitLabel} onPress={submit} loading={loading} style={styles.inlineBtn} accessibilityLabel="Build my shopping list" /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setMode(mode === 'url' ? 'text' : 'url');
          setError(null);
        }}
        style={(s) => [styles.toggle, pstate(s).hovered && { opacity: 0.75 }]}
      >
        <Text style={styles.toggleText}>{mode === 'url' ? 'No link? Paste ingredients instead' : 'Use a recipe link instead'}</Text>
      </Pressable>
      {isMockMode() && !isDemoMode() && mode === 'url' ? (
        <Text style={styles.hint}>Mock mode: any link works. Try one containing “allrecipes” to see the paste fallback.</Text>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.label}>Shopping near</Text>
      <LocationPicker mode={locMode} onModeChange={setLocMode} zip={zip} onZipChange={setZip} />

      {!inlineSubmit ? (
        <Button label={submitLabel} onPress={submit} loading={loading} style={{ marginTop: 20 }} accessibilityLabel="Build my shopping list" />
      ) : null}
      {loading ? (
        <View style={styles.loadingRow} accessibilityLiveRegion="polite">
          {LOADING_STEPS.map((s, i) => (
            <View key={s} style={styles.loadingStep}>
              <View style={[styles.loadingDot, i <= step && styles.loadingDotOn, i === step && styles.pulse]} />
              <Text style={[styles.loadingText, i <= step && { color: colors.text }]}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <Page maxWidth={1120}>
      <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
        <View style={[styles.heroCopy, isDesktop && { flex: 1.15, paddingRight: 24 }]}>
          <FadeIn>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowText}>🛒 For QFC, Fred Meyer & Kroger stores</Text>
            </View>
            <Text style={[styles.h1, bp === 'tablet' && styles.h1Tablet, isPhone && styles.h1Phone]} accessibilityRole="header">
              Any recipe, turned into a list{' '}
              <Text style={styles.h1Accent}>sorted by aisle.</Text>
            </Text>
            <Text style={[styles.lead, isPhone && { fontSize: 16, lineHeight: 25 }]}>
              Paste a recipe link. We find every ingredient at your nearest store, with the aisle, shelf, price and stock, so
              you walk the store once.
            </Text>
          </FadeIn>
          <FadeIn delay={120}>{form}</FadeIn>
        </View>
        {isDesktop ? (
          <View style={{ flex: 0.85 }}>
            <PreviewCard />
          </View>
        ) : null}
      </View>

      <FadeIn delay={240}>
        <Text style={styles.h2} accessibilityRole="header">
          How it works
        </Text>
        <View style={[styles.steps, isPhone && { flexDirection: 'column' }]}>
          {STEPS.map((s, i) => (
            <View key={s.title} style={[styles.step, isPhone ? styles.stepPhone : { flex: 1 }]}>
              <View style={[styles.stepTop, isPhone && { marginBottom: 0 }]}>
                <View style={[styles.stepIcon, { backgroundColor: s.tint }]}>
                  <Text style={styles.stepEmoji}>{s.emoji}</Text>
                </View>
                {!isPhone ? <Text style={styles.stepNum}>0{i + 1}</Text> : null}
              </View>
              <View style={isPhone ? { flex: 1 } : undefined}>
                <Text style={[styles.stepTitle, isPhone && { fontSize: 18, marginBottom: 2 }]}>
                  {isPhone ? `${i + 1}. ` : ''}
                  {s.title}
                </Text>
                <Text style={[styles.stepBody, isPhone && { fontSize: 14, lineHeight: 21 }]}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </FadeIn>

      <Text style={styles.footnote}>Live prices, stock and aisle locations from the Kroger family of stores. Built for a hackathon.</Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 16, paddingBottom: 40 },
  heroDesktop: { flexDirection: 'row', alignItems: 'center', paddingTop: 32, paddingBottom: 64 },
  heroCopy: {},
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 20,
    ...shadow.sm,
  },
  eyebrowText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.text },
  h1: { fontFamily: fonts.display, fontSize: 60, lineHeight: 64, fontWeight: '700', color: colors.ink, letterSpacing: -1.6 },
  h1Tablet: { fontSize: 52, lineHeight: 56 },
  h1Phone: { fontSize: 38, lineHeight: 42, letterSpacing: -1 },
  h1Accent: { color: colors.accent, fontStyle: 'italic' },
  lead: { fontFamily: fonts.body, fontSize: 18, lineHeight: 28, color: colors.muted, marginTop: 18, marginBottom: 28, maxWidth: 560 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.lg,
  },
  label: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
  inlineRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  inlineBtn: { minWidth: 168 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingLeft: 14,
    minHeight: 54,
  },
  inputFocus: { borderColor: colors.accentBright, backgroundColor: '#fff', ...web({ boxShadow: '0 0 0 4px rgba(46,158,98,0.15)' }) },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, minHeight: 52, fontSize: 16, fontFamily: fonts.body, color: colors.text, paddingRight: 14 },
  textarea: {
    minHeight: 190,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    padding: 14,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.body,
    color: colors.text,
  },
  toggle: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 4 },
  toggleText: { fontFamily: fonts.body, color: colors.accentDark, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, marginTop: -2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 },
  loadingRow: { marginTop: 16, gap: 8 },
  loadingStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  loadingDotOn: { backgroundColor: colors.accentBright },
  loadingText: { fontFamily: fonts.body, fontSize: 14, color: colors.faint, fontWeight: '600' },
  pulse: web({
    animationKeyframes: [{ '0%': { transform: 'scale(1)', opacity: 1 }, '50%': { transform: 'scale(1.5)', opacity: 0.6 }, '100%': { transform: 'scale(1)', opacity: 1 } }],
    animationDuration: '1s',
    animationIterationCount: 'infinite',
  }),
  h2: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.ink, letterSpacing: -0.6, marginBottom: 18 },
  steps: { flexDirection: 'row', gap: 16 },
  step: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  stepPhone: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  stepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  stepIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepEmoji: { fontSize: 26 },
  stepNum: { fontFamily: fonts.display, fontSize: 28, fontWeight: '700', color: colors.borderStrong },
  stepTitle: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  stepBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.muted },
  footnote: { fontFamily: fonts.body, fontSize: 13, color: colors.faint, textAlign: 'center', marginTop: 40 },
});
