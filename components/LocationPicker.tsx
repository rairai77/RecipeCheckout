import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getBrowserLocation, isValidZip, LocationError, locationKey, SEATTLE_PRESET } from '../lib/client/location';
import { useAppState } from '../lib/client/state';
import { chainColor, colors, fonts, radius, transition, web } from './theme';
import { pstate } from './ui';

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
        <View style={styles.storeChips}>
          <Text style={styles.storeLead}>Nearby:</Text>
          {stores.data.stores.map((s) => {
            const c = chainColor(s.chain);
            return (
              <View key={s.id} style={styles.storeChip}>
                <View style={[styles.storeDot, { backgroundColor: c.bg }]} />
                <Text style={styles.storeChipText}>
                  {s.name} <Text style={styles.storeDist}>{s.distanceMi.toFixed(1)} mi</Text>
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[styles.storeLine, { color: colors.danger }]}>
          No QFC / Fred Meyer / Kroger-family stores found near {location.label}.
        </Text>
      );
    } else if (stores.status === 'error' && stores.key === key) {
      storeLine = (
        <Pressable accessibilityRole="button" onPress={() => loadStores().catch(() => {})} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[styles.storeLine, { color: colors.danger }]}>Couldn't load stores ({stores.message}). Tap to retry.</Text>
        </Pressable>
      );
    }
  }

  return (
    <View>
      <View style={styles.options} accessibilityRole="radiogroup">
        <Chip selected={mode === 'gps'} icon="📍" label={locating ? 'Locating…' : 'Use my location'} onPress={useMyLocation} busy={locating} />
        <Chip selected={mode === 'zip'} icon="🔢" label={mode === 'zip' && isValidZip(zip) ? `ZIP ${zip}` : 'ZIP code'} onPress={chooseZip} />
        <Chip selected={mode === 'preset'} icon="🏙️" label="Seattle · Capitol Hill" onPress={choosePreset} />
      </View>

      {mode === 'zip' ? (
        <TextInput
          style={[styles.zipInput, web({ outlineStyle: 'none' })]}
          value={zip}
          onChangeText={onZipChange}
          placeholder="5-digit ZIP, e.g. 98102"
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={5}
          autoFocus
          accessibilityLabel="Enter ZIP code"
        />
      ) : null}

      {gpsMessage ? <Text style={styles.warn}>{gpsMessage}</Text> : null}
      {storeLine ? <View style={{ marginTop: 12 }}>{storeLine}</View> : null}
    </View>
  );
}

function Chip({ selected, icon, label, onPress, busy }: { selected: boolean; icon: string; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={(s) => {
        const { hovered, pressed } = pstate(s);
        return [
          styles.chip,
          transition,
          hovered && !selected && { borderColor: colors.accentBright, backgroundColor: colors.accentTint },
          selected && styles.chipOn,
          pressed && { opacity: 0.85 },
        ];
      }}
    >
      {busy ? <ActivityIndicator size="small" color={selected ? '#fff' : colors.accent} style={{ marginRight: 6 }} /> : <Text style={styles.chipIcon}>{icon}</Text>}
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipIcon: { fontSize: 15, marginRight: 6 },
  chipText: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center' },
  zipInput: {
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    minHeight: 48,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: '#fff',
    maxWidth: 260,
  },
  warn: { marginTop: 12, color: colors.warn, fontSize: 14, lineHeight: 20, fontFamily: fonts.body, fontWeight: '600' },
  storeLine: { color: colors.muted, fontSize: 13, lineHeight: 19, fontFamily: fonts.body },
  storeChips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  storeLead: { fontFamily: fonts.body, fontWeight: '700', color: colors.text, fontSize: 13, marginRight: 2 },
  storeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  storeChipText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.text },
  storeDist: { color: colors.muted, fontWeight: '500' },
});
