/**
 * useHomeForm: all behaviour behind the home page, shared by every home variant (HomeA/B/C).
 * Variants only render; they never call the API or touch app state themselves.
 *
 * Returns (stable API):
 *
 * Recipe input
 * - `mode`: 'url' | 'text'. `setMode(m)`, `toggleMode()` switch between the link box and the paste box (clears the error).
 * - `url`, `setUrl(s)`, `text`, `setText(s)`: controlled input values.
 * - `urlPlaceholder`: placeholder for the link box ("Paste a recipe link…", or a demo hint in ?demo=1).
 * - `submit()`: validates, then calls fetchRecipe (real, ?mock=1 or ?demo=1 replay) and navigates to /review.
 *   On 'blocked' | 'no_recipe' | 'not_found' | 'network' errors it switches `mode` to 'text' (paste fallback)
 *   and sets `error`. Safe to call repeatedly (ignored while loading). Wire it to the button and onSubmitEditing.
 * - `loading`: true while the recipe is being read.
 * - `loadingSteps` (3 strings, first is "Reading recipe…") and `loadingStep` (0..2): cycling progress text while loading.
 * - `error`: string | null, a friendly message to show near the input. `clearError()`.
 * - `isDemo`, `isMock`: dev/demo flags (?demo=1 / ?mock=1). In demo mode an empty link is allowed.
 *
 * Location (default: Seattle · Capitol Hill preset; stores are fetched in the background on every change)
 * - `locMode`: 'preset' | 'gps' | 'zip' (which option is selected).
 * - `locationLabel`: short display text for a compact control: "Seattle · Capitol Hill", "My location",
 *   "Locating…", "ZIP 98103" or "ZIP code" (ZIP selected but not typed yet).
 * - `choosePreset()`, `chooseMyLocation()` (async; on denied/timeout/unsupported it falls back to the preset and sets
 *   `locationNotice`), `chooseZip()` (selects ZIP mode; render a ZIP input while `locMode === 'zip'`).
 * - `zip`, `setZip(s)`: the ZIP input (digits only, max 5); a valid 5-digit ZIP immediately becomes the location.
 * - `zipMissing`: ZIP mode selected but no valid ZIP yet (submit is blocked with an error).
 * - `locating`: geolocation in progress. `locationNotice`: string | null, e.g. "Location permission was denied. Using …".
 * - `stores`: { status: 'idle' | 'loading' | 'ready' | 'empty' | 'error', nearest?: Store, count: number, message?: string }
 *   for the current location, plus `retryStores()`. Optional to display.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ApiCallError } from '../../lib/client/api';
import { sampleOrigin, sampleRecipe } from '../../lib/client/demo';
import { getBrowserLocation, isValidZip, LocationError, SEATTLE_PRESET, type UserLocation } from '../../lib/client/location';
import { client, endSampleRun, isDemoMode, isMockMode, presetLocation, shortLocationLabel, startSampleRun } from '../../lib/client/mock';
import { storesKey, useAppState } from '../../lib/client/state';
import type { Store } from '../../lib/shared/types';

export type RecipeMode = 'url' | 'text';
export type LocationMode = 'gps' | 'zip' | 'preset';

export type HomeStores = {
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  nearest?: Store;
  count: number;
  message?: string;
};

export type HomeForm = {
  mode: RecipeMode;
  setMode: (m: RecipeMode) => void;
  toggleMode: () => void;
  url: string;
  setUrl: (s: string) => void;
  text: string;
  setText: (s: string) => void;
  urlPlaceholder: string;
  submit: () => Promise<void>;
  loading: boolean;
  loadingSteps: string[];
  loadingStep: number;
  error: string | null;
  clearError: () => void;
  isDemo: boolean;
  isMock: boolean;

  locMode: LocationMode;
  locationLabel: string;
  choosePreset: () => void;
  chooseMyLocation: () => Promise<void>;
  chooseZip: () => void;
  zip: string;
  setZip: (s: string) => void;
  zipMissing: boolean;
  locating: boolean;
  locationNotice: string | null;
  stores: HomeStores;
  retryStores: () => void;

  /** Label of the default Seattle location option. */
  presetLabel: string;
  /** "Try an example" links that fill the recipe box. */
  examples: { label: string; site: string; url: string }[];
  pickExample: (url: string) => void;
  /** Opens the recorded replay (no API calls): straight to /review with the sample recipe. */
  runSample: () => void;
};

/** Recipe links that are known to work end to end (the first one is the recorded sample run). */
export const EXAMPLES = [
  { label: 'Tikka masala', site: 'BBC Good Food', url: 'https://www.bbcgoodfood.com/recipes/chicken-tikka-masala' },
  { label: 'Bolognese', site: 'BBC Good Food', url: 'https://www.bbcgoodfood.com/recipes/best-spaghetti-bolognese-recipe' },
];

/** Error codes where the right move is "paste the ingredients instead". */
const PASTE_FALLBACK_CODES = new Set(['blocked', 'no_recipe', 'not_found', 'network']);
const LOADING_STEPS = ['Reading recipe…', 'Finding the ingredient list…', 'Turning lines into grocery searches…'];

