import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { aisleDetail, cap, effectivePrice, itemStyle, money, qtyLabel } from '../components/format';
import { cheaperOption } from '../lib/shared/cheaper';
import { haversineMiles } from '../lib/shared/haversine';
import { readChoices, writeChoices } from '../lib/client/resultsSession';
import { storesKey } from '../lib/client/state';
import { RecipeBanner } from '../components/RecipeBanner';
import { lineTotal, SkeletonRows, StoreCard, type StoreRow } from '../components/StoreCard';
import { chainColor, colors, fonts, radius, transition, useBreakpoint, web } from '../components/theme';
import { Button, Card, FadeIn, Notice, Page, pstate, Skeleton, Spinner } from '../components/ui';
import { clientMode } from '../lib/client/mock';
import { getPreferred, mapsUrlFor, togglePreferred, usePreferredStores } from '../lib/client/preferredStores';
import { clearSearchCache, eachLimit, searchStoreCached } from '../lib/client/storeSearch';
import { useAppState } from '../lib/client/state';
import { aisleGroupName, compareAisles } from '../lib/shared/aisleSort';
import { packPlan } from '../lib/shared/packs';
import { candidateStores, choosePlan, FAR_MI, milesLabel, priorityOrder, type PlanOption, type PlanResult, type StoreOffer } from '../lib/shared/plan';
import type { Item, ItemResult, SearchRequest, Store, StoresResponse } from '../lib/shared/types';

/** The nearest stores searched (preferred stores are searched as well). */
const MAX_NEAREST = 3;
/** Stores searched at once: Kroger answers bursts with 403s (the server retries those). */
const MAX_PARALLEL = 3;

type RunState = 'waiting' | 'searching' | 'done' | 'error';
/** One store's search for the whole list. */
type Run = { store: Store; state: RunState; results: ItemResult[]; error?: string };
type Miss = { item: Item; reason: 'no_match' | 'unavailable' };
type Phase = 'stores' | 'searching' | 'done' | 'no_stores' | 'error';
type CardData = { store: Store; rows: StoreRow[]; reason?: string };

/** Why an item isn't bought at a store that ranks higher, in the words the data supports. */
function passReason(r: ItemResult | undefined, store: Store): string {
  if (!r) return `Not returned by ${store.name}`;
  if (r.status === 'no_match') return `No good match at ${store.name}`;
  if (r.best?.stockLevel === 'TEMPORARILY_OUT_OF_STOCK') return `Out of stock at ${store.name}`;
  if (r.best?.inStore === false) return `Not sold in-store at ${store.name}`;
  return `Not in stock at ${store.name}`;
}

