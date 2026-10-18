import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, transition, web } from '../theme';
import { pstate } from '../ui';
import { useHomeForm, type HomeForm } from './useHomeForm';

/**
 * Home page layout ("food hero"): a full-viewport background with one Airbnb-style search bar
 * [recipe link | location ▾ | Go] centered on it. All behaviour comes from useHomeForm().
 */

// Overhead shot of fresh ingredients on a cutting board (Unsplash, free licence).
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&w=1920&q=70';

/** Below this width the pill becomes a stacked card. */
const STACK_BELOW = 700;
const BAR_MAX = 760;

const WHITE_DIM = 'rgba(255,255,255,0.86)';
const HEADLINE_ACCENT = '#F7C978';

export interface HomeCProps {
  /**
   * Replaces the default background (warm gradient → photo → dark overlay). Rendered absolutely behind
   * everything; it must keep enough contrast for the white headline (include its own overlay if needed).
   */
  background?: ReactNode;
}

export default function HomeC({ background }: HomeCProps = {}) {
  const f = useHomeForm();
  const { width, height } = useWindowDimensions();
  const stacked = width < STACK_BELOW;
  const isPhone = width < 640;
  const barWidth = Math.min(BAR_MAX, width - (isPhone ? 32 : 48));
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgReady, setImgReady] = useState(false);

  // Escape closes the location menu (web).
  useEffect(() => {
    if (!menuOpen || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const go = () => {
    setMenuOpen(false);
    void f.submit();
  };

  const h1Size = width >= 1024 ? 66 : width >= 640 ? 54 : 40;

  return (
    <View style={styles.root}>
      {/* Background: warm gradient fallback → photo → dark overlay, unless a variant passes its own. */}
      {background ?? (
        <>
          <View style={[StyleSheet.absoluteFill, styles.warm]} pointerEvents="none" />
          <View
            style={[StyleSheet.absoluteFill, styles.photo, { opacity: imgReady ? 1 : 0 }, imgReady && styles.photoIn]}
            pointerEvents="none"
            aria-hidden
          >
            <Image
              source={{ uri: HERO_IMAGE }}
              resizeMode="cover"
              onLoad={() => setImgReady(true)}
              style={StyleSheet.absoluteFill}
              accessibilityIgnoresInvertColors
            />
          </View>
          <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none" />
        </>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { minHeight: height }]}>
          <View style={[styles.nav, { paddingHorizontal: isPhone ? 16 : 32 }]}>
            <LogoLight />
          </View>

          <View style={[styles.center, { paddingHorizontal: isPhone ? 16 : 24, paddingBottom: isPhone ? 40 : 88 }]}>
            {menuOpen ? (
              <Pressable
                style={[StyleSheet.absoluteFill, styles.backdrop]}
                onPress={() => setMenuOpen(false)}
                accessibilityLabel="Close location menu"
                accessibilityRole="button"
                focusable={false}
              />
            ) : null}
            <Text
              accessibilityRole="header"
              style={[
                styles.h1,
                { fontSize: h1Size, lineHeight: Math.round(h1Size * 1.06), letterSpacing: isPhone ? -1 : -1.8 },
              ]}
            >
              Any recipe,{isPhone ? '\n' : ' '}
              <Text style={styles.h1Accent}>sorted by aisle.</Text>
            </Text>
            <Text style={[styles.lead, isPhone && styles.leadPhone]}>
              Paste a link and get a grocery list mapped to the shelves of your nearest QFC, Fred Meyer or other Kroger store.
            </Text>

            <View style={[styles.barZone, { width: barWidth }]}>
              {f.mode === 'text' ? (
                <PasteCard f={f} stacked={stacked} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onGo={go} />
              ) : stacked ? (
                <StackedBar f={f} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onGo={go} />
              ) : (
                <PillBar f={f} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onGo={go} />
              )}

              <BelowBar f={f} />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

type BarProps = {
  f: HomeForm;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  onGo: () => void;
};

/** Desktop / tablet: one white pill. */
function PillBar({ f, menuOpen, setMenuOpen, onGo }: BarProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.pill, focused && styles.pillFocus, transition]}>
      <View style={styles.segRecipe}>
        <Text style={styles.segIcon} aria-hidden>
          🔗
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.segLabel}>Recipe link</Text>
          <TextInput
            style={[styles.pillInput, web({ outlineStyle: 'none' })]}
            value={f.url}
            onChangeText={(s) => {
              f.setUrl(s);
              if (f.error) f.clearError();
            }}
            onFocus={() => {
              setFocused(true);
              setMenuOpen(false);
            }}
            onBlur={() => setFocused(false)}
            placeholder={f.urlPlaceholder}
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            inputMode="url"
            returnKeyType="go"
            onSubmitEditing={onGo}
            editable={!f.loading}
            accessibilityLabel="Recipe link"
            autoFocus={Platform.OS === 'web'}
          />
        </View>
      </View>

      <View style={styles.segDivider} />

      <View style={styles.segLocWrap}>
        <LocationTrigger f={f} open={menuOpen} onToggle={() => setMenuOpen(!menuOpen)} variant="segment" />
        {menuOpen ? <LocationMenu f={f} onClose={() => setMenuOpen(false)} style={styles.menuUnderSegment} /> : null}
      </View>

      <GoButton f={f} onPress={onGo} label="Go" style={styles.goPill} />
    </View>
  );
}

