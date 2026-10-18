import { useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Item, Product, Store } from '../lib/shared/types';
import { AisleSign } from './AisleSign';
import { aisleDetail, cap, effectivePrice, money, qtyLabel, recipeNeed, stockBadge } from './format';
import { chainColor, colors, fonts, radius, shadow, transition, useBreakpoint, web } from './theme';
import { pstate, Skeleton } from './ui';

export type StoreRow = {
  item: Item;
  product: Product;
  candidates: Product[];
  /** The store had no exact match; this is the closest stand-in. */
  substitute?: { reason: string };
};

type Props = {
  store: Store;
  rows: StoreRow[]; // already sorted by aisle
  onPick: (itemId: string, productId: string) => void;
};

export function StoreHeader({ store, right }: { store: Store; right?: ReactNode }) {
  const c = chainColor(store.chain);
  const { isPhone } = useBreakpoint();
  return (
    <>
      <View style={[styles.strip, { backgroundColor: c.bg }]} />
      <View style={[styles.header, isPhone && { flexWrap: 'wrap' }]}>
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
          <Text style={[styles.badgeText, c.initials.length > 2 && { fontSize: 12 }]}>{c.initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.address} numberOfLines={2}>
            <Text style={styles.dist}>{store.distanceMi.toFixed(1)} mi</Text> · {store.address}
          </Text>
        </View>
        {right}
      </View>
    </>
  );
}

