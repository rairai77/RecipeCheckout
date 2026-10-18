import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { cap, effectivePrice, itemStyle, money, qtyLabel } from '../components/format';
import { RecipeBanner } from '../components/RecipeBanner';
import { StoreCard, StoreSkeleton, type StoreRow } from '../components/StoreCard';
import { chainColor, colors, fonts, radius, transition, useBreakpoint, web } from '../components/theme';
import { Button, Card, FadeIn, Notice, Page, pstate, Skeleton, Spinner } from '../components/ui';
import { client } from '../lib/client/mock';
import { useAppState } from '../lib/client/state';
import { compareAisles, formatAisle } from '../lib/shared/aisleSort';
import type { Item, ItemResult, SearchRequest, Store } from '../lib/shared/types';

const MAX_STORES = 3;

type RunState = 'waiting' | 'searching' | 'done' | 'error' | 'skipped';
type Run = { store: Store; state: RunState; count: number; found: ItemResult[]; error?: string };
type Miss = { item: Item; reason: 'no_match' | 'unavailable' };
type Phase = 'stores' | 'searching' | 'done' | 'no_stores' | 'error';

function toRequestItem(i: Item): SearchRequest['items'][number] {
  return { id: i.id, name: i.name, searchTerm: i.searchTerm, altTerms: i.altTerms, department: i.department, avoidWords: i.avoidWords };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function Results() {
  const router = useRouter();
  const { recipe, selectedIds, location, loadStores } = useAppState();
  const { isDesktop } = useBreakpoint();

  const items = useMemo(() => (recipe ? recipe.items.filter((i) => selectedIds.includes(i.id)) : []), [recipe, selectedIds]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [phase, setPhase] = useState<Phase>('stores');
  const [fatal, setFatal] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [showRuns, setShowRuns] = useState(false);

  useEffect(() => {
    const wanted = itemsRef.current;
    if (!wanted.length) return;
    let cancelled = false;
    const patchRun = (idx: number, patch: Partial<Run>) =>
      setRuns((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

    setPhase('stores');
    setFatal(null);
    setRuns([]);
    setMisses([]);
    setPicks({});

    (async () => {
      let stores: Store[];
      try {
        stores = (await loadStores()).stores.slice(0, MAX_STORES);
      } catch (e) {
        if (cancelled) return;
        setFatal(`Couldn't find nearby stores: ${errMsg(e)}`);
        setPhase('error');
        return;
      }
      if (cancelled) return;
      if (!stores.length) {
        setPhase('no_stores');
        return;
      }
      setRuns(stores.map((store) => ({ store, state: 'waiting', count: 0, found: [] })));
      setPhase('searching');

      let pending = wanted;
      const noMatch: Item[] = [];
      for (let idx = 0; idx < stores.length; idx++) {
        if (!pending.length) {
          patchRun(idx, { state: 'skipped' });
          continue;
        }
        patchRun(idx, { state: 'searching', count: pending.length });
        try {
          const res = await client.searchStore({ storeId: stores[idx].id, items: pending.map(toRequestItem) });
          if (cancelled) return;
          const byId = new Map(res.results.map((r) => [r.itemId, r]));
          const found: ItemResult[] = [];
          const next: Item[] = [];
          for (const it of pending) {
            const r = byId.get(it.id);
            if (r?.status === 'found' && r.best) found.push(r);
            else if (r?.status === 'no_match') noMatch.push(it); // a bad term fails everywhere: don't retry
            else next.push(it); // 'unavailable' (or missing from the response): try the next store
          }
          pending = next;
          patchRun(idx, { state: 'done', found });
        } catch (e) {
          if (cancelled) return;
          patchRun(idx, { state: 'error', error: errMsg(e) });
          // keep `pending` as is: the next store gets the same items
        }
      }
      if (cancelled) return;
      setMisses([
        ...pending.map((item) => ({ item, reason: 'unavailable' as const })),
        ...noMatch.map((item) => ({ item, reason: 'no_match' as const })),
      ]);
      setPhase('done');
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, loadStores]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Rows per store with the user's swaps applied, sorted by aisle.
  const cards = useMemo(
    () =>
      runs
        .filter((r) => r.found.length)
        .map((r) => {
          const rows: StoreRow[] = r.found
            .map((res) => {
              const item = itemById.get(res.itemId);
              if (!item || !res.best) return null;
              const pool = res.candidates.some((c) => c.productId === res.best!.productId) ? res.candidates : [res.best, ...res.candidates];
              const product = pool.find((c) => c.productId === picks[res.itemId]) ?? res.best;
              const row: StoreRow = { item, product, candidates: pool, substitute: res.substitute };
              return row;
            })
            .filter((x): x is StoreRow => x !== null)
            .sort((a, b) => compareAisles(a.product.aisle, b.product.aisle));
          return { store: r.store, rows };
        }),
    [runs, picks, itemById],
  );

  if (!recipe) return <Redirect href="/" />;
  if (!items.length) return <Redirect href="/review" />;

  const allRows = cards.flatMap((c) => c.rows);
  const total = allRows.reduce((s, r) => s + (effectivePrice(r.product) ?? 0), 0);
  const unpriced = allRows.filter((r) => effectivePrice(r.product) === undefined).length;
  const active = runs.find((r) => r.state === 'searching');
  const searchedStores = runs.filter((r) => r.state === 'done' || r.state === 'error').length;
  const errored = runs.filter((r) => r.state === 'error');
  const done = phase === 'done';

  const copyList = async () => {
    const text = buildPlainList(recipe.title, cards, misses, total);
    let ok = false;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok && Platform.OS === 'web' && typeof document !== 'undefined') ok = legacyCopy(text);
    if (!ok) {
      try {
        await Share.share({ message: text });
        ok = true;
      } catch {
        ok = false;
      }
    }
    setCopied(ok ? 'ok' : 'fail');
    setTimeout(() => setCopied('idle'), 2500);
  };

  const copyLabel = copied === 'ok' ? '✓ Copied!' : copied === 'fail' ? "Couldn't copy" : 'Copy list';
  const statusLine =
    phase === 'stores'
      ? `Finding stores near ${location.label}…`
      : active
        ? `Searching ${active.count} item${active.count === 1 ? '' : 's'} at ${active.store.name}…`
        : done
          ? `Found ${allRows.length} of ${items.length} item${items.length === 1 ? '' : 's'} at ${cards.length} store${cards.length === 1 ? '' : 's'}`
          : phase === 'no_stores'
            ? 'No stores nearby'
            : phase === 'error'
              ? 'Something went wrong'
              : 'Getting ready…';

  const progress = (
    <Card style={styles.panel}>
      <View style={styles.statusRow} accessibilityLiveRegion="polite">
        {done ? <Text style={styles.statusCheck}>✓</Text> : phase === 'searching' || phase === 'stores' ? <Spinner /> : null}
        <Text style={styles.statusText}>{statusLine}</Text>
      </View>
      {phase === 'no_stores' ? (
        <Text style={styles.muted}>No QFC, Fred Meyer or other Kroger stores within 30 miles of {location.label}. Try another location.</Text>
      ) : null}
      {phase === 'error' ? (
        <View>
          <Text style={[styles.muted, { color: colors.danger }]}>{fatal}</Text>
          <Button small variant="secondary" label="Try again" onPress={() => setAttempt((a) => a + 1)} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
        </View>
      ) : null}
      {phase === 'stores'
        ? [0, 1, 2].map((i) => (
            <View key={i} style={styles.runRow}>
              <Skeleton width={28} height={28} radius={8} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={10} />
                <Skeleton width="100%" height={4} />
              </View>
            </View>
          ))
        : runs.map((r) => <RunRow key={r.store.id} run={r} />)}
      {errored.length ? <Text style={[styles.muted, { color: colors.danger, marginTop: 8 }]}>Some stores couldn't be searched; their items moved on to the next store.</Text> : null}
    </Card>
  );

  const notFound =
    done && misses.length ? (
      <FadeIn>
        <Card style={styles.panel}>
          <Text style={styles.panelTitle}>Not found nearby</Text>
          {misses.map(({ item, reason }, i) => {
            const d = itemStyle(item);
            return (
              <View key={item.id} style={[styles.missRow, i > 0 && styles.missBorder]}>
                <View style={[styles.missEmoji, { backgroundColor: d.tint }]}>
                  <Text style={{ fontSize: 16 }}>{d.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missName}>
                    {cap(item.name)}
                    {qtyLabel(item) ? <Text style={styles.missQty}> · {qtyLabel(item)}</Text> : null}
                  </Text>
                  <Text style={styles.missReason}>
                    {reason === 'no_match' ? `No good match for “${item.searchTerm}”` : `Out of stock at ${searchedStores} nearby store${searchedStores === 1 ? '' : 's'}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      </FadeIn>
    ) : null;

  const summary = (
    <Card style={[styles.panel, styles.summary]}>
      <Text style={styles.summaryLabel}>Estimated total</Text>
      {done || allRows.length ? <Text style={styles.summaryTotal}>{money(total)}</Text> : <Skeleton width={150} height={44} radius={10} style={{ marginVertical: 7 }} />}
      <Text style={styles.muted}>
        {allRows.length} item{allRows.length === 1 ? '' : 's'} across {cards.length} store{cards.length === 1 ? '' : 's'}
        {unpriced ? ` · ${unpriced} without price` : ''}
      </Text>
      <Text style={styles.eachHint}>Counts 1 of each item; check “Recipe needs” for more.</Text>
      <Button
        label={copyLabel}
        icon={copied === 'idle' ? '📋' : undefined}
        onPress={copyList}
        disabled={!done || !allRows.length}
        variant={copied === 'ok' ? 'secondary' : 'primary'}
        style={{ marginTop: 16 }}
        accessibilityLabel="Copy list"
      />
      <Text style={styles.summaryHint}>Plain text, grouped by store and aisle. Paste it into Notes or a text.</Text>
    </Card>
  );

  // Phones and tablets: once the search is done, the store progress shrinks to one line under the list.
  const progressLine = (
    <Card style={[styles.panel, { paddingVertical: 4, paddingHorizontal: 6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showRuns }}
        accessibilityLabel={`${statusLine}. ${showRuns ? 'Hide' : 'Show'} stores searched`}
        onPress={() => setShowRuns((v) => !v)}
        style={(s) => [styles.lineRow, transition, pstate(s).hovered && { backgroundColor: colors.accentTint }]}
      >
        <Text style={styles.statusCheck}>✓</Text>
        <Text style={[styles.statusText, { fontSize: 14 }]} numberOfLines={2}>
          {statusLine}
          {errored.length ? <Text style={{ color: colors.danger }}> · {errored.length} store{errored.length === 1 ? '' : 's'} couldn't be searched</Text> : null}
        </Text>
        <Text style={styles.lineToggle}>{showRuns ? 'Hide ▴' : 'Stores ▾'}</Text>
      </Pressable>
      {showRuns ? <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>{runs.map((r) => <RunRow key={r.store.id} run={r} />)}</View> : null}
    </Card>
  );

  const again = done ? (
    <Button variant="ghost" small label="↻ Search again" onPress={() => setAttempt((a) => a + 1)} style={{ alignSelf: 'center', marginTop: 4 }} />
  ) : null;

  const main = (
    <View>
      {done && !allRows.length && !misses.length ? <Notice tone="warn">No results came back. Check your connection and try again.</Notice> : null}
      {cards.map((c) => (
        <FadeIn key={c.store.id}>
          <StoreCard store={c.store} rows={c.rows} onPick={(itemId, pid) => setPicks((p) => ({ ...p, [itemId]: pid }))} />
        </FadeIn>
      ))}
      {active ? <StoreSkeleton store={active.store} count={active.count} /> : null}
      {phase === 'stores' ? <SkeletonPlaceholder /> : null}
    </View>
  );

  const banner = (
    <RecipeBanner
      compact
      title={recipe.title}
      image={recipe.image}
      eyebrow="Shopping list"
      chips={[`${items.length} item${items.length === 1 ? '' : 's'}`, `📍 ${location.label}`]}
      back={{ label: 'Edit ingredients', onPress: () => (router.canGoBack() ? router.back() : router.replace('/review')) }}
    />
  );

  if (isDesktop) {
    return (
      <Page maxWidth={1180} top={banner}>
        <View style={styles.columns}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {main}
            {again}
          </View>
          <View style={styles.sidebar}>
            {summary}
            {progress}
            {notFound}
          </View>
        </View>
      </Page>
    );
  }

  return (
    <Page
      maxWidth={760}
      top={banner}
      footer={
        done && allRows.length ? (
          <View style={styles.bar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.barLabel}>
                Estimated total <Text style={styles.barEach}>· 1 of each</Text>
              </Text>
              <Text style={styles.barTotal}>
                {money(total)}
                <Text style={styles.barNote}>
                  {'  '}
                  {allRows.length} item{allRows.length === 1 ? '' : 's'}
                </Text>
              </Text>
            </View>
            <Button label={copyLabel} onPress={copyList} variant={copied === 'ok' ? 'secondary' : 'primary'} style={{ minWidth: 140 }} accessibilityLabel="Copy list" />
          </View>
        ) : phase === 'searching' || phase === 'stores' ? (
          <View style={[styles.bar, { minHeight: 52 }]}>
            <Spinner />
            <Text style={styles.barStatus} numberOfLines={2}>
              {statusLine}
            </Text>
          </View>
        ) : undefined
      }
    >
      {done ? null : progress}
      {main}
      {notFound}
      {done ? progressLine : null}
      {again}
    </Page>
  );
}

function SkeletonPlaceholder() {
  return (
    <View style={styles.skelCard}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 18 }}>
        <Skeleton width={48} height={48} radius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="70%" height={10} />
        </View>
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10 }}>
          <Skeleton width={64} height={68} radius={10} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="30%" height={10} />
            <Skeleton width="80%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

function RunRow({ run }: { run: Run }) {
  const { store, state } = run;
  const c = chainColor(store.chain);
  let text: string;
  switch (state) {
    case 'waiting':
      text = 'Waiting';
      break;
    case 'searching':
      text = `Searching ${run.count}…`;
      break;
    case 'done':
      text = `${run.found.length} of ${run.count} found`;
      break;
    case 'error':
      text = "Couldn't search";
      break;
    default:
      text = 'Not needed';
  }
  const barColor = state === 'done' ? colors.accentBright : state === 'error' ? colors.danger : colors.border;
  const fill = state === 'done' ? (run.count ? Math.max(0.06, run.found.length / run.count) : 1) : state === 'error' ? 1 : 0;
  return (
    <View style={[styles.runRow, state === 'skipped' && { opacity: 0.55 }]}>
      <View style={[styles.runBadge, { backgroundColor: c.bg }]}>
        <Text style={styles.runBadgeText}>{c.initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.runName} numberOfLines={1}>
          {store.name}
        </Text>
        <View style={styles.runTop}>
          <Text style={styles.runDist}>{store.distanceMi.toFixed(1)} mi away</Text>
          <Text style={[styles.runState, state === 'done' && { color: colors.accentDark }, state === 'error' && { color: colors.danger }]}>{text}</Text>
        </View>
        <View style={styles.track}>
          {state === 'searching' ? <View style={[styles.indeterminate]} /> : <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: barColor }]} />}
        </View>
        {state === 'error' && run.error ? (
          <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]} numberOfLines={2}>
            {run.error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function buildPlainList(title: string, cards: { store: Store; rows: StoreRow[] }[], misses: Miss[], total: number): string {
  const out: string[] = [`${title}: shopping list`, ''];
  for (const { store, rows } of cards) {
    out.push(`${store.name} (${store.distanceMi.toFixed(1)} mi), ${store.address}`);
    let lastAisle = '';
    for (const { item, product } of rows) {
      const aisle = formatAisle(product.aisle);
      if (aisle !== lastAisle) {
        out.push(`  ${aisle}`);
        lastAisle = aisle;
      }
      const price = effectivePrice(product);
      const qty = qtyLabel(item);
      out.push(
        `    [ ] ${product.description}${product.size ? `, ${product.size}` : ''}${price !== undefined ? `, ${money(price)}` : ''}  (${item.name}${qty ? `, ${qty}` : ''})`,
      );
    }
    out.push('');
  }
  if (misses.length) {
    out.push('Not found nearby');
    for (const { item } of misses) out.push(`    [ ] ${item.name}${qtyLabel(item) ? `, ${qtyLabel(item)}` : ''}`);
    out.push('');
  }
  out.push(`Estimated total (1 of each item): ${money(total)}`);
  return out.join('\n');
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  sidebar: { width: 340, gap: 16, ...web({ position: 'sticky', top: 16 }) },
  panel: { padding: 18, marginBottom: 16 },
  summary: { padding: 22 },
  summaryLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  summaryTotal: { fontFamily: fonts.display, fontSize: 48, lineHeight: 54, fontWeight: '700', color: colors.ink, letterSpacing: -1, marginVertical: 2 },
  eachHint: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, marginTop: 4, lineHeight: 17 },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, borderRadius: radius.md },
  lineToggle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.accentDark },
  barEach: { fontWeight: '600', textTransform: 'none', letterSpacing: 0, color: colors.faint },
  summaryHint: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, marginTop: 10, lineHeight: 17 },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 20 },
  panelTitle: { fontFamily: fonts.display, fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6, minHeight: 24 },
  statusCheck: { color: '#fff', backgroundColor: colors.accentBright, width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, fontWeight: '800', fontSize: 13, overflow: 'hidden' },
  statusText: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.text, flex: 1, lineHeight: 21 },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  runBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  runBadgeText: { color: '#fff', fontFamily: fonts.body, fontWeight: '800', fontSize: 9, letterSpacing: 0.3 },
  runTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 1, marginBottom: 6 },
  runName: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  runDist: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, fontWeight: '500' },
  runState: { fontFamily: fonts.body, fontSize: 12, fontWeight: '700', color: colors.muted },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.bgDeep, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, ...web({ transitionProperty: 'width', transitionDuration: '500ms' }) },
  indeterminate: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    borderRadius: 3,
    backgroundColor: colors.accentBright,
    ...web({
      animationKeyframes: [{ '0%': { left: '-40%' }, '100%': { left: '100%' } }],
      animationDuration: '1.1s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
    }),
  },
  missRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  missBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  missEmoji: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  missName: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.text },
  missQty: { fontWeight: '500', color: colors.muted },
  missReason: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  skelCard: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, marginBottom: 20 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  barTotal: { fontFamily: fonts.display, fontSize: 26, fontWeight: '700', color: colors.ink },
  barNote: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.muted },
  barStatus: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
});
