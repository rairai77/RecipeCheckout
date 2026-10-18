import { useMemo, type CSSProperties } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import HomeC from './HomeC';
import { ProduceDefs, layoutAisle } from './HomeCCArt';

/**
 * Variant CC: variant C's layout over a hand-drawn vector take on CA's produce-aisle photo. Tiers of
 * dark bins edge to edge, each packed with procedurally placed (seeded, jittered) peppers, greens,
 * squash, garlic and more, under a fluorescent strip, then a dark pool so the headline and bar read.
 * Web renders one raw inline SVG (each drawing defined once, repeated with <use>); native gets a plain colour.
 */
export default function HomeCC() {
  return <HomeC background={<VectorAisle />} />;
}

// The art is drawn a little larger than the viewport so the slow drift never shows an edge.
const OX = 22;
const OY = 14;

const CSS = `
@keyframes ccIn { from { opacity: 0; transform: scale(1.045); } to { opacity: 1; transform: none; } }
@keyframes ccDrift {
  0% { transform: translate3d(-${OX - 6}px, 0, 0); }
  100% { transform: translate3d(${OX - 6}px, -${OY - 6}px, 0); }
}
.cc-in { animation: ccIn 1400ms cubic-bezier(.2,.7,.2,1) both; }
.cc-drift { animation: ccDrift 70s ease-in-out infinite alternate; will-change: transform; }
@media (prefers-reduced-motion: reduce) {
  .cc-in, .cc-drift { animation: none !important; }
}
`;

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

function VectorAisle() {
  const { width: W, height: H } = useWindowDimensions();
  const cw = W + OX * 2;
  const ch = H + OY * 2;
  const art = useMemo(() => (Platform.OS === 'web' ? layoutAisle(cw, ch, W >= 700) : null), [cw, ch, W]);

  if (Platform.OS !== 'web') {
    return <View style={[StyleSheet.absoluteFill, styles.fallback]} pointerEvents="none" />;
  }

  const full: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <div style={{ ...full, overflow: 'hidden', backgroundColor: '#0C0D0B' }}>
        <style>{CSS}</style>
        <div className="cc-in" style={full}>
          <div className="cc-drift" style={{ position: 'absolute', left: -OX, top: -OY, width: cw, height: ch }}>
            <svg width={cw} height={ch} viewBox={`0 0 ${cw} ${ch}`} style={{ display: 'block' }} aria-hidden="true" focusable="false">
              <ProduceDefs />
              {art}
            </svg>
          </div>
        </div>
        {/* Dark pool behind the headline and bar, a top band that knocks the strip down, a deep bottom fade. */}
        <div
          style={{
            ...full,
            backgroundImage:
              'radial-gradient(ellipse 62% 44% at 50% 52%, rgba(8,12,9,0.8) 0%, rgba(8,12,9,0.66) 45%, rgba(8,12,9,0.32) 100%), linear-gradient(180deg, rgba(8,12,9,0.62) 0%, rgba(8,12,9,0.26) 26%, rgba(8,12,9,0.28) 70%, rgba(8,12,9,0.76) 100%)',
          }}
        />
        <div style={{ ...full, backgroundImage: GRAIN, opacity: 0.06, mixBlendMode: 'overlay' }} />
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: '#1E2A1E' },
});