export function StoreCard({ store, rows, onPick }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const subtotal = rows.reduce((sum, r) => sum + (effectivePrice(r.product) ?? 0), 0);

  return (
    <View style={styles.card}>
      <StoreHeader
        store={store}
        right={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${store.name} in Maps`}
            onPress={() => Linking.openURL(store.mapsUrl)}
            style={(s) => [styles.mapsBtn, transition, pstate(s).hovered && { backgroundColor: colors.accentSoft, borderColor: colors.accentBright }]}
          >
            <Text style={styles.mapsText}>🗺️ Open in Maps</Text>
          </Pressable>
        }
      />
      <View style={styles.countLine}>
        <Text style={styles.countText}>
          {rows.length} item{rows.length === 1 ? '' : 's'} · in walking order
        </Text>
        {subtotal > 0 ? <Text style={styles.subtotal}>{money(subtotal)}</Text> : null}
      </View>

      {rows.map((row, i) => (
        <ProductRow
          key={row.item.id}
          row={row}
          first={i === 0}
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
  first,
  open,
  onToggle,
  onPick,
}: {
  row: StoreRow;
  first: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (productId: string) => void;
}) {
  const { isPhone } = useBreakpoint();
  const { item, product: p, candidates } = row;
  const badge = stockBadge(p.stockLevel);
  const need = recipeNeed(item);
  const qty = need ? '' : qtyLabel(item);
  const others = candidates.filter((c) => c.productId !== p.productId);
  const detail = aisleDetail(p.aisle);
  const sub = row.substitute;

  return (
    <View style={[!first && styles.rowBorder]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${sub ? 'Closest match: ' : ''}${p.description}. ${need ? `${need}. ` : ''}${others.length ? 'Tap to see other matches.' : ''}`}
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={(s) => [styles.row, transition, (pstate(s).hovered || open) && { backgroundColor: colors.accentTint }]}
      >
        <AisleSign aisle={p.aisle} size={isPhone ? 'sm' : 'md'} />
        {!isPhone ? <Thumb uri={p.image} /> : null}
        <View style={styles.productText}>
          <Text style={styles.forItem} numberOfLines={1}>
            {cap(item.name)}
            {qty ? <Text style={styles.forQty}> · {qty}</Text> : null}
          </Text>
          <Text style={styles.desc} numberOfLines={isPhone ? 3 : 2}>
            {p.description}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[p.size, detail].filter(Boolean).join(' · ')}
          </Text>
          {need ? <Text style={styles.need}>{need}</Text> : null}
          {sub ? (
            <View style={styles.subRow}>
              <View style={styles.subChip}>
                <Text style={styles.subChipText}>Closest match</Text>
              </View>
              <Text style={styles.subReason}>{sub.reason}</Text>
            </View>
          ) : null}
          {others.length ? (
            <Text style={styles.swapHint}>{open ? 'Hide options ▴' : `⇄ ${others.length} other option${others.length === 1 ? '' : 's'}`}</Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <Price p={p} />
          {badge ? <Badge {...badge} /> : null}
        </View>
      </Pressable>

      {open ? (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Swap to another match at this store</Text>
          {[p, ...others].map((c) => {
            const current = c.productId === p.productId;
            const cb = stockBadge(c.stockLevel);
            return (
              <Pressable
                key={c.productId}
                accessibilityRole="radio"
                accessibilityState={{ checked: current }}
                accessibilityLabel={c.description}
                onPress={() => onPick(c.productId)}
                style={(s) => [styles.candidate, transition, current && styles.candidateOn, pstate(s).hovered && !current && { backgroundColor: '#fff', borderColor: colors.borderStrong }]}
              >
                <View style={[styles.radio, current && styles.radioOn]}>{current ? <View style={styles.radioDot} /> : null}</View>
                <Thumb uri={c.image} small />
                <View style={styles.productText}>
                  <Text style={styles.candDesc} numberOfLines={3}>
                    {c.description}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[c.size, c.aisle ? (c.aisle.isNumbered ? `Aisle ${c.aisle.number}` : cap(c.aisle.label.toLowerCase())) : null, cb?.label]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Price p={c} small />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function Thumb({ uri, small }: { uri?: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = small ? 40 : 56;
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={{ width: size - 8, height: size - 8 }} resizeMode="contain" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ fontSize: small ? 16 : 20, opacity: 0.5 }}>🛍️</Text>
      )}
    </View>
  );
}

export function Price({ p, small }: { p: Product; small?: boolean }) {
  const eff = effectivePrice(p);
  if (eff === undefined) return <Text style={styles.noPrice}>no price</Text>;
  const onSale = p.price !== undefined && eff < p.price;
  return (
    <View style={styles.priceBox}>
      {onSale ? (
        <View style={styles.saleTag}>
          <Text style={styles.saleTagText}>Sale</Text>
        </View>
      ) : null}
      <Text style={[styles.price, small && { fontSize: 15 }, onSale && { color: colors.accent }]}>{money(eff)}</Text>
      {onSale ? <Text style={styles.was}>{money(p.price!)}</Text> : null}
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: 'ok' | 'low' | 'out' }) {
  const bg = tone === 'ok' ? colors.accentSoft : tone === 'low' ? colors.saffronSoft : colors.dangerSoft;
  const fg = tone === 'ok' ? colors.accentDark : tone === 'low' ? colors.warn : colors.danger;
  return (
    <View style={[styles.badgePill, { backgroundColor: bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: fg }]} />
      <Text style={[styles.badgePillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Placeholder card while a store is being searched. */
export function StoreSkeleton({ store, count }: { store: Store; count: number }) {
  return (
    <View style={styles.card} accessibilityLabel={`Searching ${count} items at ${store.name}`}>
      <StoreHeader store={store} />
      <View style={styles.countLine}>
        <Text style={styles.countText}>
          Searching {count} item{count === 1 ? '' : 's'}…
        </Text>
      </View>
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
          <Skeleton width={64} height={68} radius={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="30%" height={10} />
            <Skeleton width="75%" height={14} />
            <Skeleton width="45%" height={10} />
          </View>
          <Skeleton width={48} height={18} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    overflow: 'hidden',
    ...shadow.md,
  },
  strip: { height: 5 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, paddingBottom: 12, gap: 14 },
  badge: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontFamily: fonts.body, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  storeName: { fontFamily: fonts.display, fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  address: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  dist: { fontWeight: '800', color: colors.text },
  mapsBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  mapsText: { color: colors.accentDark, fontWeight: '700', fontSize: 14, fontFamily: fonts.body },
  countLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  countText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  subtotal: { fontFamily: fonts.body, fontSize: 14, color: colors.text, fontWeight: '800' },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  productText: { flex: 1, minWidth: 0 },
  forItem: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  forQty: { color: colors.faint, fontWeight: '700' },
  desc: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.text, lineHeight: 20 },
  candDesc: { fontFamily: fonts.body, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19 },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  need: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 3 },
  subRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  subChip: { backgroundColor: colors.saffronSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#F0D59E' },
  subChipText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', color: colors.warn },
  subReason: { fontFamily: fonts.body, fontSize: 12, color: colors.warn, flexShrink: 1 },
  saleTag: { backgroundColor: colors.saffronSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 2 },
  saleTagText: { fontFamily: fonts.body, fontSize: 10, fontWeight: '800', color: colors.warn, letterSpacing: 0.4, textTransform: 'uppercase' },
  swapHint: { fontFamily: fonts.body, fontSize: 12, color: colors.accentDark, fontWeight: '700', marginTop: 6 },
  right: { alignItems: 'flex-end', gap: 6, minWidth: 64 },
  thumb: { borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  priceBox: { alignItems: 'flex-end' },
  price: { fontFamily: fonts.body, fontSize: 18, fontWeight: '800', color: colors.text },
  noPrice: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.faint },
  was: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, textDecorationLine: 'line-through' },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgePillText: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800' },
  picker: { backgroundColor: colors.accentTint, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, gap: 6 },
  pickerTitle: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 4, paddingVertical: 6 },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  candidateOn: { backgroundColor: '#fff', borderColor: colors.accentBright },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
