import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { qtyLabel } from '../components/format';
import { colors, radius } from '../components/theme';
import { BackLink, Button, Card, Checkbox, Screen } from '../components/ui';
import { useAppState } from '../lib/client/state';

function hostOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export default function Review() {
  const router = useRouter();
  const { recipe, selectedIds, setSelectedIds, toggleSelected, location } = useAppState();
  const [imageFailed, setImageFailed] = useState(false);

  if (!recipe) return <Redirect href="/" />;

  const selected = new Set(selectedIds);
  const count = recipe.items.filter((i) => selected.has(i.id)).length;
  const host = hostOf(recipe.sourceUrl);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      footer={
        <Button
          label={count ? `Find in stores (${count} item${count === 1 ? '' : 's'})` : 'Pick at least one item'}
          disabled={!count}
          onPress={() => router.push('/results')}
        />
      }
    >
      <BackLink label="New recipe" onPress={goBack} />

      <Card style={styles.recipeCard}>
        {recipe.image && !imageFailed ? (
          <Image
            source={{ uri: recipe.image }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={styles.recipeBody}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.meta}>
            {recipe.items.length} ingredients{host ? ` · from ${host}` : ''} · shopping near {location.label}
          </Text>
        </View>
      </Card>

      <Card style={{ paddingHorizontal: 0, paddingVertical: 4 }}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>What do you need to buy?</Text>
          <View style={styles.selectBtns}>
            <Pressable onPress={() => setSelectedIds(recipe.items.map((i) => i.id))} hitSlop={6}>
              <Text style={styles.selectText}>All</Text>
            </Pressable>
            <Text style={styles.selectSep}>/</Text>
            <Pressable onPress={() => setSelectedIds([])} hitSlop={6}>
              <Text style={styles.selectText}>None</Text>
            </Pressable>
          </View>
        </View>
        {recipe.items.map((item, idx) => {
          const on = selected.has(item.id);
          const qty = qtyLabel(item);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggleSelected(item.id)}
              style={({ pressed }) => [styles.row, idx > 0 && styles.rowBorder, pressed && { backgroundColor: colors.overlay }]}
            >
              <Checkbox checked={on} />
              <View style={styles.rowBody}>
                <View style={styles.nameLine}>
                  <Text style={[styles.name, !on && styles.nameOff]}>{item.name}</Text>
                  {qty ? <Text style={styles.qty}>{qty}</Text> : null}
                </View>
                <View style={styles.subLine}>
                  <Text style={styles.term}>searches “{item.searchTerm}”</Text>
                  {item.isPantryStaple ? (
                    <View style={styles.stapleTag}>
                      <Text style={styles.stapleText}>probably have it</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  recipeCard: { padding: 0, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 16 / 7, backgroundColor: colors.accentSoft },
  recipeBody: { padding: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  meta: { marginTop: 4, color: colors.muted, fontSize: 14 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  selectBtns: { flexDirection: 'row', alignItems: 'center' },
  selectText: { color: colors.accentDark, fontWeight: '700', fontSize: 14 },
  selectSep: { color: colors.faint, marginHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowBody: { flex: 1, marginTop: -1 },
  nameLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  nameOff: { color: colors.muted },
  qty: { fontSize: 14, color: colors.muted },
  subLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 3, gap: 8 },
  term: { fontSize: 12, color: colors.faint },
  stapleTag: { backgroundColor: colors.warnSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  stapleText: { fontSize: 11, fontWeight: '700', color: colors.warn },
});