/** Phones: the same three controls stacked in a white card. */
function StackedBar({ f, menuOpen, setMenuOpen, onGo }: BarProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.card, focused && styles.pillFocus, transition]}>
      <View style={styles.stackRow}>
        <Text style={styles.segIcon} aria-hidden>
          🔗
        </Text>
        <TextInput
          style={[styles.stackInput, web({ outlineStyle: 'none' })]}
          value={f.url}
          onChangeText={(s) => {
            f.setUrl(s);
            if (f.error) f.clearError();
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={f.urlPlaceholder}
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          inputMode="url"
          returnKeyType="go"
          onSubmitEditing={onGo}
          editable={!f.loading}
          accessibilityLabel="Recipe link"
        />
      </View>
      <View style={styles.hairline} />
      <LocationTrigger f={f} open={menuOpen} onToggle={() => setMenuOpen(!menuOpen)} variant="row" />
      {menuOpen ? <LocationOptions f={f} onClose={() => setMenuOpen(false)} inline /> : null}
      <GoButton f={f} onPress={onGo} label="Get my list" style={styles.goStacked} />
    </View>
  );
}

/** Paste-ingredients fallback: the bar grows into a card with a textarea. */
function PasteCard({ f, stacked, menuOpen, setMenuOpen, onGo }: BarProps & { stacked: boolean }) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (Platform.OS === 'web') ref.current?.focus();
  }, []);
  return (
    <View style={[styles.card, styles.pasteCard, focused && styles.pillFocus, transition]}>
      <TextInput
        ref={ref}
        style={[styles.textarea, stacked && { minHeight: 170 }, web({ outlineStyle: 'none', resize: 'vertical' })]}
        value={f.text}
        onChangeText={f.setText}
        onFocus={() => {
          setFocused(true);
          setMenuOpen(false);
        }}
        onBlur={() => setFocused(false)}
        placeholder={'Paste the ingredient list, one per line\n\n2 lb chicken thighs\n1 cup plain yogurt\n1 can crushed tomatoes'}
        placeholderTextColor={colors.faint}
        multiline
        numberOfLines={7}
        textAlignVertical="top"
        editable={!f.loading}
        accessibilityLabel="Ingredient list"
      />
      <View style={styles.hairline} />
      {stacked ? (
        <>
          <LocationTrigger f={f} open={menuOpen} onToggle={() => setMenuOpen(!menuOpen)} variant="row" />
          {menuOpen ? <LocationOptions f={f} onClose={() => setMenuOpen(false)} inline /> : null}
          <GoButton f={f} onPress={onGo} label="Build my list" style={styles.goStacked} />
        </>
      ) : (
        <View style={styles.pasteFooter}>
          <View style={styles.pasteLocWrap}>
            <LocationTrigger f={f} open={menuOpen} onToggle={() => setMenuOpen(!menuOpen)} variant="compact" />
            {menuOpen ? <LocationMenu f={f} onClose={() => setMenuOpen(false)} style={styles.menuUnderCompact} /> : null}
          </View>
          <GoButton f={f} onPress={onGo} label="Build my list" style={styles.goPaste} />
        </View>
      )}
    </View>
  );
}

