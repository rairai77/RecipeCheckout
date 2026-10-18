import { useMemo, type CSSProperties } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import HomeC from './HomeC';
import { ArtDefs, ITEMS, type ArtItem, type ItemKind } from './HomeCBArt';

/**
 * Variant CB: variant C's layout on a hand-drawn vector flat-lay instead of a photo. Ingredients sit
 * around the edges of a deep-green table so the headline and search bar stay on calm ground.
 * Web renders raw inline SVG; native falls back to the plain table colour.
 */
export default function HomeCB() {
  return <HomeC background={<VectorTable />} />;
}

const TABLE = '#163A2B';

/** Where an item's centre sits: px from an edge (scaled with the viewport) or a fraction of it. */
type XAnchor = ['l' | 'r', number] | ['f', number];
type YAnchor = ['t' | 'b' | 'c', number] | ['f', number];
interface Placement {
  k: ItemKind;
  x: XAnchor;
  y: YAnchor;
  /** Rendered width in design px (before viewport scale). */
  w: number;
  rot: number;
}

// Desktop (designed at 1440×900): calm zone roughly x 230–1210, y 250–650.
const WIDE: Placement[] = [
  { k: 'board', x: ['l', 150], y: ['b', 70], w: 470, rot: -22 },
  { k: 'lemon', x: ['l', 108], y: ['b', 140], w: 150, rot: 8 },
  { k: 'clove', x: ['l', 278], y: ['b', 120], w: 40, rot: 34 },
  { k: 'basil', x: ['l', 52], y: ['c', -150], w: 170, rot: 24 },
  { k: 'tomato', x: ['l', 360], y: ['t', 150], w: 118, rot: -12 },
  { k: 'scatterA', x: ['l', 200], y: ['t', 230], w: 110, rot: 0 },
  { k: 'garlic', x: ['l', 112], y: ['c', 110], w: 128, rot: -16 },
  { k: 'pepper', x: ['l', 250], y: ['c', 220], w: 80, rot: 0 },
  { k: 'rosemary', x: ['f', 0.43], y: ['t', 54], w: 80, rot: -78 },
  { k: 'mushroom', x: ['f', 0.62], y: ['t', 66], w: 88, rot: 14 },
  { k: 'avocado', x: ['r', 250], y: ['t', 92], w: 128, rot: -32 },
  { k: 'lime', x: ['r', 70], y: ['t', 140], w: 176, rot: 0 },
  { k: 'scatterB', x: ['r', 200], y: ['t', 260], w: 110, rot: 40 },
  { k: 'chili', x: ['r', 92], y: ['c', 40], w: 210, rot: 66 },
  { k: 'tomatoSlice', x: ['r', 240], y: ['c', 250], w: 138, rot: 0 },
  { k: 'onion', x: ['r', 60], y: ['b', 66], w: 236, rot: 0 },
  { k: 'list', x: ['r', 360], y: ['b', 76], w: 150, rot: 7 },
  { k: 'knife', x: ['f', 0.45], y: ['b', 40], w: 380, rot: -5 },
  { k: 'pepper', x: ['f', 0.62], y: ['b', 88], w: 70, rot: 90 },
];

// Tablet (designed at ~820 wide): the pill nearly spans the width, so items live in the top and bottom bands.
const MID: Placement[] = [
  { k: 'lime', x: ['r', 60], y: ['t', 124], w: 150, rot: 0 },
  { k: 'avocado', x: ['r', 228], y: ['t', 66], w: 108, rot: -34 },
  { k: 'rosemary', x: ['f', 0.5], y: ['t', 40], w: 70, rot: -80 },
  { k: 'tomato', x: ['l', 300], y: ['t', 140], w: 96, rot: -12 },
  { k: 'basil', x: ['l', 40], y: ['t', 214], w: 130, rot: 30 },
  { k: 'scatterA', x: ['l', 190], y: ['t', 250], w: 90, rot: 0 },
  { k: 'chili', x: ['r', 44], y: ['t', 300], w: 150, rot: 70 },
  { k: 'board', x: ['l', 120], y: ['b', 60], w: 380, rot: -20 },
  { k: 'lemon', x: ['l', 92], y: ['b', 118], w: 124, rot: 8 },
  { k: 'clove', x: ['l', 236], y: ['b', 96], w: 34, rot: 30 },
  { k: 'garlic', x: ['l', 330], y: ['b', 150], w: 92, rot: 14 },
  { k: 'knife', x: ['f', 0.55], y: ['b', 34], w: 300, rot: -6 },
  { k: 'pepper', x: ['f', 0.6], y: ['b', 112], w: 60, rot: 0 },
  { k: 'tomatoSlice', x: ['r', 220], y: ['b', 120], w: 112, rot: 0 },
  { k: 'onion', x: ['r', 46], y: ['b', 60], w: 190, rot: 0 },
];

