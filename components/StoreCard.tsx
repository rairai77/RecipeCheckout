import { useState, type ReactNode } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { aisleGroupName } from '../lib/shared/aisleSort';
import type { CheaperOption } from '../lib/shared/cheaper';
import { lineCost, saleLimit } from '../lib/shared/price';
import type { PackPlan } from '../lib/shared/packs';
import type { Item, Product, Store } from '../lib/shared/types';
import { AisleSign } from './AisleSign';
import { aisleDetail, aisleSpoken, cap, effectivePrice, money, qtyLabel, stockBadge, type StockTone } from './format';
import { chainColor, colors, fonts, radius, shadow, transition, useBreakpoint, web } from './theme';
import { pstate, Skeleton } from './ui';

export type StoreRow = {
  item: Item;
  product: Product;
  candidates: Product[];
  /** The store had no exact match; this is the closest stand-in. */
  substitute?: { reason: string };
  /** How many to buy (pack math from the recipe quantity and the product size). */
  plan: PackPlan;
  /** Why this item is at this store rather than a nearer one, e.g. "Not sold in-store at QFC Uptown". */
  fallbackNote?: string;
  /** The shopper skipped it: still shown in place, but not in the totals or the copied list. */
  skipped: boolean;
  /** An equally good match here that costs meaningfully less for the recipe's need (the pick itself is unchanged). */
  cheaper?: CheaperOption;
};

/** Price the row adds to the total: one product's price times the packs needed. */
export function lineTotal(row: Pick<StoreRow, 'product' | 'plan'>): number | undefined {
  return lineCost(row.product, row.plan.packs);
}

type Props = {
  store: Store;
  rows: StoreRow[]; // already sorted by aisle
  onPick: (itemId: string, productId: string) => void;
  onSkip: (itemId: string, skipped: boolean) => void;
  /** One line under the header explaining why this (farther) store is on the list. */
  reason?: string;
};

export function StoreHeader({ store, right }: { store: Store; right?: ReactNode }) {
  const c = chainColor(store.chain);
  const { isPhone } = useBreakpoint();
  return (
    <>
      <View style={[styles.strip, { backgroundColor: c.bg }]} />
      <View style={[styles.header, isPhone && styles.headerPhone]}>
        <View style={[styles.badge, { backgroundColor: c.bg }, isPhone && styles.badgePhone]}>
          <Text style={[styles.badgeText, c.initials.length > 2 && { fontSize: 12 }]}>{c.initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.storeName, isPhone && { fontSize: 20 }]} role="heading" aria-level={2}>
            {store.name}
          </Text>
          <Text style={styles.address} numberOfLines={2}>
            <Text style={styles.dist}>{store.distanceMi.toFixed(1)} mi</Text> · {store.address}
          </Text>
        </View>
        {right}
      </View>
    </>
  );
}

