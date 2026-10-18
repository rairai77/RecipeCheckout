import { Redirect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cap, itemStyle, qtyLabel } from '../components/format';
import { RecipeBanner } from '../components/RecipeBanner';
import { colors, fonts, radius, shadow, transition, useBreakpoint, web } from '../components/theme';
import { Button, Checkbox, FadeIn, Page, pstate } from '../components/ui';
import { useAppState } from '../lib/client/state';
import type { Item } from '../lib/shared/types';

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
  const { bp, isPhone } = useBreakpoint();
  const { recipe, selectedIds, setSelectedIds, toggleSelected, location } = useAppState();

  if (!recipe) return <Redirect href="/" />;

  const selected = new Set(selectedIds);
  const count = recipe.items.filter((i) => selected.has(i.id)).length;
  const host = hostOf(recipe.sourceUrl);
  const cols = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1;
  const staples = recipe.items.filter((i) => i.isPantryStaple).length;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const chips = [`${recipe.items.length} ingredients`, ...(host ? [host] : []), `📍 ${location.label}`];

  return (
    <Page
      maxWidth={1120}
      top={<RecipeBanner title={recipe.title} image={recipe.image} eyebrow="Your recipe" chips={chips} back={{ label: 'New recipe', onPress: goBack }} />}
      footer={
        <View style={styles.bar}>
          {!isPhone ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.barTitle}>
                {count} of {recipe.items.length} selected
              </Text>
              <Text style={styles.barSub}>We'll check the nearest store first, then up to 2 more.</Text>
            </View>
          ) : null}
          <Button
            label={count ? `Find in stores (${count} item${count === 1 ? '' : 's'})  →` : 'Pick at least one item'}
            disabled={!count}
            onPress={() => router.push('/results')}
            style={isPhone ? { flex: 1 } : { minWidth: 300 }}
          />
        </View>
      }
    >
      <View style={[styles.toolbar, isPhone && styles.toolbarPhone]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h2} role="heading" aria-level={2}>
            What do you need to buy?
          </Text>
          <Text style={styles.sub}>
            {staples
              ? `We unchecked ${staples} pantry staple${staples === 1 ? '' : 's'} you probably have. Tap any card to toggle it.`
              : 'Tap any card to toggle it.'}
          </Text>
        </View>
        <View style={styles.segment} accessibilityRole="toolbar">
          <SegButton label="Select all" active={count === recipe.items.length} onPress={() => setSelectedIds(recipe.items.map((i) => i.id))} />
          <SegButton label="None" active={count === 0} onPress={() => setSelectedIds([])} />
        </View>
      </View>

      <View style={styles.grid}>
        {recipe.items.map((item, idx) => (
          <FadeIn key={item.id} delay={Math.min(idx * 30, 360)} style={{ width: `${100 / cols}%`, padding: 6 }}>
            <IngredientCard item={item} on={selected.has(item.id)} onToggle={() => toggleSelected(item.id)} />
          </FadeIn>
        ))}
      </View>
    </Page>
  );
}

function SegButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={(s) => [styles.seg, transition, active && styles.segOn, pstate(s).hovered && !active && { backgroundColor: colors.accentTint }]}
    >
      <Text style={[styles.segText, active && { color: colors.accentDark }]}>{label}</Text>
    </Pressable>
  );
}

function IngredientCard({ item, on, onToggle }: { item: Item; on: boolean; onToggle: () => void }) {
  const d = itemStyle(item);
  const qty = qtyLabel(item);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${item.name}${qty ? `, ${qty}` : ''}${item.isPantryStaple ? ', probably have it' : ''}`}
      onPress={onToggle}
      style={(s) => {
        const { hovered, pressed } = pstate(s);
        return [
          styles.card,
          transition,
          on ? styles.cardOn : styles.cardOff,
          hovered && (on ? styles.cardOnHover : styles.cardOffHover),
          pressed && web({ transform: 'scale(0.985)' }),
        ];
      }}
    >
      <View style={[styles.emojiWrap, { backgroundColor: d.tint }, !on && { opacity: 0.55 }]}>
        <Text style={styles.emoji}>{d.emoji}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.name, !on && styles.nameOff]} numberOfLines={2}>
          {cap(item.name)}
        </Text>
        <View style={styles.metaRow}>
          {qty ? <Text style={[styles.qty, !on && { color: colors.faint }]}>{qty}</Text> : null}
          {item.isPantryStaple ? (
            <View style={styles.staple}>
              <Text style={styles.stapleText}>probably have it</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.term} numberOfLines={1}>
          🔎 {item.searchTerm}
        </Text>
      </View>
      <Checkbox checked={on} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 14, marginTop: 4 },
  toolbarPhone: { flexDirection: 'column', alignItems: 'stretch' },
  h2: { fontFamily: fonts.display, fontSize: 30, fontWeight: '700', color: colors.ink, letterSpacing: -0.6 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, marginTop: 4, lineHeight: 22 },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    alignSelf: 'flex-start',
    ...shadow.sm,
  },
  seg: { minHeight: 40, paddingHorizontal: 16, borderRadius: radius.pill, justifyContent: 'center' },
  segOn: { backgroundColor: colors.accentSoft },
  segText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  cardOn: { backgroundColor: '#fff', borderColor: colors.accentBright, ...shadow.md },
  cardOff: { backgroundColor: 'rgba(255,255,255,0.45)', borderColor: colors.border, borderStyle: 'dashed' },
  cardOnHover: web({ boxShadow: '0 2px 4px rgba(29,42,33,0.05), 0 14px 28px -12px rgba(29,42,33,0.22)', transform: 'translateY(-1px)' }),
  cardOffHover: { backgroundColor: '#fff', borderColor: colors.borderStrong },
  emojiWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  cardBody: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.body, fontSize: 16, fontWeight: '700', color: colors.text },
  nameOff: { color: colors.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  qty: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, fontWeight: '600' },
  staple: { backgroundColor: colors.saffronSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  stapleText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', color: colors.warn },
  term: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, marginTop: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  barTitle: { fontFamily: fonts.body, fontSize: 16, fontWeight: '800', color: colors.text },
  barSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
});
