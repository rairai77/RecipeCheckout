import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LocationPicker, type LocationMode } from '../components/LocationPicker';
import { colors, radius } from '../components/theme';
import { Button, Card, Notice, Screen, SectionTitle } from '../components/ui';
import { ApiCallError } from '../lib/client/api';
import { isValidZip } from '../lib/client/location';
import { client, isMockMode } from '../lib/client/mock';
import { useAppState } from '../lib/client/state';

/** Error codes where the right move is "paste the ingredients instead". */
const PASTE_FALLBACK_CODES = new Set(['blocked', 'no_recipe', 'not_found', 'network']);

export default function Home() {
  const router = useRouter();
  const { setRecipe, location, loadStores } = useAppState();
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locMode, setLocMode] = useState<LocationMode>(() => ('zip' in location ? 'zip' : 'lat' in location && location.label !== 'Seattle (Capitol Hill)' ? 'gps' : 'preset'));

  // Prewarm: fetch stores for the default location as soon as the page loads.
  useEffect(() => {
    loadStores().catch(() => {});
  }, [loadStores]);

  const [zip, setZip] = useState(() => ('zip' in location ? location.zip : ''));
  const zipMissing = locMode === 'zip' && !isValidZip(zip);

  const submit = async () => {
    if (loading) return;
    setError(null);
    const input = mode === 'url' ? url.trim() : text.trim();
    if (!input) {
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

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.logo}>
          Recipe<Text style={{ color: colors.accent }}>Checkout</Text>
        </Text>
        <Text style={styles.tagline}>
          Paste a recipe. Get a shopping list sorted by aisle at your nearest QFC or Fred Meyer.
        </Text>
      </View>

      <Card>
        <SectionTitle>{mode === 'url' ? 'Recipe link' : 'Ingredients'}</SectionTitle>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {mode === 'url' ? (
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://cooking.nytimes.com/recipes/…"
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
        ) : (
          <TextInput
            style={[styles.input, styles.textarea]}
            value={text}
            onChangeText={setText}
            placeholder={'2 lb chicken thighs\n1 cup plain yogurt\n1 can crushed tomatoes\n…'}
            placeholderTextColor={colors.faint}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            editable={!loading}
            accessibilityLabel="Ingredient list"
          />
        )}
        <Pressable
          onPress={() => {
            setMode(mode === 'url' ? 'text' : 'url');
            setError(null);
          }}
          style={styles.toggle}
          hitSlop={6}
        >
          <Text style={styles.toggleText}>{mode === 'url' ? 'Paste ingredients instead' : 'Use a recipe link instead'}</Text>
        </Pressable>
        {isMockMode() && mode === 'url' ? (
          <Text style={styles.hint}>Mock mode: any link works. Try one containing “allrecipes” to see the paste fallback.</Text>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Where do you shop?</SectionTitle>
        <LocationPicker mode={locMode} onModeChange={setLocMode} zip={zip} onZipChange={setZip} />
      </Card>

      <Button label={loading ? 'Reading recipe…' : 'Build my shopping list'} onPress={submit} loading={loading} />
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.loadingText}>Reading recipe… this takes a few seconds.</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 20, marginTop: 8 },
  logo: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 16, color: colors.muted, marginTop: 6, lineHeight: 23 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
  },
  textarea: { minHeight: 180, lineHeight: 22 },
  toggle: { marginTop: 10, alignSelf: 'flex-start' },
  toggleText: { color: colors.accentDark, fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },
  hint: { marginTop: 8, fontSize: 12, color: colors.faint },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  loadingText: { marginLeft: 8, color: colors.muted, fontSize: 14 },
});
