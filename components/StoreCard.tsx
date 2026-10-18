import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatAisle } from '../lib/shared/aisleSort';
import type { Item, Product, Store } from '../lib/shared/types';
import { effectivePrice, money, qtyLabel, stockBadge } from './format';
import { colors, radius, shadow } from './theme';

export type StoreRow = {
  item: Item;
  product: Product;
  candidates: Product[];
};

type Props = {
  store: Store;
  rows: StoreRow[]; // already sorted by aisle
  onPick: (itemId: string, productId: string) => void;
};

export function StoreCard({ store, rows, onPick }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const subtotal = rows.reduce((sum, r) => sum + (effectivePrice(r.product) ?? 0), 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.chain}>{store.chain}</Text>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.address}>
            {store.distanceMi.toFixed(1)} mi · {store.address}
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(store.mapsUrl)}
          style={({ pressed }) => [styles.mapsBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.mapsText}>Open in Maps ↗</Text>
        </Pressable>
      </View>
      <View style={styles.countLine}>
        <Text style={styles.countText}>
          {rows.length} item{rows.length === 1 ? '' : 's'} here · sorted by aisle
        </Text>
        {subtotal > 0 ? <Text style={styles.countText}>{money(subtotal)}</Text> : null}
      </View>

      {rows.map((row) => (
        <ProductRow
          key={row.item.id}
          row={row}
          open={openId === row.item.id}
          onToggle={() => setOpenId(openId === row.item.id ? null : row.item.id)}
          onPick={(pid) => {
            onPick(row.item.id, pid);
            setOpenId(null);
          }}
        />
      ))}
    </View>
  );
}

function ProductRow({
  row,
  open,
  onToggle,
  onPick,
}: {
  row: StoreRow;
  open: boolean;
  onToggle: () => void;
  onPick: (productId: string) => void;
}) {
  const { item, product: p, candidates } = row;
  const badge = stockBadge(p.stockLevel);
  const qty = qtyLabel(item);
  const others = candidates.filter((c) => c.productId !== p.productId);

  return (
    <View style={styles.rowWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Shows other matching products"
        onPress={onToggle}
        style={({ pressed }) => [styles.row, (pressed || open) && { backgroundColor: colors.overlay }]}
      >
        <View style={styles.aisleLine}>
          <Text style={styles.aisle}>{formatAisle(p.aisle)}</Text>
          {badge ? <Badge {...badge} /> : null}
        </View>
        <View style={styles.productLine}>
          <Thumb uri={p.image} />
          <View style={styles.productText}>
            <Text style={styles.desc} numberOfLines={2}>
              {p.description}
            </Text>
            <Text style={styles.sub} numberOfLines={2}>
              {[p.size, `for ${item.name}${qty ? ` (${qty})` : ''}`].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Price p={p} />
        </View>
        <Text style={styles.swapHint}>{open ? 'Hide other matches' : others.length ? `Wrong item? ${others.length} other match${others.length === 1 ? '' : 'es'} ›` : ''}</Text>
      </Pressable>

      {open ? (
        <View style={styles.picker}>
          {others.length === 0 ? (
            <Text style={styles.pickerEmpty}>No other matches at this store.</Text>
          ) : (
            others.map((c) => {
              const cb = stockBadge(c.stockLevel);
              return (
                <Pressable
                  key={c.productId}
                  onPress={() => onPick(c.productId)}
                  style={({ pressed }) => [styles.candidate, pressed && { backgroundColor: colors.accentSoft }]}
                >
                  <Thumb uri={c.image} small />
                  <View style={styles.productText}>
                    <Text style={styles.candDesc} numberOfLines={2}>
                      {c.description}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {[c.size, formatAisle(c.aisle), cb?.label].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Price p={c} small />
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

export function Thumb({ uri, small }: { uri?: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = small ? 36 : 48;
  if (!uri || failed) return <View style={[styles.thumb, { width: size, height: size }]} />;
  return (
    <Image
      source={{ uri }}
      style={[styles.thumb, { width: size, height: size }]}
      resizeMode="contain"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

function Price({ p, small }: { p: Product; small?: boolean }) {
  const eff = effectivePrice(p);
  if (eff === undefined) return <Text style={[styles.price, styles.noPrice]}>no price</Text>;
  const onSale = p.price !== undefined && eff < p.price;
  return (
    <View style={styles.priceBox}>
      <Text style={[styles.price, small && { fontSize: 14 }, onSale && { color: colors.danger }]}>{money(eff)}</Text>
      {onSale ? <Text style={styles.was}>{money(p.price!)}</Text> : null}
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'ok' | 'low' | 'out' }) {
  const bg = tone === 'ok' ? colors.accentSoft : tone === 'low' ? colors.warnSoft : colors.dangerSoft;
  const fg = tone === 'ok' ? colors.accentDark : tone === 'low' ? colors.warn : colors.danger;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
    ...shadow,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, paddingBottom: 8, gap: 12 },
  chain: { fontSize: 12, fontWeight: '800', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  storeName: { fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 2 },
  address: { fontSize: 13, color: colors.muted, marginTop: 3 },
  mapsBtn: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8 },
  mapsText: { color: colors.accentDark, fontWeight: '700', fontSize: 13 },
  countLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  countText: { fontSize: 12, color: colors.faint, fontWeight: '600' },
  rowWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  row: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  aisleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  aisle: { fontSize: 15, fontWeight: '800', color: colors.accentDark, flexShrink: 1 },
  productLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productText: { flex: 1, minWidth: 0 },
  desc: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 20 },
  candDesc: { fontSize: 14, fontWeight: '500', color: colors.text, lineHeight: 19 },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  swapHint: { fontSize: 12, color: colors.accent, marginTop: 6, marginLeft: 60, minHeight: 4 },
  thumb: { borderRadius: radius.sm, backgroundColor: '#EEF2EC' },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 16, fontWeight: '800', color: colors.text },
  noPrice: { fontSize: 12, fontWeight: '500', color: colors.faint },
  was: { fontSize: 12, color: colors.faint, textDecorationLine: 'line-through' },
  badge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  picker: { backgroundColor: '#FAFCF9', paddingHorizontal: 12, paddingBottom: 10 },
  pickerEmpty: { fontSize: 13, color: colors.muted, padding: 8 },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: radius.sm,
  },
});