// Phones (designed at 390×844): a few items above the headline and below the card.
const PHONE: Placement[] = [
  { k: 'lime', x: ['r', 30], y: ['t', 122], w: 116, rot: 0 },
  { k: 'tomato', x: ['f', 0.5], y: ['t', 124], w: 72, rot: -14 },
  { k: 'basil', x: ['l', 26], y: ['t', 132], w: 92, rot: 62 },
  { k: 'pepper', x: ['f', 0.3], y: ['t', 186], w: 44, rot: 0 },
  { k: 'board', x: ['l', 92], y: ['b', 36], w: 290, rot: -16 },
  { k: 'tomatoSlice', x: ['l', 100], y: ['b', 64], w: 92, rot: 0 },
  { k: 'chili', x: ['f', 0.6], y: ['b', 30], w: 130, rot: -14 },
  { k: 'avocado', x: ['r', 30], y: ['b', 92], w: 92, rot: 24 },
];

const FLOAT_CSS = `
@keyframes cbFloat {
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
  50% { transform: translate3d(var(--cb-dx), var(--cb-dy), 0) rotate(var(--cb-dr)); }
}
@keyframes cbIn {
  from { opacity: 0; transform: translate3d(var(--cb-ix), var(--cb-iy), 0) scale(0.94); }
  to { opacity: 1; transform: none; }
}
.cb-in { animation: cbIn 1100ms cubic-bezier(.2,.7,.2,1) both; }
.cb-float { animation: cbFloat ease-in-out infinite; will-change: transform; }
@media (prefers-reduced-motion: reduce) {
  .cb-in, .cb-float { animation: none !important; }
}
`;

// Fine fractal-noise grain, tiled over the whole scene for a printed, lightly textured feel.
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

const artCache = new Map<ItemKind, ArtItem>();
function art(k: ItemKind): ArtItem {
  let a = artCache.get(k);
  if (!a) {
    a = ITEMS[k]();
    artCache.set(k, a);
  }
  return a;
}

