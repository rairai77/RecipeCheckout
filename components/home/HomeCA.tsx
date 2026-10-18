import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { web } from '../theme';
import HomeC from './HomeC';

/**
 * Variant CA: variant C's layout and search bar over a different photo, a supermarket produce aisle with
 * neat rows of peppers, greens and squash. It reads as "groceries" at a glance and echoes the
 * "sorted by aisle" headline.
 */

// Produce aisle shelves (Unsplash, free licence).
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1920&q=70';

function AisleBackground() {
  const [ready, setReady] = useState(false);
  return (
    <>
      <View style={[StyleSheet.absoluteFill, styles.warm]} pointerEvents="none" />
      <View
        style={[StyleSheet.absoluteFill, styles.photo, { opacity: ready ? 1 : 0 }, ready && styles.photoIn]}
        pointerEvents="none"
        aria-hidden
      >
        <Image
          source={{ uri: HERO_IMAGE }}
          resizeMode="cover"
          onLoad={() => setReady(true)}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      </View>
      <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none" />
    </>
  );
}

export default function HomeCA() {
  return <HomeC background={<AisleBackground />} />;
}

const styles = StyleSheet.create({
  warm: {
    backgroundColor: '#3A3A22',
    ...web({ backgroundImage: 'linear-gradient(135deg, #2E4A2A 0%, #5E6A2C 35%, #8A4E28 70%, #3A2A1E 100%)' }),
  },
  photo: {
    ...web({
      transitionProperty: 'opacity, transform',
      transitionDuration: '900ms, 6s',
      transitionTimingFunction: 'ease-out',
      transform: 'scale(1.06)',
    }),
  },
  photoIn: web({ transform: 'scale(1)' }),
  // The aisle is bright and evenly busy, so the overlay is heavier than C's: a darker pool behind the
  // headline and bar, plus a top band that knocks down the fluorescent strip and a deep bottom fade.
  overlay: {
    backgroundColor: 'rgba(10,14,10,0.62)',
    ...web({
      backgroundColor: 'transparent',
      backgroundImage:
        'radial-gradient(ellipse 68% 48% at 50% 52%, rgba(8,12,9,0.72) 0%, rgba(8,12,9,0.50) 55%, rgba(8,12,9,0.30) 100%), linear-gradient(180deg, rgba(8,12,9,0.70) 0%, rgba(8,12,9,0.30) 28%, rgba(8,12,9,0.30) 68%, rgba(8,12,9,0.78) 100%)',
    }),
  },
});
