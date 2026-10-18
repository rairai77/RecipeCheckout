import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { effectivePrice, money, qtyLabel } from '../components/format';
import { StoreCard, type StoreRow } from '../components/StoreCard';
import { colors, radius } from '../components/theme';
import { BackLink, Button, Card, Notice, Screen } from '../components/ui';
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
              return { item, product, candidates: pool };
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

  return (
    <Screen
      footer={
        phase === 'done' && allRows.length ? (
          <View style={styles.footerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.totalLabel}>Estimated total</Text>
              <Text style={styles.total}>
                {money(total)}
                <Text style={styles.totalNote}>
                  {'  '}
                  {allRows.length} item{allRows.length === 1 ? '' : 's'}
                  {unpriced ? ` · ${unpriced} without price` : ''}
                </Text>
              </Text>
            </View>
            <Button
              label={copied === 'ok' ? 'Copied!' : copied === 'fail' ? "Couldn't copy" : 'Copy list'}
              onPress={copyList}
              variant={copied === 'ok' ? 'secondary' : 'primary'}
              style={{ minWidth: 130 }}
            />
          </View>
        ) : undefined
      }
    >
      <BackLink label="Edit ingredients" onPress={() => (router.canGoBack() ? router.back() : router.replace('/review'))} />
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.subtitle}>
        Shopping list for {items.length} item{items.length === 1 ? '' : 's'} near {location.label}
      </Text>

      {/* Progress */}
      <Card style={styles.progressCard}>
        {phase === 'stores' ? (
          <ProgressLine spinning text={`Finding stores near ${location.label}…`} />
        ) : phase === 'no_stores' ? (
          <Text style={styles.progressText}>No QFC, Fred Meyer or other Kroger-family stores within 10 miles of {location.label}.</Text>
        ) : phase === 'error' ? (
          <View>
            <Text style={[styles.progressText, { color: colors.danger }]}>{fatal}</Text>
            <Button small variant="secondary" label="Try again" onPress={() => setAttempt((a) => a + 1)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
          </View>
        ) : (
          runs.map((r) => <RunLine key={r.store.id} run={r} />)
        )}
        {phase === 'done' ? (
          <Text style={styles.doneText}>
            Done · searched {searchedStores} store{searchedStores === 1 ? '' : 's'}. Tap an item to swap it for another match.
          </Text>
        ) : null}
      </Card>

      {active ? (
        <View style={styles.activeBanner}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.activeText}>
            Searching {active.count} item{active.count === 1 ? '' : 's'} at {active.store.name}…
          </Text>
        </View>
      ) : null}

      {cards.map((c) => (
        <StoreCard key={c.store.id} store={c.store} rows={c.rows} onPick={(itemId, pid) => setPicks((p) => ({ ...p, [itemId]: pid }))} />
      ))}

      {phase === 'done' && misses.length ? (
        <Card>
          <Text style={styles.missTitle}>Not found nearby</Text>
          {misses.map(({ item, reason }) => (
            <View key={item.id} style={styles.missRow}>
              <Text style={styles.missName}>
                {item.name}
                {qtyLabel(item) ? <Text style={styles.missQty}> · {qtyLabel(item)}</Text> : null}
              </Text>
              <Text style={styles.missReason}>
                {reason === 'no_match'
                  ? `No good match for “${item.searchTerm}”`
                  : `Not in stock at ${runs.filter((r) => r.state === 'done').length || 'the'} nearby store${runs.filter((r) => r.state === 'done').length === 1 ? '' : 's'}`}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {phase === 'done' && !allRows.length && !misses.length ? (
        <Notice tone="warn">No results came back. Check your connection and try again.</Notice>
      ) : null}
      {phase === 'done' ? (
        <Button variant="ghost" small label="Search again" onPress={() => setAttempt((a) => a + 1)} style={{ alignSelf: 'center' }} />
      ) : null}
    </Screen>
  );
}

function ProgressLine({ text, spinning }: { text: string; spinning?: boolean }) {
  return (
    <View style={styles.progressLine}>
      {spinning ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      <Text style={[styles.progressText, spinning && { marginLeft: 8 }]}>{text}</Text>
    </View>
  );
}

function RunLine({ run }: { run: Run }) {
  const { store, state } = run;
  const icon = state === 'done' ? '✓' : state === 'error' ? '!' : state === 'skipped' ? '–' : '•';
  const iconColor = state === 'done' ? colors.accent : state === 'error' ? colors.danger : colors.faint;
  let text: string;
  switch (state) {
    case 'waiting':
      text = 'waiting';
      break;
    case 'searching':
      text = `searching ${run.count} item${run.count === 1 ? '' : 's'}…`;
      break;
    case 'done':
      text = `${run.found.length} of ${run.count} found`;
      break;
    case 'error':
      text = `couldn't search (${run.error})`;
      break;
    default:
      text = 'not needed';
  }
  return (
    <View style={styles.progressLine}>
      {state === 'searching' ? (
        <ActivityIndicator size="small" color={colors.accent} style={{ width: 16 }} />
      ) : (
        <Text style={[styles.runIcon, { color: iconColor }]}>{icon}</Text>
      )}
      <Text style={styles.progressText} numberOfLines={2}>
        <Text style={styles.runStore}>{store.name}</Text>
        <Text style={styles.runDist}> · {store.distanceMi.toFixed(1)} mi</Text> — {text}
      </Text>
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
  out.push(`Estimated total: ${money(total)}`);
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
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 16 },
  progressCard: { paddingVertical: 12, gap: 6 },
  progressLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  progressText: { fontSize: 14, color: colors.text, flexShrink: 1, lineHeight: 20 },
  runIcon: { width: 16, textAlign: 'center', fontWeight: '800', fontSize: 14 },
  runStore: { fontWeight: '700' },
  runDist: { color: colors.muted },
  doneText: { fontSize: 12, color: colors.muted, marginTop: 6 },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  activeText: { marginLeft: 10, color: colors.accentDark, fontWeight: '600', fontSize: 14, flexShrink: 1 },
  missTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 6 },
  missRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  missName: { fontSize: 15, fontWeight: '600', color: colors.text },
  missQty: { fontWeight: '400', color: colors.muted },
  missReason: { fontSize: 12, color: colors.muted, marginTop: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  totalLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  total: { fontSize: 22, fontWeight: '800', color: colors.text },
  totalNote: { fontSize: 12, fontWeight: '500', color: colors.muted },
});
