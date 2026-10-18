import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { getBrowserLocation, isValidZip, LocationError, locationKey, SEATTLE_PRESET } from '../lib/client/location';
import { useAppState } from '../lib/client/state';
import { colors, radius } from './theme';

export type LocationMode = 'gps' | 'zip' | 'preset';

type Props = {
  mode: LocationMode;
  onModeChange: (m: LocationMode) => void;
  /** ZIP draft is owned by the parent so it can block submit on a half-typed ZIP. */
  zip: string;
  onZipChange: (zip: string) => void;
};

export function LocationPicker({ mode, onModeChange, zip, onZipChange: setZip }: Props) {
  const { location, setLocation, stores, loadStores } = useAppState();
  const [locating, setLocating] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const narrow = useWindowDimensions().width < 560;

  const useMyLocation = async () => {
    onModeChange('gps');
    setGpsMessage(null);
    setLocating(true);
    try {
      const pos = await getBrowserLocation();
      setLocation({ ...pos, label: 'your location' });
    } catch (e) {
      const why = e instanceof LocationError ? e.message : "Couldn't get your location.";
      setGpsMessage(`${why} Using ${SEATTLE_PRESET.label} instead.`);
      onModeChange('preset');
      setLocation(SEATTLE_PRESET);
    } finally {
      setLocating(false);
    }
  };

  const chooseZip = () => {
    onModeChange('zip');
    setGpsMessage(null);
    if (isValidZip(zip)) setLocation({ zip: zip.trim(), label: `ZIP ${zip.trim()}` });
  };

  const onZipChange = (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 5);
    setZip(clean);
    if (isValidZip(clean)) setLocation({ zip: clean, label: `ZIP ${clean}` });
  };

  const choosePreset = () => {
    onModeChange('preset');
    setGpsMessage(null);
    setLocation(SEATTLE_PRESET);
  };

  const key = locationKey(location);
  const zipPending = mode === 'zip' && !isValidZip(zip);
  let storeLine: ReactNode = null;
  if (!zipPending && !(mode === 'gps' && locating)) {
    if (stores.status === 'loading' && stores.key === key) {
      storeLine = (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.storeLine, { marginLeft: 8 }]}>Finding nearby stores…</Text>
        </View>
      );
    } else if (stores.status === 'ready' && stores.key === key) {
      storeLine = stores.data.stores.length ? (
        <Text style={styles.storeLine}>
          <Text style={styles.storeLead}>Nearby: </Text>
          {stores.data.stores.map((s) => `${s.name} (${s.distanceMi.toFixed(1)} mi)`).join(' · ')}
        </Text>
      ) : (
        <Text style={[styles.storeLine, { color: colors.danger }]}>
          No QFC / Fred Meyer / Kroger-family stores found near {location.label}.
        </Text>
      );
    } else if (stores.status === 'error' && stores.key === key) {
      storeLine = (
        <Pressable onPress={() => loadStores().catch(() => {})}>
          <Text style={[styles.storeLine, { color: colors.danger }]}>
            Couldn't load stores ({stores.message}). Tap to retry.
          </Text>
        </Pressable>
      );
    }
  }

  return (
    <View>
      <View style={[styles.options, narrow && styles.optionsNarrow]}>
        <Option
          selected={mode === 'gps'}
          title="Use my location"
          subtitle={locating ? 'Locating…' : mode === 'gps' && 'lat' in location ? 'Got it' : 'Ask the browser'}
          onPress={useMyLocation}
          busy={locating}
          narrow={narrow}
        />
        <Option selected={mode === 'zip'} title="ZIP code" subtitle={mode === 'zip' && isValidZip(zip) ? zip : 'Any US ZIP'} onPress={chooseZip} narrow={narrow} />
        <Option selected={mode === 'preset'} title="Seattle" subtitle="Capitol Hill" onPress={choosePreset} narrow={narrow} />
      </View>

      {mode === 'zip' ? (
        <TextInput
          style={styles.zipInput}
          value={zip}
          onChangeText={onZipChange}
          placeholder="e.g. 98102"
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          autoFocus
          accessibilityLabel="ZIP code"
        />
      ) : null}

      {gpsMessage ? <Text style={styles.warn}>{gpsMessage}</Text> : null}
      {storeLine}
    </View>
  );
}

function Option({
  selected,
  title,
  subtitle,
  onPress,
  busy,
  narrow,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onPress: () => void;
  busy?: boolean;
  narrow?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, narrow && styles.optionNarrow, selected && styles.optionOn, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.row}>
        <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
        <Text style={[styles.optionTitle, selected && { color: colors.accentDark }]}>
          {title}
        </Text>
      </View>
      <View style={[styles.row, styles.subRow]}>
        {busy ? <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 6, transform: [{ scale: 0.7 }] }} /> : null}
        <Text style={styles.optionSub} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', gap: 8 },
  optionsNarrow: { flexDirection: 'column' },
  option: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  optionNarrow: { flexBasis: 'auto', flexGrow: 0 },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
  optionSub: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  subRow: { marginTop: 4, marginLeft: 26 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#B9C6BB',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.accent },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  zipInput: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#fff',
    maxWidth: 200,
  },
  warn: { marginTop: 10, color: colors.warn, fontSize: 14, lineHeight: 20 },
  storeLine: { marginTop: 10, color: colors.muted, fontSize: 13, lineHeight: 19 },
  storeLead: { fontWeight: '700', color: colors.text },
});