function GoButton({ f, onPress, label, style }: { f: HomeForm; onPress: () => void; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      // The accessible name starts with the visible label (WCAG 2.5.3), so "click Go" works with voice control.
      accessibilityLabel={f.loading ? f.loadingSteps[f.loadingStep] : label === 'Go' ? 'Go: build my shopping list' : label}
      accessibilityState={{ busy: f.loading, disabled: f.loading }}
      disabled={f.loading}
      onPress={onPress}
      style={(s) => {
        const { hovered, pressed } = pstate(s);
        return [
          styles.go,
          style,
          transition,
          hovered && !f.loading && styles.goHover,
          pressed && !f.loading && web({ transform: 'scale(0.97)' }),
        ];
      }}
    >
      {f.loading ? (
        <WhiteSpinner />
      ) : (
        <>
          <Text style={styles.goText}>{label}</Text>
          <Text style={styles.goArrow} aria-hidden>
            →
          </Text>
        </>
      )}
    </Pressable>
  );
}

function LocationTrigger({
  f,
  open,
  onToggle,
  variant,
}: {
  f: HomeForm;
  open: boolean;
  onToggle: () => void;
  variant: 'segment' | 'row' | 'compact';
}) {
  const busy = f.locating;
  const caret = (
    <Text style={[styles.caret, open && web({ transform: 'rotate(180deg)' }), transition]} aria-hidden>
      ▾
    </Text>
  );
  const pin = busy ? (
    <ActivityIndicator size="small" color={colors.accent} style={{ width: 18 }} />
  ) : (
    <Text style={styles.segIcon} aria-hidden>
      📍
    </Text>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Shopping near ${f.locationLabel}. Change location`}
      accessibilityState={{ expanded: open }}
      onPress={onToggle}
      style={(s) => {
        const { hovered } = pstate(s);
        return [
          variant === 'segment' ? styles.segLoc : variant === 'row' ? styles.locRow : styles.locCompact,
          transition,
          (hovered || open) && (variant === 'row' ? styles.locRowHover : styles.segHover),
        ];
      }}
    >
      {pin}
      {variant === 'segment' ? (
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.segLabel}>Shopping near</Text>
          <Text style={styles.segValue} numberOfLines={1}>
            {f.locationLabel}
          </Text>
        </View>
      ) : (
        <Text style={[styles.locRowText, variant === 'row' && { flex: 1 }]} numberOfLines={1}>
          {variant === 'row' ? <Text style={styles.locRowLead}>Near </Text> : null}
          {f.locationLabel}
        </Text>
      )}
      {caret}
    </Pressable>
  );
}

/** Floating popover (desktop/tablet). */
function LocationMenu({ f, onClose, style }: { f: HomeForm; onClose: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.menu, style]}>
      <LocationOptions f={f} onClose={onClose} />
    </View>
  );
}

function LocationOptions({ f, onClose, inline }: { f: HomeForm; onClose: () => void; inline?: boolean }) {
  const zipRef = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (f.locMode === 'zip') zipRef.current?.focus();
  }, [f.locMode]);

  const s = f.stores;
  let storeLine: string | null = null;
  if (s.status === 'loading') storeLine = 'Finding nearby stores…';
  else if (s.status === 'ready' && s.nearest)
    storeLine = `Nearest: ${s.nearest.name} · ${s.nearest.distanceMi.toFixed(1)} mi`;
  else if (s.status === 'empty') storeLine = 'No QFC, Fred Meyer or other Kroger stores nearby.';

  return (
    <View style={inline ? styles.inlineOptions : undefined} accessibilityRole="radiogroup" accessibilityLabel="Shopping location">
      <Option
        icon="🏙️"
        label={f.presetLabel}
        selected={f.locMode === 'preset'}
        onPress={() => {
          f.choosePreset();
          onClose();
        }}
      />
      <Option
        icon="🧭"
        label={f.locating ? 'Locating…' : 'Use my location'}
        selected={f.locMode === 'gps'}
        busy={f.locating}
        onPress={() => {
          void f.chooseMyLocation();
          onClose();
        }}
      />
      {f.locMode === 'zip' ? (
        <View style={[styles.option, styles.optionOn]}>
          <Text style={styles.optionIcon} aria-hidden>
            🔢
          </Text>
          <TextInput
            ref={zipRef}
            style={[styles.zipInput, web({ outlineStyle: 'none' })]}
            value={f.zip}
            onChangeText={f.setZip}
            placeholder="ZIP code, e.g. 98103"
            placeholderTextColor={colors.faint}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!f.zipMissing) onClose();
            }}
            accessibilityLabel="ZIP code"
          />
          {!f.zipMissing ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Use this ZIP" onPress={onClose} style={styles.zipDone}>
              <Text style={styles.check}>✓</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Option icon="🔢" label="Enter a ZIP code" selected={false} onPress={f.chooseZip} />
      )}

      {storeLine || s.status === 'error' ? (
        <View style={styles.menuFoot}>
          {s.status === 'error' ? (
            <Pressable accessibilityRole="button" onPress={f.retryStores} style={{ minHeight: 32, justifyContent: 'center' }}>
              <Text style={[styles.menuFootText, { color: colors.danger }]}>Couldn't load stores. Tap to retry.</Text>
            </Pressable>
          ) : (
            <Text style={styles.menuFootText} numberOfLines={1}>
              {storeLine}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function Option({
  icon,
  label,
  selected,
  onPress,
  busy,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={(st) => [styles.option, transition, pstate(st).hovered && styles.optionHover, selected && styles.optionOn]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent} style={{ width: 22 }} />
      ) : (
        <Text style={styles.optionIcon} aria-hidden>
          {icon}
        </Text>
      )}
      <Text style={[styles.optionText, selected && { color: colors.accentDark }]}>{label}</Text>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

/** A bold white ring spinner: ActivityIndicator renders greyish on the green button. */
function WhiteSpinner() {
  if (Platform.OS !== 'web') return <ActivityIndicator size="small" color="#fff" />;
  return <View style={styles.spinner} accessibilityElementsHidden />;
}

/** "Try an example": a recorded sample run plus a couple of recipe links that fill the box and submit. In ?demo=1 only the sample run. */
function Examples({ f }: { f: HomeForm }) {
  const { width } = useWindowDimensions();
  const tight = width < 440;
  const chip = [styles.chip, tight && styles.chipTight];
  const text = [styles.chipText, tight && { fontSize: 12.5 }];
  return (
    <View style={styles.examples}>
      {/* On narrow phones the three chips only fit on one line without the label. */}
      {tight ? null : <Text style={styles.examplesLabel}>Try</Text>}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See a sample run (recorded, no link needed)"
        onPress={f.runSample}
        hitSlop={6}
        style={(s) => [chip, styles.chipSample, transition, pstate(s).hovered && styles.chipHover]}
      >
        <Text style={[text, { color: HEADLINE_ACCENT }]}>▶ See a sample run</Text>
      </Pressable>
      {f.examples.map((ex) => (
        <Pressable
          key={ex.url}
          accessibilityRole="button"
          accessibilityLabel={`Try an example recipe: ${ex.label}, ${ex.site}`}
          onPress={() => f.pickExample(ex.url)}
          hitSlop={6}
          style={(s) => [chip, transition, pstate(s).hovered && styles.chipHover]}
        >
          <Text style={text}>{ex.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Error, loading progress, location notice and the quiet paste/link toggle. */
function BelowBar({ f }: { f: HomeForm }) {
  return (
    <View style={styles.below}>
      {f.error ? (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={styles.errorIcon} aria-hidden>
            !
          </Text>
          <Text style={styles.errorText}>{f.error}</Text>
        </View>
      ) : null}
      {/* The sample-run chip is only hidden in paste mode; offer it here instead. */}
      {f.error && !f.isDemo && f.mode === 'text' ? (
        <Pressable accessibilityRole="button" onPress={f.runSample} style={(s) => [styles.toggle, transition, pstate(s).hovered && { opacity: 1 }]}>
          <Text style={[styles.toggleText, { color: HEADLINE_ACCENT }]}>Or see a recorded sample run</Text>
        </Pressable>
      ) : null}

      {f.locationNotice && !f.error ? (
        <View style={styles.glass}>
          <Text style={styles.glassText}>{f.locationNotice}</Text>
        </View>
      ) : null}

      {f.loading ? (
        <View style={styles.glass} accessibilityLiveRegion="polite">
          <View style={styles.dots}>
            {f.loadingSteps.map((step, i) => (
              <View
                key={step}
                style={[styles.dot, i < f.loadingStep && styles.dotDone, i === f.loadingStep && [styles.dotOn, styles.pulse]]}
              />
            ))}
          </View>
          <Text style={styles.glassText}>{f.loadingSteps[f.loadingStep]}</Text>
        </View>
      ) : (
        <>
        {f.mode === 'url' ? <Examples f={f} /> : null}
        <Pressable
          accessibilityRole="button"
          onPress={f.toggleMode}
          style={(s) => [styles.toggle, transition, pstate(s).hovered && { opacity: 1 }]}
        >
          <Text style={styles.toggleText}>
            {f.mode === 'url' ? 'No link? Paste ingredients instead' : 'Use a recipe link instead'}
          </Text>
        </Pressable>
        </>
      )}

      {f.isMock && !f.isDemo && f.mode === 'url' && !f.loading ? (
        <Text style={styles.mockHint}>Mock mode: any link works. Try one containing “allrecipes” to see the paste fallback.</Text>
      ) : null}
    </View>
  );
}

/** White-wordmark version of the app logo for the dark hero. */
function LogoLight() {
  const size = 34;
  return (
    <View style={styles.logoRow} accessibilityLabel="RecipeCheckout">
      <View style={[styles.logoMark, { width: size, height: size, borderRadius: size * 0.3 }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.logoLine}>
            <View style={[styles.logoDot, i === 0 && { backgroundColor: colors.saffron }]} />
            <View style={[styles.logoBar, { width: size * (i === 1 ? 0.32 : 0.42) }]} />
          </View>
        ))}
      </View>
      <Text style={styles.wordmark}>
        Recipe<Text style={{ color: '#A8E0BD' }}>Checkout</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#3A2A1E', overflow: 'hidden' },
  warm: {
    backgroundColor: '#4A3020',
    ...web({ backgroundImage: 'linear-gradient(135deg, #5A3520 0%, #8A4E28 40%, #3E4A2A 75%, #1E3A2A 100%)' }),
  },
  photo: {
    ...web({ transitionProperty: 'opacity, transform', transitionDuration: '900ms, 6s', transitionTimingFunction: 'ease-out', transform: 'scale(1.06)' }),
  },
  photoIn: web({ transform: 'scale(1)' }),
  overlay: {
    backgroundColor: 'rgba(12,18,14,0.55)',
    ...web({
      backgroundColor: 'transparent',
      backgroundImage:
        'radial-gradient(ellipse 70% 55% at 50% 48%, rgba(10,16,12,0.30) 0%, rgba(10,16,12,0.55) 100%), linear-gradient(180deg, rgba(10,16,12,0.55) 0%, rgba(10,16,12,0.30) 30%, rgba(10,16,12,0.40) 70%, rgba(10,16,12,0.75) 100%)',
    }),
  },
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1 },
  backdrop: { zIndex: 5, ...web({ cursor: 'default' }) },
  nav: { height: 72, flexDirection: 'row', alignItems: 'center', width: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  h1: {
    fontFamily: fonts.display,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    ...web({ textShadow: '0 2px 24px rgba(0,0,0,0.35)' }),
  },
  h1Accent: { color: HEADLINE_ACCENT, fontStyle: 'italic' },
  lead: {
    fontFamily: fonts.body,
    fontSize: 19,
    lineHeight: 29,
    color: WHITE_DIM,
    textAlign: 'center',
    maxWidth: 560,
    marginTop: 16,
    marginBottom: 36,
    fontWeight: '500',
    ...web({ textShadow: '0 1px 12px rgba(0,0,0,0.4)', textWrap: 'balance' }),
  },
  leadPhone: { fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 24, maxWidth: 340 },

  barZone: { zIndex: 10 },

  // Desktop pill
  pill: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingRight: 8,
    ...web({ boxShadow: '0 2px 6px rgba(0,0,0,0.12), 0 24px 60px -12px rgba(0,0,0,0.5)' }),
  },
  pillFocus: web({
    boxShadow: '0 0 0 5px rgba(255,255,255,0.28), 0 2px 6px rgba(0,0,0,0.12), 0 24px 60px -12px rgba(0,0,0,0.5)',
  }),
  segRecipe: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 26, paddingRight: 12, height: '100%' },
  segIcon: { fontSize: 18, marginRight: 12, width: 22, textAlign: 'center' },
  segLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '800', color: colors.ink, letterSpacing: 0.2, marginBottom: 1 },
  pillInput: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    height: 26,
    padding: 0,
    width: '100%',
  },
  segDivider: { width: 1, height: 36, backgroundColor: colors.border },
  segLocWrap: { width: 236, height: '100%', justifyContent: 'center', paddingHorizontal: 4 },
  segLoc: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    paddingLeft: 16,
    paddingRight: 14,
    borderRadius: radius.pill,
    ...web({ cursor: 'pointer' }),
  },
  segHover: { backgroundColor: colors.bgDeep },
  segValue: { fontFamily: fonts.body, fontSize: 15, color: colors.text, fontWeight: '600' },
  caret: { fontSize: 13, color: colors.muted, marginLeft: 8 },
  menuUnderSegment: { position: 'absolute', top: 80, right: -96, width: 320 },

  go: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    minHeight: 48,
    ...web({ boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 18px -8px rgba(31,122,77,0.7)', cursor: 'pointer' }),
  },
  goHover: { backgroundColor: colors.accentDark },
  goPill: { height: 56, minWidth: 104, paddingHorizontal: 26, borderRadius: radius.pill },
  goStacked: { height: 54, borderRadius: 16, marginTop: 8 },
  goPaste: { height: 52, borderRadius: radius.pill, paddingHorizontal: 26, minWidth: 168 },
  goText: { fontFamily: fonts.body, fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  goArrow: { fontFamily: fonts.body, fontSize: 18, fontWeight: '700', color: '#fff', marginLeft: 8, marginTop: -1 },

  // Stacked card (phones) and paste card
  card: {
    zIndex: 2,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 8,
    ...web({ boxShadow: '0 2px 6px rgba(0,0,0,0.12), 0 24px 60px -12px rgba(0,0,0,0.5)' }),
  },
  pasteCard: { borderRadius: 28, padding: 10 },
  stackRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 56 },
  stackInput: { flex: 1, minHeight: 56, fontSize: 16, fontFamily: fonts.body, color: colors.text, paddingRight: 12 },
  hairline: { height: 1, backgroundColor: colors.border, marginHorizontal: 10 },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 14,
    ...web({ cursor: 'pointer' }),
  },
  locRowHover: { backgroundColor: colors.accentTint },
  locRowText: { fontFamily: fonts.body, fontSize: 15, fontWeight: '700', color: colors.text },
  locRowLead: { color: colors.muted, fontWeight: '500' },
  locCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: radius.pill,
    ...web({ cursor: 'pointer' }),
  },
  textarea: {
    minHeight: 200,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.body,
    color: colors.text,
  },
  pasteFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingLeft: 4 },
  pasteLocWrap: { flexShrink: 1 },
  menuUnderCompact: { position: 'absolute', top: 56, left: 0, width: 320 },

  // Location menu
  menu: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    zIndex: 20,
    ...web({ boxShadow: '0 2px 6px rgba(0,0,0,0.1), 0 24px 48px -12px rgba(0,0,0,0.4)' }),
  },
  inlineOptions: { paddingHorizontal: 2, paddingBottom: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    ...web({ cursor: 'pointer' }),
  },
  optionHover: { backgroundColor: colors.bg },
  optionOn: { backgroundColor: colors.accentTint },
  optionIcon: { fontSize: 17, width: 22, textAlign: 'center', marginRight: 12 },
  optionText: { flex: 1, fontFamily: fonts.body, fontSize: 15, fontWeight: '600', color: colors.text },
  check: { fontFamily: fonts.body, fontSize: 16, fontWeight: '800', color: colors.accent },
  zipInput: {
    flex: 1,
    minWidth: 0,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accentBright,
    backgroundColor: '#fff',
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
  },
  zipDone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  menuFoot: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 8, paddingHorizontal: 12, paddingBottom: 4 },
  menuFootText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },

  // Below the bar
  below: { alignItems: 'center', marginTop: 14, gap: 10, zIndex: 1 },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: colors.dangerSoft,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    ...web({ boxShadow: '0 12px 28px -12px rgba(0,0,0,0.45)' }),
  },
  errorIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    color: '#fff',
    fontFamily: fonts.body,
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 1,
    overflow: 'hidden',
  },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.danger, fontWeight: '600' },
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,18,14,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...web({ backdropFilter: 'blur(10px)' }),
  },
  glassText: { fontFamily: fonts.body, fontSize: 15, fontWeight: '600', color: '#fff', flexShrink: 1 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotDone: { backgroundColor: '#A8E0BD' },
  dotOn: { backgroundColor: '#fff' },
  pulse: web({
    animationKeyframes: [{ '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.45)' }, '100%': { transform: 'scale(1)' } }],
    animationDuration: '1s',
    animationIterationCount: 'infinite',
  }),
  toggle: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, opacity: 0.88 },
  examples: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, maxWidth: 560 },
  examplesLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    marginRight: 2,
    ...web({ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }),
  },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,18,14,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    ...web({ backdropFilter: 'blur(8px)', cursor: 'pointer' }),
  },
  chipTight: { paddingHorizontal: 10, minHeight: 32 },
  chipSample: { borderColor: 'rgba(247,201,120,0.45)' },
  chipHover: { backgroundColor: 'rgba(12,18,14,0.62)', borderColor: 'rgba(255,255,255,0.4)' },
  chipText: { fontFamily: fonts.body, fontSize: 13, fontWeight: '700', color: '#fff' },
  spinner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3.5,
    borderColor: 'rgba(255,255,255,0.38)',
    borderTopColor: '#fff',
    borderRightColor: '#fff',
    ...web({
      animationKeyframes: [{ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }],
      animationDuration: '0.75s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'linear',
    }),
  },
  toggleText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textDecorationLine: 'underline',
    ...web({ textDecorationColor: 'rgba(255,255,255,0.5)', textUnderlineOffset: '4px', textShadow: '0 1px 8px rgba(0,0,0,0.5)' }),
  },
  mockHint: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', maxWidth: 420 },

  // Logo
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    ...web({ boxShadow: '0 0 0 1px rgba(255,255,255,0.18), 0 4px 12px rgba(0,0,0,0.25)' }),
  },
  logoLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  logoDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  logoBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.92)' },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.4,
    ...web({ textShadow: '0 1px 10px rgba(0,0,0,0.35)' }),
  },
});
