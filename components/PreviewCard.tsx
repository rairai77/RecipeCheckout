import { StyleSheet, Text, View } from 'react-native';
import type { Aisle } from '../lib/shared/types';
import { AisleSign } from './AisleSign';
import { chainColor, colors, fonts, radius, shadow, web } from './theme';
import { FadeIn } from './ui';

const ROWS: { aisle: Aisle; name: string; detail: string; price: string; sale?: boolean }[] = [
  { aisle: { label: 'AISLE 3', number: '3', side: 'R', isNumbered: true }, name: 'Crushed tomatoes', detail: '28 oz · shelf 2', price: '$1.79' },
  { aisle: { label: 'AISLE 7', number: '7', side: 'L', isNumbered: true }, name: 'Basmati rice', detail: '2 lb · shelf 4', price: '$3.49' },
  { aisle: { label: 'VEGETABLES', number: '0', isNumbered: false }, name: 'Yellow onions', detail: '3 lb bag', price: '$2.99' },
  { aisle: { label: 'MEAT', number: '101', isNumbered: false }, name: 'Chicken thighs', detail: 'about 2.5 lb', price: '$7.49', sale: true },
];

/** Decorative product preview for the landing hero (desktop only). */
export function PreviewCard() {
  const qfc = chainColor('QFC');
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.blobA} />
      <View style={styles.blobB} />
      <FadeIn delay={200} style={styles.cardWrap}>
        <View style={styles.card}>
          <View style={[styles.strip, { backgroundColor: qfc.bg }]} />
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: qfc.bg }]}>
              <Text style={styles.badgeText}>{qfc.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.store}>QFC Broadway Market</Text>
              <Text style={styles.meta}>0.1 mi · 11 items · walking order</Text>
            </View>
          </View>
          {ROWS.map((r, i) => (
            <View key={r.name} style={[styles.row, i > 0 && styles.rowBorder]}>
              <AisleSign aisle={r.aisle} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.detail}>{r.detail}</Text>
              </View>
              <Text style={[styles.price, r.sale && { color: colors.tomato }]}>{r.price}</Text>
            </View>
          ))}
        </View>
      </FadeIn>
      <FadeIn delay={600} style={styles.float}>
        <View style={styles.floatInner}>
          <Text style={styles.floatCheck}>✓</Text>
          <Text style={styles.floatText}>11 of 12 found nearby</Text>
        </View>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 460 },
  blobA: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: colors.saffronSoft,
    top: 10,
    right: -10,
  },
  blobB: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentSoft,
    bottom: 0,
    left: 10,
  },
  cardWrap: { width: 360 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.lg,
    ...web({ transform: 'rotate(-2.5deg)' }),
  },
  strip: { height: 5 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  badge: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontFamily: fonts.body, fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  store: { fontFamily: fonts.display, fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  name: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.text },
  detail: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  price: { fontFamily: fonts.body, fontSize: 15, fontWeight: '800', color: colors.text },
  float: { position: 'absolute', bottom: 36, right: 6 },
  floatInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow.lg,
  },
  floatCheck: { color: colors.saffron, fontWeight: '800', fontSize: 14 },
  floatText: { color: '#fff', fontFamily: fonts.body, fontWeight: '700', fontSize: 13 },
});
