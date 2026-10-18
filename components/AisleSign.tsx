import { StyleSheet, Text, View } from 'react-native';
import { formatAisle } from '../lib/shared/aisleSort';
import type { Aisle } from '../lib/shared/types';
import { sectionLook, sideWord } from './format';
import { colors, fonts } from './theme';

/** Aisle as a road-sign: numbered aisles are a green highway sign, sections get an icon + color. */
export function AisleSign({ aisle, size = 'md' }: { aisle?: Aisle; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 52 : 64;
  const h = size === 'sm' ? 56 : 68;
  if (aisle?.isNumbered && aisle.number) {
    const side = sideWord(aisle.side);
    return (
      <View style={[styles.sign, { width: w, height: h }]} accessibilityLabel={formatAisle(aisle)}>
        <View style={styles.signInner}>
          <Text style={styles.signTop}>AISLE</Text>
          <Text style={[styles.signNum, size === 'sm' && { fontSize: 20, lineHeight: 22 }]}>{aisle.number}</Text>
          {side ? <Text style={styles.signSide}>{side.toUpperCase()}</Text> : null}
        </View>
      </View>
    );
  }
  if (aisle) {
    const look = sectionLook(aisle.label);
    const name = formatAisle(aisle);
    return (
      <View style={[styles.section, { width: w, height: h, backgroundColor: look.bg }]} accessibilityLabel={name}>
        <Text style={[styles.sectionEmoji, size === 'sm' && { fontSize: 18 }]}>{look.emoji}</Text>
        <Text style={[styles.sectionName, { color: look.fg }, size === 'sm' && { fontSize: 9 }]} numberOfLines={2}>
          {look.short ?? (name.length > 9 ? name.split(/[\s/]/)[0].slice(0, 9) : name)}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.section, styles.unknown, { width: w, height: h }]} accessibilityLabel="Aisle unknown">
      <Text style={styles.unknownQ}>?</Text>
      <Text style={[styles.sectionName, { color: colors.muted }]}>Ask</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sign: { backgroundColor: colors.sign, borderRadius: 10, padding: 3 },
  signInner: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signTop: { fontFamily: fonts.body, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.9)' },
  signNum: { fontFamily: fonts.body, fontSize: 24, lineHeight: 27, fontWeight: '800', color: '#fff' },
  signSide: { fontFamily: fonts.body, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, color: 'rgba(255,255,255,0.9)' },
  section: { borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  sectionEmoji: { fontSize: 22, lineHeight: 28 },
  sectionName: { fontFamily: fonts.body, fontSize: 10, lineHeight: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.2, textAlign: 'center' },
  unknown: { backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  unknownQ: { fontFamily: fonts.body, fontSize: 20, fontWeight: '800', color: colors.muted },
});