function VectorTable() {
  const { width: W, height: H } = useWindowDimensions();

  const placed = useMemo(() => {
    const phone = W < 700;
    const wide = W >= 1000;
    const list = phone ? PHONE : wide ? WIDE : MID;
    const s = phone
      ? clamp(W / 390, 0.85, 1.2)
      : wide
        ? clamp(Math.min(W / 1440, H / 900), 0.78, 1.3)
        : clamp(Math.min(W / 820, H / 900), 0.8, 1.15);
    return list.map((p, i) => {
      const a = art(p.k);
      const w = p.w * s;
      const h = (w * a.vh) / a.vw;
      const cx = p.x[0] === 'l' ? p.x[1] * s : p.x[0] === 'r' ? W - p.x[1] * s : p.x[1] * W;
      const cy =
        p.y[0] === 't' ? p.y[1] * s : p.y[0] === 'b' ? H - p.y[1] * s : p.y[0] === 'c' ? H / 2 + p.y[1] * s : p.y[1] * H;
      // On tight viewports, slide an item that would sit behind the content out towards its edge (so it
      // peeks in, cropped like a photo); drop it if even that is not enough.
      const vertical = p.y[0] === 't' || p.y[0] === 'b';
      const dir = vertical ? (p.y[0] === 't' ? -1 : 1) : p.x[0] === 'l' || (p.x[0] === 'f' && p.x[1] < 0.5) ? -1 : 1;
      const room = (vertical ? h : w) * 0.45;
      for (let shift = 0; shift <= room; shift += 6) {
        const x = vertical ? cx : cx + dir * shift;
        const y = vertical ? cy + dir * shift : cy;
        if (!hitsContent(x, y, w, h, p.rot, W, H)) return { p, a, w, h, cx: x, cy: y, i };
      }
      return null;
    }).filter((it) => it !== null);
  }, [W, H]);

  if (Platform.OS !== 'web') {
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: TABLE }]} pointerEvents="none" />;
  }

  const full: CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <div style={{ ...full, overflow: 'hidden', backgroundColor: TABLE }}>
        <style>{FLOAT_CSS}</style>
        <ArtDefs />
        {/* table: soft pool of light in the middle, darker edges */}
        <div
          style={{
            ...full,
            backgroundImage:
              'radial-gradient(ellipse 75% 65% at 50% 46%, #1F5039 0%, #19432F 48%, #11301F 100%)',
          }}
        />
        {placed.map(({ p, a, w, h, cx, cy, i }) => {
          // Light comes from the top-left: counter-rotate the shadow offset so every item casts it the same way.
          const t = (-p.rot * Math.PI) / 180;
          const sx = 5 * Math.cos(t) - 12 * Math.sin(t);
          const sy = 5 * Math.sin(t) + 12 * Math.cos(t);
          const dur = 11 + ((i * 37) % 7);
          // Items drift in from the nearest edge.
          const ix = cx < W / 2 ? -18 : 18;
          const iy = cy < H / 2 ? -14 : 14;
          return (
            <div
              key={`${p.k}-${i}`}
              className="cb-in"
              style={
                {
                  position: 'absolute',
                  left: cx - w / 2,
                  top: cy - h / 2,
                  width: w,
                  height: h,
                  animationDelay: `${120 + i * 55}ms`,
                  '--cb-ix': `${ix}px`,
                  '--cb-iy': `${iy}px`,
                } as CSSProperties
              }
            >
              <div
                className="cb-float"
                style={
                  {
                    width: '100%',
                    height: '100%',
                    animationDuration: `${dur}s`,
                    animationDelay: `-${(i * 1.7) % dur}s`,
                    '--cb-dx': `${i % 2 ? 3 : -3}px`,
                    '--cb-dy': `${i % 3 ? -6 : 5}px`,
                    '--cb-dr': `${i % 2 ? 1.2 : -1.2}deg`,
                  } as CSSProperties
                }
              >
                <svg
                  viewBox={`${-a.vw / 2} ${-a.vh / 2} ${a.vw} ${a.vh}`}
                  width="100%"
                  height="100%"
                  overflow="visible"
                  style={{
                    display: 'block',
                    overflow: 'visible',
                    transform: `rotate(${p.rot}deg)`,
                    filter: `drop-shadow(${sx.toFixed(1)}px ${sy.toFixed(1)}px 10px rgba(3,16,9,0.5)) drop-shadow(${(sx / 5).toFixed(1)}px ${(sy / 5).toFixed(1)}px 2px rgba(3,16,9,0.35))`,
                  }}
                >
                  {a.node}
                </svg>
              </div>
            </div>
          );
        })}
        {/* calm the middle behind the headline and search bar, and deepen the corners */}
        <div
          style={{
            ...full,
            backgroundImage:
              'radial-gradient(ellipse 44% 34% at 50% 50%, rgba(10,32,21,0.55) 0%, rgba(10,32,21,0.25) 60%, rgba(10,32,21,0) 100%), linear-gradient(180deg, rgba(8,24,15,0.18) 0%, rgba(8,24,15,0) 18%, rgba(8,24,15,0) 80%, rgba(8,24,15,0.28) 100%)',
          }}
        />
        <div style={{ ...full, backgroundImage: GRAIN, opacity: 0.07, mixBlendMode: 'overlay' }} />
      </div>
    </View>
  );
}

type Rect = [number, number, number, number]; // x0 y0 x1 y1

/**
 * Approximates where HomeC puts its logo, headline, lead, bar and toggle (it centres them between the
 * 72px nav and its bottom padding) so items that would sit behind them are left out on tight viewports.
 */
function contentRects(W: number, H: number): Rect[] {
  const isPhone = W < 640;
  const stacked = W < 700;
  const barW = Math.min(760, W - (isPhone ? 32 : 48));
  const cy = (72 + H - (isPhone ? 40 : 88)) / 2;
  const half = isPhone ? 222 : stacked ? 250 : W >= 1024 ? 160 : 150;
  const hw = barW / 2 + 14;
  const top = cy - half;
  const bottom = cy + half;
  return [
    [0, 0, 270, 66], // logo
    [W / 2 - hw, top, W / 2 + hw, bottom - 56], // headline, lead, bar
    [W / 2 - 150, bottom - 56, W / 2 + 150, bottom], // "No link?" toggle
  ];
}

function hitsContent(cx: number, cy: number, w: number, h: number, rot: number, W: number, H: number) {
  // Rotated bounding box, shrunk a little because the drawings do not fill their box corners.
  const t = (rot * Math.PI) / 180;
  const bw = (Math.abs(w * Math.cos(t)) + Math.abs(h * Math.sin(t))) * 0.42;
  const bh = (Math.abs(w * Math.sin(t)) + Math.abs(h * Math.cos(t))) * 0.42;
  return contentRects(W, H).some(([x0, y0, x1, y1]) => cx + bw > x0 && cx - bw < x1 && cy + bh > y0 && cy - bh < y1);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