function toRequestItem(i: Item): SearchRequest['items'][number] {
  return { id: i.id, name: i.name, searchTerm: i.searchTerm, altTerms: i.altTerms, department: i.department, avoidWords: i.avoidWords, quantity: i.quantity, unit: i.unit };
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function Results() {
  const router = useRouter();
  const { recipe, selectedIds, location, loadStores } = useAppState();
  const { isDesktop } = useBreakpoint();
  const preferred = usePreferredStores();
  const preferredIds = useMemo(() => preferred.map((s) => s.id), [preferred]);

  const items = useMemo(() => (recipe ? recipe.items.filter((i) => selectedIds.includes(i.id)) : []), [recipe, selectedIds]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [phase, setPhase] = useState<Phase>('stores');
  const [fatal, setFatal] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  // Swaps, skips and the picked plan survive a refresh (sessionStorage, keyed by recipe, items and location).
  const choicesKey = `${storesKey(location)}|${recipe?.title ?? ''}|${recipe?.sourceUrl ?? ''}|${items.map((i) => i.id).join(',')}`;
  const [restored] = useState(() => readChoices(choicesKey));
  const [picks, setPicks] = useState<Record<string, string>>(restored.picks);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [showRuns, setShowRuns] = useState(false);
  const [skipped, setSkipped] = useState<Record<string, boolean>>(restored.skipped);
  const [choice, setChoice] = useState<string | null>(restored.plan);

  useEffect(() => {
    writeChoices(choicesKey, { picks, skipped, plan: choice });
  }, [choicesKey, picks, skipped, choice]);

  // Search the whole list at every candidate store (the nearest few plus the preferred stores), a few at a time.
  useEffect(() => {
    const wanted = itemsRef.current;
    if (!wanted.length) return;
    let cancelled = false;
    const patchRun = (id: string, patch: Partial<Run>) => setRuns((prev) => prev.map((r) => (r.store.id === id ? { ...r, ...patch } : r)));

    setPhase('stores');
    setFatal(null);
    setRuns([]);
    if (attempt > 0) {
      // "Search again" starts fresh; the first run keeps choices restored after a refresh.
      setPicks({});
      setSkipped({});
      setChoice(null);
      clearSearchCache();
    }

    (async () => {
      let data: StoresResponse;
      try {
        data = await loadStores();
      } catch (e) {
        if (cancelled) return;
        setFatal(`Couldn't find nearby stores: ${errMsg(e)}`);
        setPhase('error');
        return;
      }
      if (cancelled) return;
      // The replay and mock data only know their own stores, so other preferred stores are left out there.
      const known = clientMode() === 'live' ? undefined : new Set(data.stores.map((s) => s.id));
      const saved = getPreferred().map((s) => ({ ...s, mapsUrl: mapsUrlFor(s) }));
      const candidates = candidateStores(data.stores.slice(0, MAX_NEAREST), saved, data.origin, known);
      if (!candidates.length) {
        setPhase('no_stores');
        return;
      }
      setRuns(candidates.map((store) => ({ store, state: 'waiting', results: [] })));
      setPhase('searching');

      const req = wanted.map(toRequestItem);
      await eachLimit(candidates, MAX_PARALLEL, async (store) => {
        if (cancelled) return;
        patchRun(store.id, { state: 'searching' });
        try {
          const res = await searchStoreCached({ storeId: store.id, items: req });
          if (!cancelled) patchRun(store.id, { state: 'done', results: res.results });
        } catch (e) {
          if (!cancelled) patchRun(store.id, { state: 'error', error: errMsg(e) });
        }
      });
      if (!cancelled) setPhase('done');
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

  const rowsByStore = useMemo(() => new Map(runs.filter((r) => r.state === 'done').map((r) => [r.store.id, makeRows(r.results)])), [runs, makeRows]);

  // Which store(s) to shop at: see lib/shared/plan.ts for the rules.
  const plan: PlanResult<Store> = useMemo(() => {
    const offers: StoreOffer<Store>[] = runs.map((r) => ({
      store: r.store,
      status: r.state === 'done' ? 'done' : r.state === 'error' ? 'error' : 'pending',
      costs: Object.fromEntries((rowsByStore.get(r.store.id) ?? []).map((row) => [row.item.id, row.skipped ? 0 : (lineTotal(row) ?? 0)])),
    }));
    return choosePlan({ itemIds: items.map((i) => i.id), offers, preferredIds, choice });
  }, [runs, rowsByStore, items, preferredIds, choice]);

  const done = phase === 'done';
  const shown = done ? plan.shown : undefined;

  const cards = useMemo<CardData[]>(() => {
    if (!shown) return [];
    if (shown.kind === 'store') return [{ store: shown.stores[0], rows: rowsByStore.get(shown.id) ?? [] }];
    // Split: each store's share, with why an item isn't at a store that ranks higher.
    const runById = new Map(runs.map((r) => [r.store.id, r]));
    const order = priorityOrder(
      runs.map((r) => r.store),
      preferredIds,
    );
    // Every store that ranks above the one an item is bought at lacks it (or couldn't be searched): name the top one.
    const firstReason = (itemId: string, storeId: string): string | undefined => {
      const above = order.findIndex((x) => x.id === storeId) > 0 ? order[0] : undefined;
      if (!above) return undefined;
      const r = runById.get(above.id)!;
      return r.state === 'error' ? `${above.name} couldn't be searched` : passReason(r.results.find((x) => x.itemId === itemId), above);
    };
    const out: CardData[] = [];
    shown.stores.forEach((store, idx) => {
      const ids = new Set(Object.keys(shown.assign).filter((id) => shown.assign[id] === store.id));
      const results = (runById.get(store.id)?.results ?? []).filter((x) => ids.has(x.itemId));
      const rows = makeRows(results, (itemId) => firstReason(itemId, store.id));
      // One line under a later store's header: why it's on the list, and how far it is from the previous stop.
      let reason: string | undefined;
      const prev = out[out.length - 1]?.store;
      const notes = [...new Set(rows.map((x) => x.fallbackNote).filter((x): x is string => !!x))];
      if (idx > 0 && notes.length) {
        const hop = prev ? ` · ${haversineMiles(prev.lat, prev.lng, store.lat, store.lng).toFixed(1)} mi from ${prev.name}` : '';
        reason = notes.length === 1 ? `${notes[0]}${hop}` : `Not available at ${idx === 1 && prev ? prev.name : 'the stores above'}${hop}`;
      }
      out.push({ store, rows, reason });
    });
    return out;
  }, [shown, runs, rowsByStore, preferredIds, makeRows]);

  if (!recipe) return <Redirect href="/" />;
  if (!items.length) return <Redirect href="/review" />;

  const doneRuns = runs.filter((r) => r.state === 'done');
  const misses: Miss[] = done
    ? items
        .filter((i) => !plan.needed.includes(i.id))
        .map((item) => ({
          item,
          reason: doneRuns.length && doneRuns.every((r) => r.results.find((x) => x.itemId === item.id)?.status === 'no_match') ? 'no_match' : 'unavailable',
        }))
    : [];
  const shownRows = cards.flatMap((c) => c.rows);
  const allRows = shownRows.filter((r) => !r.skipped);
  const skippedCount = shownRows.length - allRows.length;
  const total = allRows.reduce((s, r) => s + (lineTotal(r) ?? 0), 0);
  const unpriced = allRows.filter((r) => effectivePrice(r.product) === undefined).length;
  // "Estimated" either way (some produce is priced per lb); say so when some rows could only be counted once.
  const unsure = allRows.filter((r) => !r.plan.confident).length;
  const totalNote = unsure ? `${unsure} item${unsure === 1 ? '' : 's'} counted once: check “Recipe needs”` : 'Quantities from the recipe, rounded up to whole packs';
  const searchedStores = doneRuns.length;
  const errored = runs.filter((r) => r.state === 'error');
  const oneStore = cards.length === 1 ? cards[0].store : undefined;
  const options: PlanOption<Store>[] = [...plan.oneStop, ...(plan.splitAlternative && plan.split ? [plan.split] : [])];
  const showChooser = done && !!shown && options.length >= 2;
  const cheaper = done ? plan.cheaper : undefined;
  const choose = (id: string) => setChoice(id);

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

  const copyLabel = copied === 'ok' ? '✓ Copied!' : copied === 'fail' ? "Couldn't copy" : 'Copy list';
  const where = oneStore ? oneStore.name : plural(cards.length, 'store');
  const statusLine =
    phase === 'stores'
      ? `Finding stores near ${location.label}…`
      : phase === 'searching'
        ? `Checking ${plural(runs.length, 'store')} for ${plural(items.length, 'item')}…`
        : done
          ? `Found ${shownRows.length} of ${plural(items.length, 'item')} at ${where}`
          : phase === 'no_stores'
            ? 'No stores nearby'
            : phase === 'error'
              ? 'Something went wrong'
              : 'Getting ready…';

  const runRows = runs.map((r) => (
    <RunRow key={r.store.id} run={r} of={items.length} preferred={preferredIds.includes(r.store.id)} shopping={cards.some((c) => c.store.id === r.store.id)} />
  ));

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
        : runRows}
      {errored.length ? <Text style={[styles.muted, { color: colors.danger, marginTop: 8 }]}>Some stores couldn't be searched.</Text> : null}
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
      {done ? <Text style={styles.summaryTotal}>{money(total)}</Text> : <Skeleton width={150} height={44} radius={10} style={{ marginVertical: 5 }} />}
      <Text style={styles.muted} numberOfLines={2}>
        {done
          ? `${plural(allRows.length, 'item')} ${oneStore ? 'at' : 'across'} ${where}${skippedCount ? ` · ${skippedCount} skipped` : ''}${unpriced ? ` · ${unpriced} without price` : ''}`
          : `Searching ${plural(items.length, 'item')}…`}
      </Text>
      {cheaper ? <CheaperNote cheaper={cheaper} onSwitch={choose} /> : null}
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
      <Text style={styles.summaryHint}>{oneStore ? `Plain text for ${oneStore.name}, in aisle order.` : 'Plain text, grouped by store and aisle.'} Paste it into Notes or a text.</Text>
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
      {showRuns ? <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>{runRows}</View> : null}
    </Card>
  );

  const again = done ? (
    <Button variant="ghost" small label="↻ Search again" onPress={() => setAttempt((a) => a + 1)} style={{ alignSelf: 'center', marginTop: 4 }} />
  ) : null;

  const main = (
    <View>
      {done && !allRows.length && !misses.length ? <Notice tone="warn">No results came back. Check your connection and try again.</Notice> : null}
      {showChooser ? (
        <FadeIn>
          <PlanChooser options={options} shownId={shown!.id} cheapestId={plan.cheapestId} nearestId={plan.nearestId} onChoose={choose} />
        </FadeIn>
      ) : null}
      {cards.map((c) => (
        <FadeIn key={c.store.id}>
          <StoreCard
            store={c.store}
            rows={c.rows}
            reason={c.reason}
            preferred={preferredIds.includes(c.store.id)}
            onTogglePreferred={() => togglePreferred(c.store)}
            onPick={(itemId, pid) => setPicks((p) => ({ ...p, [itemId]: pid }))}
            onSkip={(itemId, skip) => setSkipped((s) => ({ ...s, [itemId]: skip }))}
          />
        </FadeIn>
      ))}
      {/* One placeholder while stores are found and searched: the same node throughout, so nothing shifts until the
          plan is ready and replaces it. */}
      {phase === 'stores' || phase === 'searching' ? <SkeletonPlaceholder key="skel" count={items.length} /> : null}
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
          <View>
            {cheaper ? <CheaperNote cheaper={cheaper} onSwitch={choose} compact /> : null}
            <View style={styles.bar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.barLabel}>
                  Estimated total{unsure ? <Text style={styles.barEach}> · {unsure} counted once</Text> : null}
                </Text>
                <Text style={styles.barTotal}>
                  {money(total)}
                  <Text style={styles.barNote}>
                    {'  '}
                    {plural(allRows.length, 'item')}
                  </Text>
                </Text>
              </View>
              <Button label={copyLabel} onPress={copyList} variant={copied === 'ok' ? 'secondary' : 'primary'} style={{ minWidth: 140 }} accessibilityLabel="Copy list" />
            </View>
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

/** "QFC Harvard Market has everything for $6.90 less (1.1 mi)", with a way to switch. Sits by the total. */
function CheaperNote({ cheaper, onSwitch, compact }: { cheaper: NonNullable<PlanResult<Store>['cheaper']>; onSwitch: (id: string) => void; compact?: boolean }) {
  const { option, saving } = cheaper;
  const s = option.stores[0];
  const text = `${s.name} has everything for ${money(saving)} less (${milesLabel(s.distanceMi).replace(' ', '\u00a0')})`;
  return (
    <View style={[styles.note, compact && styles.noteCompact]}>
      <Text style={[styles.noteText, compact && { fontSize: 13 }]} numberOfLines={3}>
        {text}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch to ${s.name}, ${money(option.total)}`}
        onPress={() => onSwitch(option.id)}
        hitSlop={8}
        style={(st) => [styles.noteBtn, transition, pstate(st).hovered && { backgroundColor: '#D9EBDF' }]}
      >
        <Text style={styles.noteBtnText}>Switch</Text>
      </Pressable>
    </View>
  );
}

/** The plans worth comparing: every store that has everything, plus the split when it differs. The shown one is checked. */
function PlanChooser({
  options,
  shownId,
  cheapestId,
  nearestId,
  onChoose,
}: {
  options: PlanOption<Store>[];
  shownId: string;
  cheapestId?: string;
  nearestId?: string;
  onChoose: (id: string) => void;
}) {
  const stores = options.filter((o) => o.kind === 'store').length;
  return (
    <View style={styles.chooser} accessibilityRole="radiogroup" accessibilityLabel="Where to shop">
      <Text style={styles.chooserTitle} role="heading" aria-level={3}>
        {stores >= 2 ? `${stores} stores have everything` : 'Where to shop'}
      </Text>
      {options.map((o, i) => {
        const on = o.id === shownId;
        const first = o.stores[0];
        const far = o.kind === 'store' && first.distanceMi > FAR_MI;
        const name = o.kind === 'split' ? `Split across ${o.stores.length} stores` : first.name;
        const meta =
          o.kind === 'split'
            ? o.stores.map((s) => s.name).join(', then ')
            : [`${milesLabel(first.distanceMi)}${far ? ' away' : ''}`, o.id === nearestId ? 'Nearest' : '', o.preferred ? 'Preferred' : ''].filter(Boolean).join(' · ');
        const cheapest = o.id === cheapestId;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            aria-checked={on}
            accessibilityLabel={`${name}, ${o.kind === 'split' ? meta : `${first.distanceMi.toFixed(1)} miles`}, ${money(o.total)}${cheapest ? ', cheapest' : ''}${o.id === nearestId ? ', nearest' : ''}${o.preferred ? ', preferred' : ''}`}
            onPress={() => onChoose(o.id)}
            style={(s) => [styles.opt, i > 0 && styles.optBorder, transition, on && styles.optOn, !on && pstate(s).hovered && { backgroundColor: colors.accentTint }]}
          >
            <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.optName} numberOfLines={2}>
                {o.preferred && o.kind === 'store' ? <Text style={styles.optStar}>★ </Text> : null}
                {name}
              </Text>
              <Text style={[styles.optMeta, far && { color: colors.warn }]} numberOfLines={2}>
                {meta}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.optTotal, cheapest && { color: colors.accentDark }]}>{money(o.total)}</Text>
              {cheapest ? <Text style={styles.optCheapest}>Cheapest</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Before the plan is ready: a store-card-shaped placeholder with one row per item. */
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

function RunRow({ run, of, preferred, shopping }: { run: Run; of: number; preferred: boolean; shopping: boolean }) {
  const { store, state } = run;
  const c = chainColor(store.chain);
  const found = run.results.filter((r) => r.status === 'found' && r.best).length;
  const text =
    state === 'waiting' ? 'Waiting' : state === 'searching' ? 'Searching…' : state === 'error' ? "Couldn't search" : `${found} of ${of} found${shopping ? ' · on your list' : ''}`;
  const barColor = state === 'done' ? (shopping ? colors.accentBright : colors.borderStrong) : state === 'error' ? colors.danger : colors.border;
  const fill = state === 'done' ? Math.max(0.06, found / Math.max(1, of)) : state === 'error' ? 1 : 0;
  const far = store.distanceMi > FAR_MI;
  return (
    <View style={styles.runRow}>
      <View style={[styles.runBadge, { backgroundColor: c.bg }]}>
        <Text style={styles.runBadgeText}>{c.initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.runName} numberOfLines={1}>
          {preferred ? <Text style={styles.optStar}>★ </Text> : null}
          {store.name}
        </Text>
        <View style={styles.runTop}>
          <Text style={[styles.runDist, far && { color: colors.warn, fontWeight: '700' }]}>{milesLabel(store.distanceMi)} away</Text>
          <Text style={[styles.runState, state === 'done' && shopping && { color: colors.accentDark }, state === 'error' && { color: colors.danger }]}>{text}</Text>
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

function buildPlainList(title: string, cards: CardData[], misses: Miss[], total: number, skippedCount: number): string {
  const out: string[] = [cards.length === 1 ? `${title}: shopping list for ${cards[0].store.name}` : `${title}: shopping list`, ''];
  const skipped: string[] = [];
  for (const { store, rows } of cards) {
    const kept = rows.filter((r) => !r.skipped);
    for (const r of rows) if (r.skipped) skipped.push(r.item.name);
    if (!kept.length) continue;
    out.push(`${store.name} (${milesLabel(store.distanceMi)}), ${store.address}`);
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
  chooser: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 6,
    marginBottom: 16,
  },
  chooserTitle: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 10, marginBottom: 4 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md },
  optBorder: { borderTopWidth: 1, borderTopColor: colors.border, borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  optOn: { backgroundColor: colors.accentTint },
  optName: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.text },
  optStar: { color: colors.warn },
  optMeta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 1 },
  optTotal: { fontFamily: fonts.body, fontSize: 16, fontWeight: '800', color: colors.text },
  optCheapest: { fontFamily: fonts.body, fontSize: 11.5, fontWeight: '800', color: colors.accentDark, marginTop: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingVertical: 8, paddingLeft: 12, paddingRight: 6, borderRadius: radius.md, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentSoft },
  noteCompact: { marginTop: 0, marginBottom: 10 },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, fontWeight: '700', color: colors.accentDark, lineHeight: 19 },
  noteBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.accentSoft },
  noteBtnText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '800', color: colors.accentDark },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  sidebar: { width: 340, gap: 16, ...web({ position: 'sticky', top: 16 }) },
  panel: { padding: 18, marginBottom: 16 },
  summary: { padding: 22 },
  summaryLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  summaryTotal: { fontFamily: fonts.display, fontSize: 48, lineHeight: 54, fontWeight: '700', color: colors.ink, letterSpacing: -1, marginVertical: 2 },
  eachHint: { fontFamily: fonts.body, fontSize: 12, color: colors.faint, marginTop: 8, lineHeight: 17 },
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
