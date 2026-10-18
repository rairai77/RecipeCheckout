import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow, useBreakpoint, web } from './theme';
import { BackLink, FadeIn } from './ui';

type Props = {
  title: string;
  image?: string;
  eyebrow?: string;
  chips: string[];
  back: { label: string; onPress: () => void };
  compact?: boolean;
  /** Phones only: a short strip (back link, one-line title, plain chips, small photo) so the list starts higher. */
  slimOnPhone?: boolean;
  children?: ReactNode;
};

/** Many recipe CDNs serve a small `?resize=W,H` crop; ask for a banner-sized one instead. */
function bannerUri(uri: string): string {
  return uri.replace(/([?&]resize=)\d+,\d+/, (_m, key: string) => `${key}1400,800`);
}

/** Recipe image as a full-bleed banner with the title over a soft gradient. */
export function RecipeBanner({ title, image, eyebrow, chips, back, compact, slimOnPhone, children }: Props) {
  const { isPhone } = useBreakpoint();
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;

  if (isPhone && slimOnPhone) {
    return (
      <FadeIn>
        <View style={styles.slim}>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <BackLink label={back.label} onPress={back.onPress} light />
            <Text style={styles.slimTitle} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            <Text style={styles.slimChips} numberOfLines={1}>
              {chips.join(' · ')}
            </Text>
            {children}
          </View>
          {showImage ? (
            <Image source={{ uri: image }} onError={() => setFailed(true)} style={styles.slimPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : null}
        </View>
      </FadeIn>
    );
  }
  const height = compact ? (isPhone ? 230 : 220) : isPhone ? 280 : 320;

  return (
    <FadeIn>
      <View style={[styles.banner, { height }, isPhone ? styles.bannerPhone : styles.bannerWide]}>
        {showImage ? (
          // On wide screens the photo is usually too small to stretch, so the backdrop is a soft blur of it
          // and the crisp photo sits in a card on the right.
          <View style={[StyleSheet.absoluteFill, !isPhone && styles.blurred]}>
            <Image
              source={{ uri: bannerUri(image!) }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setFailed(true)}
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Text style={styles.fallbackEmoji}>🥘</Text>
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, styles.shade, !isPhone && showImage && styles.shadeWide]} />
        <View style={styles.inner}>
        <View style={styles.content}>
          <BackLink label={back.label} onPress={back.onPress} light />
          <View>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={[styles.title, isPhone && styles.titlePhone, compact && !isPhone && { fontSize: 36, lineHeight: 40 }]} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
            <View style={styles.chips}>
              {chips.map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {c}
                  </Text>
                </View>
              ))}
            </View>
            {children}
          </View>
        </View>
        {showImage && !isPhone ? (
          <View style={[styles.photoCard, { width: (height - 40) * 1.25, height: height - 40 }]}>
            <Image source={{ uri: bannerUri(image!) }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          </View>
        ) : null}
        </View>
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  banner: { overflow: 'hidden', backgroundColor: colors.accentDark, marginBottom: 24 },
  slim: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.accentDark,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    ...web({ backgroundImage: 'linear-gradient(120deg, #155C39 0%, #1F3A2A 100%)' }),
  },
  slimTitle: { fontFamily: fonts.display, color: '#fff', fontSize: 24, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  slimChips: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  slimPhoto: { width: 76, height: 76, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: colors.bgDeep },
  bannerWide: { borderRadius: radius.xl, ...shadow.md },
  bannerPhone: { borderRadius: 0 },
  fallback: {
    backgroundColor: colors.accent,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 40,
    ...web({ backgroundImage: 'radial-gradient(circle at 80% 30%, #2E9E62 0%, #1F7A4D 45%, #155C39 100%)' }),
  },
  fallbackEmoji: { fontSize: 120, opacity: 0.35 },
  shade: {
    backgroundColor: 'rgba(14,24,18,0.45)',
    ...web({
      backgroundColor: 'transparent',
      backgroundImage: 'linear-gradient(180deg, rgba(14,24,18,0.30) 0%, rgba(14,24,18,0.0) 30%, rgba(14,24,18,0.25) 55%, rgba(14,24,18,0.82) 100%)',
    }),
  },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  content: { flex: 1, alignSelf: 'stretch', justifyContent: 'space-between', padding: 20 },
  blurred: { ...web({ filter: 'blur(28px) saturate(1.3) brightness(0.9)', transform: 'scale(1.25)' }) },
  shadeWide: web({
    backgroundImage: 'linear-gradient(90deg, rgba(14,24,18,0.72) 0%, rgba(14,24,18,0.45) 55%, rgba(14,24,18,0.15) 100%)',
  }),
  photoCard: {
    marginRight: 20,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: colors.bgDeep,
    ...web({ boxShadow: '0 18px 40px -12px rgba(0,0,0,0.45)', transform: 'rotate(2deg)' }),
  },
  eyebrow: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontFamily: fonts.display, color: '#fff', fontSize: 46, lineHeight: 50, fontWeight: '700', letterSpacing: -1, ...web({ textShadow: '0 2px 16px rgba(0,0,0,0.25)' }) },
  titlePhone: { fontSize: 32, lineHeight: 36, letterSpacing: -0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    maxWidth: '100%',
    ...web({ backdropFilter: 'blur(8px)' }),
  },
  chipText: { fontFamily: fonts.body, color: '#fff', fontSize: 13, fontWeight: '600' },
});
