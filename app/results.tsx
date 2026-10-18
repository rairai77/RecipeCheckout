import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { aisleDetail, cap, effectivePrice, itemStyle, money, qtyLabel } from '../components/format';
import { cheaperOption } from '../lib/shared/cheaper';
import { haversineMiles } from '../lib/shared/haversine';
import { readChoices, writeChoices } from '../lib/client/resultsSession';
import { storesKey } from '../lib/client/state';
import { RecipeBanner } from '../components/RecipeBanner';
import { lineTotal, SkeletonRows, StoreCard, StoreSkeleton, type StoreRow } from '../components/StoreCard';
import { chainColor, colors, fonts, radius, transition, useBreakpoint, web } from '../components/theme';
import { Button, Card, FadeIn, Notice, Page, pstate, Skeleton, Spinner } from '../components/ui';
import { client } from '../lib/client/mock';
import { useAppState } from '../lib/client/state';
import { aisleGroupName, compareAisles } from '../lib/shared/aisleSort';
import { packPlan } from '../lib/shared/packs';
import type { Item, ItemResult, SearchRequest, SearchResponse, Store } from '../lib/shared/types';

const MAX_STORES = 3;

type RunState = 'waiting' | 'searching' | 'done' | 'error' | 'skipped';
type Run = {
  store: Store;
  state: RunState;
  count: number;
  found: ItemResult[];
  error?: string;
  /** Items this store couldn't supply, with the reason (shown on the row at the store that did). */
  passedOn?: Record<string, string>;
};

/** Why an item moved on from a store, in the words the data supports. */
function passReason(r: ItemResult | undefined, store: Store): string {
  if (!r) return `Not returned by ${store.name}`;
  if (r.best?.stockLevel === 'TEMPORARILY_OUT_OF_STOCK') return `Out of stock at ${store.name}`;
  if (r.best?.inStore === false) return `Not sold in-store at ${store.name}`;
  return `Not in stock at ${store.name}`;
}
type Miss = { item: Item; reason: 'no_match' | 'unavailable' };
/** The whole list searched at a farther store, to offer "all at one store" when the nearest-first plan splits. */
type FullSearch = { state: 'searching' } | { state: 'done'; results: ItemResult[] } | { state: 'error' };
type OneStop = {
  store: Store;
  status: 'checking' | 'done' | 'error';
  rows: StoreRow[];
  /** has every item the nearest-first plan found */
  complete: boolean;
  total: number;
};
type Phase = 'stores' | 'searching' | 'done' | 'no_stores' | 'error';