export function useHomeForm(): HomeForm {
  const router = useRouter();
  const { setRecipe, location, setLocation, loadStores, stores: storesState } = useAppState();
  const isDemo = isDemoMode();
  const isMock = isMockMode();

  const [mode, setModeState] = useState<RecipeMode>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const preset = presetLocation();
  const [locMode, setLocMode] = useState<LocationMode>(() =>
    'zip' in location ? 'zip' : location.label !== preset.label ? 'gps' : 'preset',
  );
  const [zip, setZipState] = useState(() => ('zip' in location ? location.zip : ''));
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const zipMissing = locMode === 'zip' && !isValidZip(zip);

  // Prewarm: fetch stores for the current location as soon as the page loads (also warms the server).
  useEffect(() => {
    loadStores().catch(() => {});
  }, [loadStores]);

  // Cycle the loading message so the wait feels alive.
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const t = setInterval(() => setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 1600);
    return () => clearInterval(t);
  }, [loading]);

  const setMode = (m: RecipeMode) => {
    setModeState(m);
    setError(null);
  };

  const submit = async () => {
    if (loading) return;
    setError(null);
    const input = mode === 'url' ? url.trim() : text.trim();
    if (!input && !isDemo) {
      setError(mode === 'url' ? 'Paste a recipe link first.' : 'Paste at least one ingredient line.');
      return;
    }
    if (zipMissing) {
      setError('Enter a 5-digit ZIP code, or pick another location.');
      return;
    }
    // Their own recipe after "See a sample run": go back to live data (a `?demo=1` URL keeps replaying).
    if (input && endSampleRun() && locMode === 'preset') setLocation(SEATTLE_PRESET);
    setLoading(true);
    loadStores().catch(() => {}); // make sure stores are on their way while the recipe is read
    try {
      const recipe = await client.fetchRecipe(mode === 'url' ? { url: input } : { text: input });
      if (!recipe.items.length) {
        setError("We couldn't find any ingredients there. Paste them below instead.");
        setModeState('text');
        return;
      }
      setRecipe(recipe);
      router.push('/review');
    } catch (e) {
      const code = e instanceof ApiCallError ? e.code : undefined;
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      if (mode === 'url' && code && PASTE_FALLBACK_CODES.has(code)) {
        setError(`${msg} Paste the ingredient list instead.`);
        setModeState('text');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const choosePreset = () => {
    setLocMode('preset');
    setLocationNotice(null);
    setLocation(presetLocation());
  };

  const chooseMyLocation = async () => {
    setLocMode('gps');
    setLocationNotice(null);
    setLocating(true);
    try {
      const pos = await getBrowserLocation();
      setLocation({ ...pos, label: 'your location' });
    } catch (e) {
      const why = e instanceof LocationError ? e.message : "Couldn't get your location.";
      setLocationNotice(`${why} Using ${presetLocation().label} instead.`);
      setLocMode('preset');
      setLocation(presetLocation());
    } finally {
      setLocating(false);
    }
  };

  const chooseZip = () => {
    setLocMode('zip');
    setLocationNotice(null);
    if (isValidZip(zip)) setLocation({ zip: zip.trim(), label: `ZIP ${zip.trim()}` });
  };

  const setZip = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 5);
    setZipState(clean);
    if (isValidZip(clean)) setLocation({ zip: clean, label: `ZIP ${clean}` });
  };

  const locationLabel = locating
    ? 'Locating…'
    : locMode === 'zip'
      ? isValidZip(zip)
        ? `ZIP ${zip}`
        : 'ZIP code'
      : locMode === 'gps'
        ? 'My location'
        : shortLocationLabel(preset.label);

  const key = storesKey(location);
  let stores: HomeStores = { status: 'idle', count: 0 };
  if (!zipMissing && !locating && 'key' in storesState && storesState.key === key) {
    if (storesState.status === 'loading') stores = { status: 'loading', count: 0 };
    else if (storesState.status === 'error') stores = { status: 'error', count: 0, message: storesState.message };
    else if (storesState.status === 'ready')
      stores = storesState.data.stores.length
        ? { status: 'ready', nearest: storesState.data.stores[0], count: storesState.data.stores.length }
        : { status: 'empty', count: 0 };
  }

  return {
    mode,
    setMode,
    toggleMode: () => setMode(mode === 'url' ? 'text' : 'url'),
    url,
    setUrl,
    text,
    setText,
    urlPlaceholder: isDemo ? 'Demo: no link needed' : 'Paste a recipe link…',
    submit,
    loading,
    loadingSteps: LOADING_STEPS,
    loadingStep,
    error,
    clearError: () => setError(null),
    isDemo,
    isMock,

    locMode,
    locationLabel,
    choosePreset,
    chooseMyLocation,
    chooseZip,
    zip,
    setZip,
    zipMissing,
    locating,
    locationNotice,
    stores,
    retryStores: () => {
      loadStores().catch(() => {});
    },

    presetLabel: shortLocationLabel(preset.label),
    examples: EXAMPLES,
    pickExample: (u: string) => {
      setModeState('url');
      setError(null);
      setUrl(u);
    },
    runSample: () => {
      if (loading) return;
      startSampleRun();
      const o = sampleOrigin();
      const loc: UserLocation = { lat: o.lat, lng: o.lng, label: o.label };
      setLocMode('preset');
      setLocationNotice(null);
      setLocation(loc);
      setRecipe(sampleRecipe());
      router.push('/review');
    },
  };
}