export function StoreCard({ store, rows, onPick, onSkip, reason }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { isPhone } = useBreakpoint();
  const kept = rows.filter((r) => !r.skipped);
  const subtotal = kept.reduce((sum, r) => sum + (lineTotal(r) ?? 0), 0);

  return (
    <View style={styles.card}>
      <StoreHeader
        store={store}
        right={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${store.name} in Maps`}
            onPress={() => Linking.openURL(store.mapsUrl)}
            style={(s) => [styles.mapsBtn, isPhone && styles.mapsBtnPhone, transition, pstate(s).hovered && { backgroundColor: colors.accentSoft, borderColor: colors.accentBright }]}
          >
            <Text style={styles.mapsText}>{isPhone ? '🗺️ Maps' : '🗺️ Open in Maps'}</Text>
          </Pressable>
        }
      />
      {reason ? (
        <View style={styles.reason}>
          <Text style={styles.reasonText}>↪ {reason}</Text>
        </View>
      ) : null}
      <View style={styles.countLine}>
        <Text style={styles.countText}>
          {kept.length} item{kept.length === 1 ? '' : 's'} · in walking order
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
          onSkip={(skip) => {
            onSkip(row.item.id, skip);
            if (skip) setOpenId(null);
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
  onSkip,
}: {
  row: StoreRow;
  first: boolean;
  open: boolean;
  onToggle: () => void;
  onPick: (productId: string) => void;
  onSkip: (skip: boolean) => void;
}) {
  const { isPhone } = useBreakpoint();
  const { item, product: p, candidates, plan, skipped } = row;
  const badge = stockBadge(p);
  const qty = plan.needLabel ? '' : qtyLabel(item);
  const others = candidates.filter((c) => c.productId !== p.productId);
  const detail = aisleDetail(p.aisle);
  const sub = row.substitute;
  const cheaper = row.cheaper;
  const total = lineTotal(row);
  const needLine = [plan.needLabel, plan.packLabel].filter(Boolean).join(' · ');

  const name = [
    `${cap(item.name)}: ${p.description}`,
    total !== undefined ? `${money(total)}${plan.packs > 1 ? ` for ${plan.packs}` : ''}` : 'no price',
    aisleSpoken(p.aisle),
    badge?.label.toLowerCase(),
  ]
    .filter(Boolean)
    .join(', ');
  const extra = [
    skipped ? 'Skipped, not in the total' : '',
    needLine,
    sub ? `Closest match: ${sub.reason}` : '',
    row.fallbackNote ?? '',
    cheaper && !skipped ? `${money(cheaper.saving)} cheaper option: ${cheaper.product.description}` : '',
    others.length ? (open ? 'Hide other options' : `Show ${others.length} other option${others.length === 1 ? '' : 's'}`) : '',
  ].filter(Boolean);

  return (
    <View style={[!first && styles.rowBorder]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}. ${extra.join('. ')}`}
          accessibilityState={{ expanded: open, disabled: skipped }}
          disabled={skipped}
          onPress={onToggle}
          style={(s) => [styles.rowMain, transition, skipped && styles.rowSkipped, !skipped && (pstate(s).hovered || open) && { backgroundColor: colors.accentTint }]}
        >
          <AisleSign aisle={p.aisle} size={isPhone ? 'sm' : 'md'} />
          {!isPhone ? <Thumb uri={p.image} /> : null}
          <View style={styles.productText}>
            <Text style={styles.forItem} numberOfLines={isPhone ? 2 : 1}>
              {cap(item.name)}
              {qty ? <Text style={styles.forQty}> · {qty}</Text> : null}
            </Text>
            <Text style={[styles.desc, skipped && styles.struck]} numberOfLines={isPhone ? 3 : 2}>
              {p.description}
            </Text>
            <Text style={styles.sub} numberOfLines={isPhone ? 2 : 1}>
              {[p.size, detail].filter(Boolean).join(' · ')}
            </Text>
            {needLine ? <Text style={styles.need}>{needLine}</Text> : null}
            {cheaper && !skipped ? (
              <View style={styles.cheapChip}>
                <Text style={styles.cheapText}>{money(cheaper.saving)} cheaper option →</Text>
              </View>
            ) : null}
            {sub ? (
              <View style={styles.subRow}>
                <View style={styles.subChip}>
                  <Text style={styles.subChipText}>Closest match</Text>
                </View>
                <Text style={styles.subReason}>{sub.reason}</Text>
              </View>
            ) : null}
            {row.fallbackNote ? <Text style={styles.fallback}>↪ {row.fallbackNote}</Text> : null}
            {skipped ? (
              <Text style={styles.skippedNote}>Skipped · not in the total</Text>
            ) : others.length ? (
              <Text style={styles.swapHint}>{open ? 'Hide options ▴' : `⇄ ${others.length} other option${others.length === 1 ? '' : 's'}`}</Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.right}>
          <View style={skipped && styles.rowSkipped}>
            <Price p={p} packs={plan.packs} struck={skipped} />
          </View>
          {badge && !skipped ? <Badge {...badge} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={skipped ? `Undo skip: add ${item.name} back` : `Skip ${item.name}, I'll substitute`}
            onPress={() => onSkip(!skipped)}
            hitSlop={8}
            style={(s) => [styles.skipBtn, skipped && styles.undoBtn, transition, pstate(s).hovered && { backgroundColor: colors.bgDeep }]}
          >
            <Text style={[styles.skipText, skipped && styles.undoText]}>{skipped ? 'Undo' : 'Skip'}</Text>
          </Pressable>
        </View>
      </View>

      {open && !skipped ? (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Swap to another match at this store</Text>
          {[p, ...others].map((c) => {
            const current = c.productId === p.productId;
            const cb = stockBadge(c);
            return (
              <Pressable
                key={c.productId}
                accessibilityRole="radio"
                accessibilityState={{ checked: current }}
                accessibilityLabel={[c.description, c.size, money(effectivePrice(c) ?? 0), aisleSpoken(c.aisle), cb?.label, cheaper?.product.productId === c.productId ? `saves ${money(cheaper.saving)}` : ''].filter(Boolean).join(', ')}
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
                    {[c.size, c.aisle ? aisleGroupName(c.aisle) : null, cb?.label]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {cheaper?.product.productId === c.productId ? <Text style={styles.cheapNote}>Saves {money(cheaper.saving)} for this recipe</Text> : null}
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

export function Price({ p, small, packs = 1, struck }: { p: Product; small?: boolean; packs?: number; struck?: boolean }) {
  const eff = effectivePrice(p);
  if (eff === undefined) return <Text style={styles.noPrice}>no price</Text>;
  const onSale = p.price !== undefined && eff < p.price;
  const limit = saleLimit(p);
  const limited = onSale && limit !== undefined && packs > limit ? limit : undefined;
  return (
    <View style={styles.priceBox}>
      {onSale || packs > 1 ? (
        <View style={styles.tags}>
          {onSale ? (
            <View style={styles.saleTag}>
              <Text style={styles.saleTagText}>Sale</Text>
            </View>
          ) : null}
          {packs > 1 ? (
            <View style={styles.packTag}>
              <Text style={styles.packTagText}>×{packs}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.price, small && { fontSize: 15 }, onSale && { color: colors.accent }, struck && styles.struck]}>{money(lineCost(p, packs) ?? eff * packs)}</Text>
      {packs > 1 ? (
        <Text style={styles.each}>
          {limited ? `sale price for ${limited} of ${packs}` : `${packs} × ${money(eff)}`}
        </Text>
      ) : onSale ? (
        <Text style={styles.was}>{money(p.price!)}</Text>
      ) : null}
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: StockTone }) {
  const bg = tone === 'ok' ? colors.accentSoft : tone === 'low' ? colors.saffronSoft : tone === 'neutral' ? colors.bgDeep : colors.dangerSoft;
  const fg = tone === 'ok' ? colors.accentDark : tone === 'low' ? colors.warn : tone === 'neutral' ? colors.muted : colors.danger;
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
      <SkeletonRows count={count} />
    </View>
  );
}

/** Typical rendered row heights, so placeholders take the space the real rows will (keeps layout shift low). */
export const ROW_HEIGHT = { phone: 150, wide: 118 };

/** One placeholder row per item being searched, at about the real row height. */
export function SkeletonRows({ count }: { count: number }) {
  const { isPhone } = useBreakpoint();
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.row, styles.skelRow, { minHeight: isPhone ? ROW_HEIGHT.phone : ROW_HEIGHT.wide }, i > 0 && styles.rowBorder]}>
          <Skeleton width={isPhone ? 52 : 64} height={isPhone ? 56 : 68} radius={10} />
          {!isPhone ? <Skeleton width={56} height={56} radius={12} /> : null}
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="30%" height={10} />
            <Skeleton width="75%" height={14} />
            <Skeleton width="45%" height={10} />
            <Skeleton width="25%" height={10} />
          </View>
          <Skeleton width={48} height={18} />
        </View>
      ))}
    </>
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
  headerPhone: { padding: 14, paddingBottom: 10, gap: 10, alignItems: 'flex-start' },
  badgePhone: { width: 40, height: 40, borderRadius: 10 },
  mapsBtnPhone: { minHeight: 40, paddingHorizontal: 10 },
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
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.md, margin: -6, padding: 6 },
  rowSkipped: { opacity: 0.55 },
  skelRow: { paddingVertical: 14 },
  struck: { textDecorationLine: 'line-through' },
  reason: { paddingHorizontal: 18, paddingBottom: 12, marginTop: -4 },
  reasonText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.warn },
  fallback: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4 },
  skippedNote: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontWeight: '700', marginTop: 6 },
  skipBtn: { minHeight: 32, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  skipText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.muted },
  undoBtn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  undoText: { color: colors.accentDark },
  tags: { flexDirection: 'row', gap: 4, marginBottom: 2 },
  packTag: { backgroundColor: colors.ink, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  packTagText: { fontFamily: fonts.body, fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  each: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
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
  saleTag: { backgroundColor: colors.saffronSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  saleTagText: { fontFamily: fonts.body, fontSize: 10, fontWeight: '800', color: colors.warn, letterSpacing: 0.4, textTransform: 'uppercase' },
  cheapChip: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.accentSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  cheapText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.accentDark },
  cheapNote: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.accentDark, marginTop: 2 },
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
