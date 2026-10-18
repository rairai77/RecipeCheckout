import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isZipLocation } from '../lib/client/location';
import { movePreferred, removePreferred, usePreferredStores } from '../lib/client/preferredStores';
import { storesKey, useAppState } from '../lib/client/state';
import { haversineMiles } from '../lib/shared/haversine';
import { FAR_MI, milesLabel } from '../lib/shared/plan';
import { colors, fonts, radius, transition } from './theme';
import { pstate } from './ui';

/** Where distances are measured from: the location itself, or the geocoded ZIP once its stores have loaded. */
function useOrigin(): { lat: number; lng: number } | undefined {
  const { location, stores } = useAppState();
  if (!isZipLocation(location)) return location;
  return stores.status === 'ready' && stores.key === storesKey(location) ? stores.data.origin : undefined;
}

/**
 * "Your stores": the preferred stores in order, with move-up and remove. Stores are added with the star on a store
 * card in the results. Checked first on every list, even before nearer stores.
 */
export function YourStores() {
  const list = usePreferredStores();
  const origin = useOrigin();
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} role="heading" aria-level={3}>
        Your stores
      </Text>
      {list.length ? (
        list.map((s, i) => {
          const d = origin ? haversineMiles(origin.lat, origin.lng, s.lat, s.lng) : undefined;
          return (
            <View key={s.id} style={styles.row}>
              <Text style={styles.star} aria-hidden>
                ★
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {s.name}
                </Text>
                {d !== undefined ? <Text style={[styles.dist, d > FAR_MI && styles.far]}>{milesLabel(d)} away</Text> : null}
              </View>
              {i > 0 ? (
                <IconBtn label={`Move ${s.name} up`} onPress={() => movePreferred(s.id, -1)}>
                  ↑
                </IconBtn>
              ) : null}
              <IconBtn label={`Remove ${s.name} from your stores`} onPress={() => removePreferred(s.id)}>
                ✕
              </IconBtn>
            </View>
          );
        })
      ) : (
        <Text style={styles.empty}>Tap ☆ on a store in your list to check it first next time.</Text>
      )}
    </View>
  );
}

function IconBtn({ label, onPress, children }: { label: string; onPress: () => void; children: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={(s) => [styles.btn, transition, pstate(s).hovered && { backgroundColor: colors.bgDeep }]}
    >
      <Text style={styles.btnText} aria-hidden>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 4 },
  title: { fontFamily: fonts.body, fontSize: 11, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  star: { fontSize: 14, color: colors.warn, width: 16, textAlign: 'center' },
  name: { fontFamily: fonts.body, fontSize: 14, fontWeight: '700', color: colors.text },
  dist: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  far: { color: colors.warn, fontWeight: '700' },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 18, paddingVertical: 4 },
  btn: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.body, fontSize: 15, fontWeight: '800', color: colors.muted },
});