function toRequestItem(i: Item): SearchRequest['items'][number] {
  return { id: i.id, name: i.name, searchTerm: i.searchTerm, altTerms: i.altTerms, department: i.department, avoidWords: i.avoidWords, quantity: i.quantity, unit: i.unit };
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
  // Swaps, skips and the one-stop choice survive a refresh (sessionStorage, keyed by recipe, items and location).
  const choicesKey = `${storesKey(location)}|${recipe?.title ?? ''}|${recipe?.sourceUrl ?? ''}|${items.map((i) => i.id).join(',')}`;
  const [restored] = useState(() => readChoices(choicesKey));
  const [picks, setPicks] = useState<Record<string, string>>(restored.picks);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [showRuns, setShowRuns] = useState(false);
  const [skipped, setSkipped] = useState<Record<string, boolean>>(restored.skipped);
  const [full, setFull] = useState<Record<string, FullSearch>>({});
  const [oneStop, setOneStop] = useState<string | null>(restored.oneStop);

  useEffect(() => {
    writeChoices(choicesKey, { picks, skipped, oneStop });
  }, [choicesKey, picks, skipped, oneStop]);

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
    setFull({});
    if (attempt > 0) {
      // "Search again" starts fresh; the first run keeps choices restored after a refresh.
      setPicks({});
      setSkipped({});
      setOneStop(null);
    }

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
      // When the nearest store can't supply everything, the farther stores are searched for the whole list, in parallel
      // (one request each): the same response gives the fallback items and a possible one-stop alternative.
      const fullRuns = new Map<number, Promise<SearchResponse>>();
      const searchFull = (idx: number) => {
        let p = fullRuns.get(idx);
        if (!p) {
          const storeId = stores[idx].id;
          p = client.searchStore({ storeId, items: wanted.map(toRequestItem) });
          fullRuns.set(idx, p);
          setFull((f) => ({ ...f, [storeId]: { state: 'searching' } }));
          p.then(
            (res) => !cancelled && setFull((f) => ({ ...f, [storeId]: { state: 'done', results: res.results } })),
            () => !cancelled && setFull((f) => ({ ...f, [storeId]: { state: 'error' } })),
          );
        }
        return p;
      };
      for (let idx = 0; idx < stores.length; idx++) {
        if (!pending.length) {
          patchRun(idx, { state: 'skipped' });
          continue;
        }
        if (idx === 1) for (let j = 1; j < stores.length; j++) void searchFull(j).catch(() => {});
        patchRun(idx, { state: 'searching', count: pending.length });
        try {
          const res = idx === 0 ? await client.searchStore({ storeId: stores[idx].id, items: pending.map(toRequestItem) }) : await searchFull(idx);
          if (cancelled) return;
          const byId = new Map(res.results.map((r) => [r.itemId, r]));
          const found: ItemResult[] = [];
          const next: Item[] = [];
          const passedOn: Record<string, string> = {};
          for (const it of pending) {
            const r = byId.get(it.id);
            if (r?.status === 'found' && r.best) found.push(r);
            else if (r?.status === 'no_match') noMatch.push(it); // a bad term fails everywhere: don't retry
            else {
              next.push(it); // 'unavailable' (or missing from the response): try the next store
              passedOn[it.id] = passReason(r, stores[idx]);
            }
          }
          pending = next;
          patchRun(idx, { state: 'done', found, passedOn });
        } catch (e) {
          if (cancelled) return;
          patchRun(idx, { state: 'error', error: errMsg(e), passedOn: Object.fromEntries(pending.map((it) => [it.id, `${stores[idx].name} couldn't be searched`])) });
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

  // Rows for one store's results, with the user's swaps, pack math, skips and cheaper-option hints, sorted by aisle.
  const makeRows = useMemo(
    () =>
      (found: ItemResult[], note?: (itemId: string) => string | undefined): StoreRow[] =>
        found
          .map((res) => {
            const item = itemById.get(res.itemId);
            if (!item || !res.best || res.status !== 'found') return null;
            const pool = res.candidates.some((c) => c.productId === res.best!.productId) ? res.candidates : [res.best, ...res.candidates];
            const product = pool.find((c) => c.productId === picks[res.itemId]) ?? res.best;
            const row: StoreRow = {
              item,
              product,
              candidates: pool,
              substitute: product.productId === res.best.productId ? res.substitute : undefined,
              plan: packPlan(item, product),
              fallbackNote: note?.(res.itemId),
              skipped: !!skipped[res.itemId],
              cheaper: cheaperOption(item, res.termUsed, product, pool),
            };
            return row;
          })
          .filter((x): x is StoreRow => x !== null)
          .sort((a, b) => compareAisles(a.product.aisle, b.product.aisle)),
    [itemById, picks, skipped],
  );

  // Nearest-first plan: each store supplies what the nearer ones couldn't.
  const splitCards = useMemo(() => {
    const out: { store: Store; rows: StoreRow[]; reason?: string }[] = [];
    runs.forEach((r, idx) => {
      if (!r.found.length) return;
      const firstReason = (itemId: string) => runs.slice(0, idx).map((p) => p.passedOn?.[itemId]).find(Boolean);
      const rows = makeRows(r.found, firstReason);
      // One line under a farther store's header: why it's on the list, and how far it is from the previous stop.
      let reason: string | undefined;
      const prev = out[out.length - 1]?.store;
      const notes = [...new Set(rows.map((x) => x.fallbackNote).filter((x): x is string => !!x))];
      if (idx > 0 && notes.length) {
        const hop = prev ? ` · ${haversineMiles(prev.lat, prev.lng, r.store.lat, r.store.lng).toFixed(1)} mi from ${prev.name}` : '';
        reason = notes.length === 1 ? `${notes[0]}${hop}` : `Not available at the nearer store${idx > 1 ? 's' : ''}${hop}`;
      }
      out.push({ store: r.store, rows, reason });
    });
    return out;
  }, [runs, makeRows]);

  // "All at one store" alternatives: farther stores searched for the whole list.
  const splitIds = useMemo(() => new Set(splitCards.flatMap((c) => c.rows.map((r) => r.item.id))), [splitCards]);
  const oneStops = useMemo<OneStop[]>(
    () =>
      runs
        .slice(1)
        .filter((r) => full[r.store.id])
        .map((r) => {
          const f = full[r.store.id];
          if (f.state !== 'done') return { store: r.store, status: f.state === 'searching' ? 'checking' : 'error', rows: [], complete: false, total: 0 };
          const rows = makeRows(f.results.filter((x) => x.status === 'found'));
          const have = new Set(rows.map((x) => x.item.id));
          const complete = splitIds.size > 0 && [...splitIds].every((id) => have.has(id));
          const total = rows.filter((x) => !x.skipped).reduce((t, x) => t + (lineTotal(x) ?? 0), 0);
          return { store: r.store, status: 'done', rows, complete, total };
        }),
    [runs, full, makeRows, splitIds],
  );
  const chosen = oneStop ? oneStops.find((o) => o.store.id === oneStop && o.status === 'done' && o.complete) : undefined;
  const cards = chosen ? [{ store: chosen.store, rows: chosen.rows, reason: undefined as string | undefined }] : splitCards;

  if (!recipe) return <Redirect href="/" />;
  if (!items.length) return <Redirect href="/review" />;

  const shownRows = cards.flatMap((c) => c.rows);
  const allRows = shownRows.filter((r) => !r.skipped);
  const skippedCount = shownRows.length - allRows.length;
  const total = allRows.reduce((s, r) => s + (lineTotal(r) ?? 0), 0);
  const splitTotal = splitCards.flatMap((c) => c.rows).filter((r) => !r.skipped).reduce((s, r) => s + (lineTotal(r) ?? 0), 0);
  const offerStops = splitCards.length > 1 && !chosen ? oneStops : [];
  const unpriced = allRows.filter((r) => effectivePrice(r.product) === undefined).length;
  // "Estimated" either way (some produce is priced per lb); say so when some rows could only be counted once.
  const unsure = allRows.filter((r) => !r.plan.confident).length;
  const totalNote = unsure ? `${unsure} item${unsure === 1 ? '' : 's'} counted once: check “Recipe needs”` : 'Quantities from the recipe, rounded up to whole packs';
  const firstStoreDone = runs.some((r) => r.state === 'done' || r.state === 'error');
  const active = runs.find((r) => r.state === 'searching');
  const searchedStores = runs.filter((r) => r.state === 'done' || r.state === 'error').length;
  const errored = runs.filter((r) => r.state === 'error');
  const done = phase === 'done';

  const copyList = async () => {
    const text = buildPlainList(recipe.title, cards, misses, total, skippedCount);
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

  // A store the nearest-first plan didn't need, but that was searched for the one-stop offer.
  const checkedFor = (r: Run) => {
    const o = r.state === 'skipped' ? oneStops.find((x) => x.store.id === r.store.id && x.status === 'done') : undefined;
    return o ? { found: o.rows.length, of: items.length } : undefined;
  };

  const copyLabel = copied === 'ok' ? '✓ Copied!' : copied === 'fail' ? "Couldn't copy" : 'Copy list';
  const statusLine =
    phase === 'stores'
      ? `Finding stores near ${location.label}…`
      : active
        ? `Searching ${active.count} item${active.count === 1 ? '' : 's'} at ${active.store.name}…`
        : done
          ? `Found ${shownRows.length} of ${items.length} item${items.length === 1 ? '' : 's'} at ${cards.length} store${cards.length === 1 ? '' : 's'}`
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
        : runs.map((r) => <RunRow key={r.store.id} run={r} checked={checkedFor(r)} />)}
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
      {firstStoreDone ? <Text style={styles.summaryTotal}>{money(total)}</Text> : <Skeleton width={150} height={44} radius={10} style={{ marginVertical: 5 }} />}
      <Text style={styles.muted} numberOfLines={1}>
        {firstStoreDone
          ? `${allRows.length} item${allRows.length === 1 ? '' : 's'} across ${cards.length} store${cards.length === 1 ? '' : 's'}${skippedCount ? ` · ${skippedCount} skipped` : ''}${unpriced ? ` · ${unpriced} without price` : ''}`
          : `Searching ${items.length} item${items.length === 1 ? '' : 's'}…`}
      </Text>
      <Text style={styles.eachHint} numberOfLines={2}>
        {totalNote}
      </Text>
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

  // Phones and tablets: the store progress is one line at the top from the start (expandable), so nothing jumps when
  // the search finishes. Errors and "no stores" still get the full card.
  const progressLine = (
    <Card style={[styles.panel, { paddingVertical: 4, paddingHorizontal: 6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showRuns }}
        accessibilityLabel={`${statusLine}. ${showRuns ? 'Hide' : 'Show'} stores searched`}
        accessibilityLiveRegion="polite"
        onPress={() => setShowRuns((v) => !v)}
        style={(s) => [styles.lineRow, transition, pstate(s).hovered && { backgroundColor: colors.accentTint }]}
      >
        {done ? <Text style={styles.statusCheck}>✓</Text> : <View style={{ width: 22, alignItems: 'center' }}><Spinner /></View>}
        <Text style={[styles.statusText, { fontSize: 14 }]} numberOfLines={1}>
          {statusLine}
          {errored.length ? <Text style={{ color: colors.danger }}> · {errored.length} store{errored.length === 1 ? '' : 's'} couldn't be searched</Text> : null}
        </Text>
        <Text style={styles.lineToggle}>{showRuns ? 'Hide ▴' : 'Stores ▾'}</Text>
      </Pressable>
      {showRuns ? <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>{runs.map((r) => <RunRow key={r.store.id} run={r} checked={checkedFor(r)} />)}</View> : null}
    </Card>
  );

  const again = done ? (
    <Button variant="ghost" small label="↻ Search again" onPress={() => setAttempt((a) => a + 1)} style={{ alignSelf: 'center', marginTop: 4 }} />
  ) : null;

  const main = (
    <View>
      {done && !allRows.length && !misses.length ? <Notice tone="warn">No results came back. Check your connection and try again.</Notice> : null}
      {chosen ? (
        <OneStopNote
          store={chosen.store}
          count={chosen.rows.length}
          splitStores={splitCards.length}
          splitTotal={splitTotal}
          onBack={() => setOneStop(null)}
        />
      ) : null}
      {cards.map((c, i) => (
        <FadeIn key={c.store.id}>
          {i === 1 && offerStops.length ? (
            <OneStopOffer count={splitIds.size} stops={offerStops} splitTotal={splitTotal} splitStores={splitCards.length} onChoose={(id) => setOneStop(id)} />
          ) : null}
          <StoreCard
            store={c.store}
            rows={c.rows}
            reason={c.reason}
            onPick={(itemId, pid) => setPicks((p) => ({ ...p, [itemId]: pid }))}
            onSkip={(itemId, skip) => setSkipped((s) => ({ ...s, [itemId]: skip }))}
          />
        </FadeIn>
      ))}
      {/* Keyed by store: a finished store's card takes its skeleton's place, and the next store's skeleton is a new node
          below it (re-using the old node would count as a big layout shift). */}
      {active ? <StoreSkeleton key={`skel-${active.store.id}`} store={active.store} count={active.count} /> : null}
      {phase === 'stores' ? <SkeletonPlaceholder key="skel-stores" count={items.length} /> : null}
    </View>
  );

  const banner = (
    <RecipeBanner
      compact
      slimOnPhone
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
                Estimated total{unsure ? <Text style={styles.barEach}> · {unsure} counted once</Text> : null}
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
      {phase === 'error' || phase === 'no_stores' ? progress : progressLine}
      {main}
      {notFound}
      {again}
    </Page>
  );
}

/** How a one-stop total compares with the nearest-first split. */
function versusSplit(total: number, splitTotal: number, splitStores: number): string {
  const d = total - splitTotal;
  if (Math.abs(d) < 0.005) return `same as ${splitStores} stops`;
  return `${money(Math.abs(d))} ${d < 0 ? 'less' : 'more'} than ${splitStores} stops`;
}

/** Shown above the second store card when the list is split: farther stores that have everything, in one stop. */
function OneStopOffer({ count, stops, splitTotal, splitStores, onChoose }: { count: number; stops: OneStop[]; splitTotal: number; splitStores: number; onChoose: (storeId: string) => void }) {
  return (
    <View style={styles.offer}>
      <Text style={styles.offerTitle} role="heading" aria-level={3}>
        Or get all {count} in one stop
      </Text>
      {stops.map((o) => {
        const ready = o.status === 'done' && o.complete;
        const meta =
          o.status === 'checking'
            ? 'checking…'
            : o.status === 'error'
              ? "couldn't check"
              : o.complete
                ? versusSplit(o.total, splitTotal, splitStores)
                : `has ${o.rows.length} of ${count}`;
        return (
          <View key={o.store.id} style={styles.offerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.offerStore} numberOfLines={2}>
                {o.store.name}
              </Text>
              <Text style={[styles.offerMeta, ready && o.total < splitTotal && { color: colors.accentDark }]} numberOfLines={2}>
                {o.store.distanceMi.toFixed(1)} mi from you · {meta}
              </Text>
            </View>
            {ready ? (
              <>
                <Text style={styles.offerTotal}>{money(o.total)}</Text>
                <Button
                  small
                  variant="secondary"
                  label="Shop here"
                  onPress={() => onChoose(o.store.id)}
                  accessibilityLabel={`Shop here: all ${count} items at ${o.store.name}, ${money(o.total)}, ${o.store.distanceMi.toFixed(1)} miles from you`}
                />
              </>
            ) : o.status === 'checking' ? (
              <Spinner />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** In one-stop mode: what the list is now, and the way back to the nearest-first split. */
function OneStopNote({ store, count, splitStores, splitTotal, onBack }: { store: Store; count: number; splitStores: number; splitTotal: number; onBack: () => void }) {
  return (
    <View style={[styles.offer, styles.offerChosen]}>
      <Text style={styles.offerTitle} role="heading" aria-level={3}>
        ✓ One stop: all {count} at {store.name}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back to nearest store first: ${splitStores} stores, ${money(splitTotal)}`}
        onPress={onBack}
        hitSlop={6}
        style={(s) => [styles.offerBack, transition, pstate(s).hovered && { opacity: 0.75 }]}
      >
        <Text style={styles.offerBackText}>
          ← Back to nearest store first · {splitStores} stores · {money(splitTotal)}
        </Text>
      </Pressable>
    </View>
  );
}

/** Before the stores are known: a store-card-shaped placeholder with one row per item. */
function SkeletonPlaceholder({ count }: { count: number }) {
  return (
    <View style={styles.skelCard}>
      <View style={{ height: 5 }} />
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 18, paddingBottom: 12 }}>
        <Skeleton width={48} height={48} radius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="70%" height={10} />
        </View>
      </View>
      <View style={styles.skelCount}>
        <Skeleton width={160} height={10} />
      </View>
      <SkeletonRows count={count} />
    </View>
  );
}

function RunRow({ run, checked }: { run: Run; checked?: { found: number; of: number } }) {
  const { store } = run;
  const state: RunState | 'checked' = checked ? 'checked' : run.state;
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
    case 'checked':
      text = `${checked!.found} of ${checked!.of} · for one stop`;
      break;
    default:
      text = 'Not needed';
  }
  const barColor = state === 'done' ? colors.accentBright : state === 'checked' ? colors.borderStrong : state === 'error' ? colors.danger : colors.border;
  const fill =
    state === 'done' ? (run.count ? Math.max(0.06, run.found.length / run.count) : 1) : state === 'checked' ? checked!.found / Math.max(1, checked!.of) : state === 'error' ? 1 : 0;
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

function buildPlainList(title: string, cards: { store: Store; rows: StoreRow[] }[], misses: Miss[], total: number, skippedCount: number): string {
  const out: string[] = [`${title}: shopping list`, ''];
  const skipped: string[] = [];
  for (const { store, rows } of cards) {
    const kept = rows.filter((r) => !r.skipped);
    for (const r of rows) if (r.skipped) skipped.push(r.item.name);
    if (!kept.length) continue;
    out.push(`${store.name} (${store.distanceMi.toFixed(1)} mi), ${store.address}`);
    // One header per aisle group, even if rows of a group aren't adjacent.
    const groups = new Map<string, StoreRow[]>();
    for (const r of kept) {
      const g = aisleGroupName(r.product.aisle);
      groups.set(g, [...(groups.get(g) ?? []), r]);
    }
    for (const [group, groupRows] of groups) {
      out.push(`  ${group}`);
      for (const r of groupRows) {
        const { item, product, plan, substitute } = r;
        const each = effectivePrice(product);
        const line = lineTotal(r);
        const packs = plan.packs > 1 ? `${plan.packs} × ` : '';
        const price = line === undefined ? '' : plan.packs > 1 && each !== undefined ? `, ${money(line)} (${plan.packs} × ${money(each)})` : `, ${money(line)}`;
        const where = aisleDetail(product.aisle);
        const qty = qtyLabel(item);
        const note = substitute ? `; closest match: ${substitute.reason}` : '';
        out.push(
          `    [ ] ${packs}${product.description}${product.size ? `, ${product.size}` : ''}${price}${where ? ` [${where}]` : ''}  (${item.name}${qty ? `, ${qty}` : ''}${note})`,
        );
      }
    }
    out.push('');
  }
  if (misses.length) {
    out.push('Not found nearby');
    for (const { item } of misses) out.push(`    [ ] ${item.name}${qtyLabel(item) ? `, ${qtyLabel(item)}` : ''}`);
    out.push('');
  }
  if (skippedCount && skipped.length) {
    out.push(`Skipped: ${skipped.join(', ')}`);
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
  offer: {
    backgroundColor: colors.accentTint,
    borderWidth: 1.5,
    borderColor: colors.accentSoft,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 4,
  },
  offerChosen: { borderColor: colors.accentBright },
  offerTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800', color: colors.accentDark, letterSpacing: 0.3, marginBottom: 2 },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 2 },
  offerStore: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.text },
  offerMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  offerTotal: { fontFamily: fonts.body, fontSize: 16, fontWeight: '800', color: colors.text },
  offerBack: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start' },
  offerBackText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: colors.accentDark },
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
  skelCard: { backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: 20, overflow: 'hidden' },
  skelCount: { paddingHorizontal: 18, paddingVertical: 13, backgroundColor: colors.bg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  barTotal: { fontFamily: fonts.display, fontSize: 26, fontWeight: '700', color: colors.ink },
  barNote: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.muted },
  barStatus: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text, flex: 1 },
});
