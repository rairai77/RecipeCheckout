/**
 * Vector produce-aisle art for home variant CC (web only: rendered as raw DOM <svg>).
 * Each produce drawing lives once in <defs> as a <g id>, drawn around (0,0) at a nominal ~40-unit size,
 * with its main body in `currentColor` so every <use> can tint it. The aisle itself (shelves, bins, the
 * repeated produce) is laid out procedurally by `layoutAisle`, with seeded jitter so it never looks stamped.
 */
import type { ReactElement } from 'react';

type Pt = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Smooth closed path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n];
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return `${d}Z`;
}

const wob = (seed: number, i: number) => Math.sin(seed * 12.9898 + i * 78.233) * 0.5 + Math.sin(seed * 3.1 + i * 1.7) * 0.5;

/** A lumpy round outline with `lobes` bulges; many lobes + small amp reads as a frilly leaf edge. */
function lumpy(r: number, lobes: number, amp: number, phase: number, seed: number, sx = 1, sy = 1, n = 40, cx = 0, cy = 0): string {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + amp * Math.cos(lobes * (a - phase)) + wob(seed, i) * amp * 0.45;
    pts.push([cx + rr * Math.cos(a) * sx, cy + rr * Math.sin(a) * sy]);
  }
  return smooth(pts);
}

/** A pointed leaf from the origin along -y (upwards), `len` long. */
function leaf(len: number, wid: number): string {
  return `M0 0 C${r1(-wid)} ${r1(-len * 0.2)} ${r1(-wid * 1.05)} ${r1(-len * 0.7)} 0 ${-len} C${r1(wid * 1.05)} ${r1(-len * 0.7)} ${r1(wid)} ${r1(-len * 0.2)} 0 0Z`;
}

/* ------------------------------------------------------------------ produce drawings */

const PEPPER = lumpy(20, 4, 2.6, Math.PI / 4, 1, 1, 0.95);
const TOMATO = lumpy(17, 5, 0.9, 0, 2);
const LEMON = smooth([
  [-22, 0], [-18, -6], [-10, -12.5], [2, -14], [13, -11.5], [19, -6], [22, 0], [19, 6], [13, 11.5], [2, 14], [-10, 12.5], [-18, 6],
]);
const CUKE = lumpy(13, 3, 0.7, 0, 5, 0.94, 1.08);
const ZUKE = smooth([
  [-37, 0.5], [-34, -6], [-18, -7.8], [8, -7.6], [28, -6.4], [36.5, -2], [36.5, 2.4], [28, 6.6], [8, 7.9], [-18, 8], [-34, 6.4],
]);
const SQUASH = smooth([
  [-29, 0], [-27, -13], [-14, -17.5], [1, -14], [15, -9], [27, -6.6], [33, -3], [33, 3], [27, 6.6], [15, 9], [1, 14], [-14, 17.5], [-27, 13],
]);
const EGGPLANT = lumpy(16, 2, 1.2, Math.PI / 2, 6, 0.9, 1.08);
const GARLIC = smooth([
  [0, -21], [4, -15], [13, -8], [18.5, 2], [16, 11], [7, 16.5], [-7, 16.5], [-16, 11], [-18.5, 2], [-13, -8], [-4, -15],
]);
const CABBAGE = lumpy(24, 6, 1.1, 0.4, 7);
const LETTUCE_A = lumpy(27, 17, 2.3, 0, 3, 1, 0.92, 72);
const LETTUCE_B = lumpy(19, 13, 2.1, 0.3, 4, 1, 0.92, 60, 2, -4);
const LETTUCE_C = lumpy(10.5, 9, 1.6, 0.1, 8, 1, 0.9, 40, 4, -7);
const FLORETS: [number, number, number][] = [
  [-11, 2, 9.5], [11, 3, 9.5], [-5, 10, 9], [7, 11, 8.5], [-7, -7, 10], [7, -7, 10], [0, 1, 10],
];
const FLORET_PATHS = FLORETS.map(([x, y, r], i) => lumpy(r, 7, 1, i, 10 + i, 1, 1, 28, x, y));
const KALE_LEAVES: [number, number, number][] = [
  [-62, 36, 12], [-28, 40, 12.5], [8, 41, 12.5], [42, 36, 12], [-8, 30, 10],
];

const SHADE = 'url(#ccShade)';
const SHADOW = 'rgba(0,0,0,0.34)';

function Pepper() {
  return (
    <g id="cc-pepper">
      <ellipse cx="3" cy="5" rx="21" ry="19" fill={SHADOW} />
      <path d={PEPPER} fill="currentColor" />
      <path d={PEPPER} fill={SHADE} />
      <path d="M-1 -5 Q-9 4 -12 14 M2 -5 Q10 3 13 13" stroke="rgba(0,0,0,0.2)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="-8" cy="-7" rx="6.5" ry="3.4" transform="rotate(-32 -8 -7)" fill="rgba(255,255,255,0.42)" />
      <path d="M9 -4 Q13 2 11 9" stroke="rgba(255,255,255,0.3)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="0" cy="-10" rx="6.5" ry="3.6" fill="rgba(0,0,0,0.22)" />
      <ellipse cx="0" cy="-10" rx="4.4" ry="2.4" fill="#3F7A2B" />
      <path d="M0 -10.5 Q1 -16 6 -18" stroke="#4E8C33" strokeWidth="3.2" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Tomato() {
  const pts = [0, 72, 144, 216, 288];
  return (
    <g id="cc-tomato">
      <ellipse cx="3" cy="4" rx="17.5" ry="16.5" fill={SHADOW} />
      <path d={TOMATO} fill="currentColor" />
      <path d={TOMATO} fill={SHADE} />
      <ellipse cx="-7" cy="-6" rx="5.5" ry="3" transform="rotate(-35 -7 -7)" fill="rgba(255,255,255,0.45)" />
      <g transform="translate(1 -3)" fill="#3D7A2C">
        {pts.map((a) => (
          <path key={a} d="M0 0 Q2.5 -2 8 -0.8 Q3 1.4 0 0Z" transform={`rotate(${a + 15})`} />
        ))}
        <circle r="1.8" fill="#2F6322" />
      </g>
    </g>
  );
}

function Lemon() {
  return (
    <g id="cc-lemon">
      <ellipse cx="3" cy="4" rx="21" ry="14" fill={SHADOW} />
      <path d={LEMON} fill="currentColor" />
      <path d={LEMON} fill={SHADE} />
      <ellipse cx="-4" cy="-6" rx="9" ry="3" transform="rotate(-8 -4 -6)" fill="rgba(255,255,255,0.4)" />
      <g fill="rgba(120,80,0,0.14)">
        <circle cx="6" cy="2" r="0.9" /><circle cx="-6" cy="5" r="0.9" /><circle cx="12" cy="-3" r="0.8" /><circle cx="0" cy="8" r="0.8" />
      </g>
      <circle cx="21.5" cy="0" r="1.6" fill="rgba(90,110,20,0.55)" />
    </g>
  );
}

function Cuke() {
  return (
    <g id="cc-cuke">
      <ellipse cx="2.5" cy="3.5" rx="13" ry="14" fill={SHADOW} />
      <path d={CUKE} fill="currentColor" />
      <path d={CUKE} fill={SHADE} />
      <ellipse cx="0.5" cy="0.5" rx="6" ry="6.6" fill="rgba(214,236,160,0.28)" />
      <circle cx="0.5" cy="0.5" r="2" fill="rgba(60,50,20,0.45)" />
      <path d="M-8 -7 Q-3 -11.5 4 -11" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Zucchini() {
  return (
    <g id="cc-zuke">
      <path d={ZUKE} fill={SHADOW} transform="translate(3 4)" />
      <path d={ZUKE} fill="currentColor" />
      <path d={ZUKE} fill="url(#ccShadeLin)" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
      <path d="M-30 -3 C-10 -4.5 14 -4.5 31 -2.6 M-30 2.6 C-8 3.6 14 3.6 31 2.4" stroke="rgba(215,240,170,0.2)" strokeWidth="1.3" fill="none" />
      <path d="M-26 -5 C-6 -6.5 14 -6.4 26 -5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="34" y="-3.2" width="6" height="6.4" rx="2" fill="#B7A46A" />
      <circle cx="-36" cy="0.5" r="1.8" fill="rgba(0,0,0,0.3)" />
    </g>
  );
}

function Squash() {
  return (
    <g id="cc-squash">
      <path d={SQUASH} fill={SHADOW} transform="translate(3 4)" />
      <path d={SQUASH} fill="currentColor" />
      <path d={SQUASH} fill="url(#ccShadeLin)" stroke="rgba(90,60,0,0.3)" strokeWidth="1" />
      <path d="M-24 -8 C-14 -12.5 -2 -9 14 -4.6 L26 -2.8" stroke="rgba(255,255,255,0.45)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M33 -1.6 L39 -2.4 L39.6 1.8 L33 1.6Z" fill="#7C8A3A" />
    </g>
  );
}

function Eggplant() {
  return (
    <g id="cc-eggplant">
      <ellipse cx="3" cy="4" rx="15" ry="17.5" fill={SHADOW} />
      <path d={EGGPLANT} fill="currentColor" />
      <path d={EGGPLANT} fill={SHADE} />
      <ellipse cx="-5.5" cy="-1" rx="3.4" ry="8.5" transform="rotate(14 -5.5 -1)" fill="rgba(255,235,255,0.3)" />
      <circle cx="5" cy="9" r="1.4" fill="rgba(255,235,255,0.25)" />
      <path d="M-9 -13 L-4 -11 L-3 -16.5 L1 -12 L5 -16 L5 -11 L10 -12.5 L6 -8.5 Q0 -6 -6 -8.5Z" fill="#4E7A34" />
      <path d="M0 -13 Q1 -18 4 -20" stroke="#5E8A3C" strokeWidth="3" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Garlic() {
  return (
    <g id="cc-garlic">
      <path d={GARLIC} fill={SHADOW} transform="translate(2.5 3.5)" />
      <path d={GARLIC} fill="currentColor" />
      <path d={GARLIC} fill={SHADE} />
      <path d="M0 -18 Q-11 -1 -8 16 M0 -18 Q11 -1 8 16 M0 -18 Q-1 0 0 16.5" stroke="rgba(120,86,60,0.28)" strokeWidth="1.1" fill="none" />
      <path d="M-14 4 Q-12 12 -5 15" stroke="rgba(160,90,140,0.25)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M-6 -6 Q-10 0 -9 8" stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M-3 16.5 L-4 19.5 M0 16.8 L0 20 M3 16.5 L4 19.5" stroke="#B49B74" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
}

function Cabbage() {
  return (
    <g id="cc-cabbage">
      <circle cx="3" cy="5" r="24.5" fill={SHADOW} />
      <path d={CABBAGE} fill="currentColor" />
      <path d={CABBAGE} fill={SHADE} />
      <path d="M-23 4 C-20 16 -8 23 6 23 C14 22 20 17 23 9 C14 16 2 17 -8 13 C-15 11 -20 8 -23 4Z" fill="rgba(60,110,30,0.26)" />
      <path
        d="M-2 22 Q-6 6 -17 -8 M-4.5 11 Q-12 6 -20 6 M-2 22 Q3 4 12 -14 M2 8 Q10 4 18 4 M-6 2 Q-4 -8 -2 -17"
        stroke="rgba(245,255,225,0.55)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="-9" cy="-11" rx="7" ry="3.6" transform="rotate(-30 -9 -11)" fill="rgba(255,255,255,0.3)" />
    </g>
  );
}

function Lettuce() {
  return (
    <g id="cc-lettuce">
      <ellipse cx="2" cy="5" rx="25" ry="21" fill="rgba(0,0,0,0.2)" />
      <path d={LETTUCE_A} fill="currentColor" />
      <path d={LETTUCE_A} fill={SHADE} />
      <path d={LETTUCE_B} fill="rgba(255,255,200,0.16)" />
      <path d={LETTUCE_B} fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="1.2" />
      <path d={LETTUCE_C} fill="rgba(255,255,200,0.2)" />
      <path d="M2 20 Q0 6 -10 -6 M2 20 Q6 4 16 -8 M2 20 Q3 6 4 -10" stroke="rgba(255,255,230,0.28)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Broccoli() {
  return (
    <g id="cc-broccoli">
      <ellipse cx="3" cy="6" rx="23" ry="21" fill={SHADOW} />
      {FLORET_PATHS.map((d, i) => (
        <g key={i}>
          <path d={d} fill="currentColor" />
          <path d={d} fill={SHADE} />
        </g>
      ))}
      <g fill="rgba(210,240,170,0.3)">
        {FLORETS.map(([x, y], i) => (
          <circle key={i} cx={x - 3} cy={y - 3} r="2.6" />
        ))}
      </g>
    </g>
  );
}

function Kale() {
  return (
    <g id="cc-kale">
      <ellipse cx="1" cy="6" rx="22" ry="15" fill="rgba(0,0,0,0.2)" />
      {KALE_LEAVES.map(([rot, len, wid], i) => (
        <g key={i} transform={`translate(0 20) rotate(${rot})`}>
          <path d={leaf(len, wid)} fill="currentColor" />
          <path d={leaf(len, wid)} fill={i % 2 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,220,0.08)'} />
          <path d={leaf(len, wid)} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
          <path
            d={`M0 0 L0 ${-len * 0.88} M0 ${-len * 0.3} L${-wid * 0.6} ${-len * 0.48} M0 ${-len * 0.3} L${wid * 0.6} ${-len * 0.48} M0 ${-len * 0.55} L${-wid * 0.5} ${-len * 0.72} M0 ${-len * 0.55} L${wid * 0.5} ${-len * 0.72}`}
            stroke="rgba(230,255,200,0.35)"
            strokeWidth="1.1"
            fill="none"
          />
        </g>
      ))}
    </g>
  );
}

/** All produce drawings and shared gradients; render once inside the aisle <svg>. */
export function ProduceDefs() {
  return (
    <defs>
      <radialGradient id="ccShade" cx="0.38" cy="0.32" r="0.78">
        <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
        <stop offset="0.42" stopColor="#fff" stopOpacity="0" />
        <stop offset="0.78" stopColor="#000" stopOpacity="0.16" />
        <stop offset="1" stopColor="#000" stopOpacity="0.42" />
      </radialGradient>
      <linearGradient id="ccShadeLin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.42" />
      </linearGradient>
      <linearGradient id="ccBin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0B0C0B" />
        <stop offset="1" stopColor="#1C1F1C" />
      </linearGradient>
      <linearGradient id="ccShelfShadow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#050605" stopOpacity="0.7" />
        <stop offset="0.35" stopColor="#050605" stopOpacity="0.22" />
        <stop offset="0.6" stopColor="#050605" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="ccLip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3A3E3A" />
        <stop offset="0.12" stopColor="#262926" />
        <stop offset="1" stopColor="#141614" />
      </linearGradient>
      <linearGradient id="ccLedge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8D928B" />
        <stop offset="0.1" stopColor="#4E524D" />
        <stop offset="0.75" stopColor="#353833" />
        <stop offset="1" stopColor="#1D1F1C" />
      </linearGradient>
      <linearGradient id="ccCeil" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#262823" />
        <stop offset="0.7" stopColor="#3E413A" />
        <stop offset="1" stopColor="#55584F" />
      </linearGradient>
      <linearGradient id="ccGlow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF4D6" stopOpacity="0.34" />
        <stop offset="0.4" stopColor="#FFF4D6" stopOpacity="0.1" />
        <stop offset="1" stopColor="#FFF4D6" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="ccTube" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFDF4" />
        <stop offset="1" stopColor="#F3E6BE" />
      </linearGradient>
      <Pepper />
      <Tomato />
      <Lemon />
      <Cuke />
      <Zucchini />
      <Squash />
      <Eggplant />
      <Garlic />
      <Cabbage />
      <Lettuce />
      <Broccoli />
      <Kale />
    </defs>
  );
}

/* ------------------------------------------------------------------ planogram */

type Mode = 'round' | 'long' | 'leafy';
interface Kind {
  id: string;
  /** Item diameter (or length, for long items) as a fraction of the bin's inner width. */
  size: number;
  mode: Mode;
  palette: string[];
  /** Base angle and jitter (degrees). */
  angle?: number;
  spin: number;
}

const RED = ['#D3261E', '#C01E19', '#E2392A', '#B31A16', '#D92F21'];
const YELLOW = ['#F4BC16', '#F7C928', '#EDAE0C', '#F9D23C'];
const ORANGE = ['#EE7A14', '#F38A1E', '#E06A10', '#F59A2A'];
const GREEN_P = ['#3E8E2A', '#4C9A2E', '#367F25'];

const KINDS = {
  pepperRed: { id: 'cc-pepper', size: 0.27, mode: 'round', palette: RED, spin: 40 },
  pepperYellow: { id: 'cc-pepper', size: 0.27, mode: 'round', palette: YELLOW, spin: 40 },
  pepperOrange: { id: 'cc-pepper', size: 0.27, mode: 'round', palette: [...ORANGE, ...YELLOW.slice(0, 1)], spin: 40 },
  pepperMix: { id: 'cc-pepper', size: 0.27, mode: 'round', palette: [...RED, ...YELLOW, ...ORANGE, ...GREEN_P], spin: 40 },
  tomato: { id: 'cc-tomato', size: 0.22, mode: 'round', palette: ['#D8361F', '#E0442A', '#C72B19', '#E85634'], spin: 60 },
  lemon: { id: 'cc-lemon', size: 0.24, mode: 'round', palette: ['#F6D12E', '#F2C519', '#F8DA48', '#EDBD12'], spin: 50 },
  cuke: { id: 'cc-cuke', size: 0.17, mode: 'round', palette: ['#2E6B26', '#3A7A2C', '#285E22', '#447F2F'], spin: 30 },
  eggplant: { id: 'cc-eggplant', size: 0.2, mode: 'round', palette: ['#3A1838', '#46204A', '#2F1430', '#4F2552'], spin: 22 },
  garlic: { id: 'cc-garlic', size: 0.2, mode: 'round', palette: ['#F1E9DA', '#EBE0CC', '#F6F0E4', '#E6D8C0'], spin: 26 },
  cabbage: { id: 'cc-cabbage', size: 0.36, mode: 'round', palette: ['#BCD587', '#B2CF7A', '#C6DC94', '#A8C66E'], spin: 50 },
  broccoli: { id: 'cc-broccoli', size: 0.3, mode: 'round', palette: ['#2E6A2C', '#376F2E', '#295F28', '#3E7A33'], spin: 60 },
  lettuce: { id: 'cc-lettuce', size: 0.44, mode: 'leafy', palette: ['#86C23A', '#7AB834', '#93CB45', '#6EAA2E'], spin: 60 },
  redLeaf: { id: 'cc-lettuce', size: 0.42, mode: 'leafy', palette: ['#6C2232', '#7A2A36', '#5E1D2C', '#8A3A3C', '#5E7A2A'], spin: 60 },
  kale: { id: 'cc-kale', size: 0.46, mode: 'leafy', palette: ['#2F7A34', '#2A6E2F', '#3A8A3A', '#24622A'], spin: 70 },
  zucchini: { id: 'cc-zuke', size: 0.62, mode: 'long', palette: ['#2F5E24', '#3A6E2A', '#284F1F', '#456F2E'], angle: -64, spin: 9 },
  squash: { id: 'cc-squash', size: 0.44, mode: 'long', palette: ['#F4C024', '#F7CE3A', '#EDB215', '#F9D64E'], angle: -52, spin: 14 },
} satisfies Record<string, Kind>;
type KindName = keyof typeof KINDS;

// Rows are shelves (top first); columns repeat outward from the centre bin (index 4).
const PLANOGRAM: KindName[][] = [
  ['lettuce', 'kale', 'lemon', 'cuke', 'pepperRed', 'squash', 'tomato', 'kale', 'lettuce'],
  ['redLeaf', 'lettuce', 'tomato', 'eggplant', 'pepperMix', 'cuke', 'pepperOrange', 'lemon', 'kale'],
  ['broccoli', 'kale', 'pepperYellow', 'zucchini', 'pepperMix', 'eggplant', 'cuke', 'redLeaf', 'lettuce'],
  ['cabbage', 'broccoli', 'squash', 'tomato', 'garlic', 'zucchini', 'pepperYellow', 'cabbage', 'broccoli'],
  ['kale', 'lemon', 'cuke', 'pepperRed', 'lettuce', 'eggplant', 'garlic', 'tomato', 'redLeaf'],
  ['lettuce', 'pepperOrange', 'cabbage', 'squash', 'broccoli', 'pepperMix', 'kale', 'lemon', 'cuke'],
  ['redLeaf', 'cuke', 'pepperRed', 'lemon', 'kale', 'tomato', 'zucchini', 'garlic', 'pepperYellow'],
];

/* ------------------------------------------------------------------ layout */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRICES = ['0.99', '1.29', '1.49', '1.79', '1.99', '2.29', '2.49', '2.99', '3.49', '0.79', '3.99', '1.69'];

export interface AisleGeometry {
  crateW: number;
  tierH: number;
  topH: number;
}

export function aisleGeometry(W: number, H: number): AisleGeometry {
  const crateW = Math.max(140, Math.min(236, Math.max(W / 6.4, H / 5.6)));
  return { crateW, tierH: crateW * 0.84, topH: Math.max(58, Math.min(96, crateW * 0.42)) };
}

/** Lays the whole aisle wall out for a W×H canvas (px). Returns SVG elements, back to front. */
export function layoutAisle(W: number, H: number, sign: boolean): ReactElement[] {
  const { crateW: cw, tierH, topH } = aisleGeometry(W, H);
  const out: ReactElement[] = [];
  // Shelf ledges go in front of everything in the bins, so leafy piles tuck behind the ledge above.
  const ledges: ReactElement[] = [];
  const cx = W / 2;
  const nSide = Math.ceil((cx + cw / 2) / cw) + 0;
  const ledgeH = Math.max(12, tierH * 0.105);
  const fs = Math.max(6.5, ledgeH * 0.46);

  // back wall
  out.push(<rect key="wall" x="0" y="0" width={W} height={H} fill="#0C0D0B" />);

  for (let t = 0; topH + t * tierH < H; t++) {
    const tierTop = topH + t * tierH;
    const binTop = tierTop + tierH * 0.07;
    const binBot = tierTop + tierH - ledgeH;
    const binH = binBot - binTop;
    const lipH = binH * 0.13;
    const row = PLANOGRAM[t % PLANOGRAM.length];

    for (let c = -nSide; c <= nSide; c++) {
      const x0 = cx - cw / 2 + c * cw;
      const g = cw * 0.022;
      const bx0 = x0 + g;
      const bx1 = x0 + cw - g;
      const wall = cw * 0.034;
      const ix0 = bx0 + wall;
      const ix1 = bx1 - wall;
      const iw = ix1 - ix0;
      const kindName = row[(((c + 4) % 9) + 9) % 9];
      const k: Kind = KINDS[kindName];
      const rand = rng(t * 7919 + (c + 50) * 104729 + 17);
      const key = `${t}:${c}`;

      out.push(<rect key={`${key}b`} x={r1(bx0)} y={r1(binTop)} width={r1(bx1 - bx0)} height={r1(binH)} fill="url(#ccBin)" />);

      // produce, back rows first so front rows overlap them
      const d = k.size * iw;
      const items: ReactElement[] = [];
      const pick = () => k.palette[Math.floor(rand() * k.palette.length)];
      const push = (x: number, y: number, rot: number, s: number, i: number) => {
        const sxs = k.mode !== 'long' && rand() < 0.5 ? -s : s;
        items.push(
          <use
            key={i}
            href={`#${k.id}`}
            color={pick()}
            transform={`translate(${r1(x)} ${r1(y)}) rotate(${Math.round(rot)}) scale(${Math.round(sxs * 1000) / 1000} ${Math.round(s * 1000) / 1000})`}
          />,
        );
      };
      const nominal = k.mode === 'long' ? 74 : k.id === 'cc-lettuce' ? 54 : k.id === 'cc-kale' ? 60 : k.id === 'cc-cabbage' ? 48 : 40;
      const base = d / nominal;
      let i = 0;
      if (k.mode === 'long') {
        const squash = k.id === 'cc-squash';
        const sx = d * (squash ? 0.4 : 0.24);
        const sy = d * (squash ? 0.38 : 0.3);
        const yStart = binTop + d * (squash ? 0.3 : 0.32);
        const nRows = Math.max(2, Math.ceil((binBot - lipH * 0.4 - yStart) / sy));
        for (let r = 0; r < nRows; r++) {
          const y = yStart + r * sy;
          const persp = 0.88 + 0.12 * (r / Math.max(1, nRows - 1));
          const m = d * (0.5 * Math.abs(Math.cos(((k.angle ?? 0) * Math.PI) / 180)) * 0.8 + 0.08);
          const span = iw - m * 2;
          const n = Math.max(2, Math.round(span / sx) + 1);
          const step = span / (n - 1);
          const odd = r % 2 === 1;
          for (let j = 0; j < (odd ? n - 1 : n); j++) {
            const x = ix0 + m + j * step + (odd ? step / 2 : 0);
            const ang = (k.angle ?? 0) + (rand() - 0.5) * 2 * k.spin + (k.id === 'cc-squash' && rand() < 0.2 ? 180 : 0);
            push(x + (rand() - 0.5) * step * 0.25, y + (rand() - 0.5) * sy * 0.3, ang, base * persp * (0.92 + rand() * 0.14), i++);
          }
        }
      } else {
        const leafy = k.mode === 'leafy';
        const sx = d * (leafy ? 0.62 : 0.8);
        const sy = d * (leafy ? 0.5 : 0.6);
        const yStart = binTop + d * (leafy ? 0.2 : 0.32);
        const nRows = Math.max(2, Math.ceil((binBot - lipH * 0.3 - yStart) / sy));
        for (let r = 0; r < nRows; r++) {
          const y = yStart + r * sy;
          const persp = 0.86 + 0.14 * (r / Math.max(1, nRows - 1));
          // Even hex packing across the bin: odd rows sit in the gaps between even-row items.
          const m = d * (leafy ? 0.3 : 0.42);
          const span = iw - m * 2;
          const n = Math.max(2, Math.round(span / sx) + 1);
          const step = span / (n - 1);
          const odd = r % 2 === 1;
          for (let j = 0; j < (odd ? n - 1 : n); j++) {
            const x = ix0 + m + j * step + (odd ? step / 2 : 0);
            const ang = (k.angle ?? 0) + (rand() - 0.5) * 2 * k.spin;
            push(x + (rand() - 0.5) * step * 0.2, y + (rand() - 0.5) * sy * 0.26, ang, base * persp * (0.9 + rand() * 0.18), i++);
          }
        }
      }
      out.push(<g key={`${key}p`}>{items}</g>);

      // shelf shadow over the back of the bin, then the side walls and front lip
      out.push(
        <rect key={`${key}s`} x={r1(bx0)} y={r1(tierTop)} width={r1(bx1 - bx0)} height={r1(binH + (binTop - tierTop))} fill="url(#ccShelfShadow)" />,
      );
      out.push(
        <path
          key={`${key}w`}
          d={`M${r1(bx0)} ${r1(binTop)} h${r1(wall)} l${r1(-wall * 0.2)} ${r1(binH)} h${r1(-wall * 0.8)}Z M${r1(bx1)} ${r1(binTop)} h${r1(-wall)} l${r1(wall * 0.2)} ${r1(binH)} h${r1(wall * 0.8)}Z`}
          fill="#1F221F"
        />,
      );
      out.push(
        <path
          key={`${key}l`}
          d={`M${r1(bx0 + wall * 0.6)} ${r1(binBot - lipH)} H${r1(bx1 - wall * 0.6)} L${r1(bx1)} ${r1(binBot)} H${r1(bx0)}Z`}
          fill="url(#ccLip)"
        />,
      );
    }

    // shelf ledge with price tags
    ledges.push(<rect key={`${t}ledge`} x="0" y={r1(binBot)} width={W} height={r1(ledgeH)} fill="url(#ccLedge)" />);
    for (let c = -nSide; c <= nSide; c++) {
      const x0 = cx - cw / 2 + c * cw;
      const rand = rng(t * 31 + (c + 50) * 997 + 5);
      const tags = rand() < 0.4 ? 2 : 1;
      for (let j = 0; j < tags; j++) {
        const tw = Math.max(30, cw * 0.2);
        const th = ledgeH * 0.6;
        const tx = x0 + cw * (tags === 2 ? (j === 0 ? 0.12 : 0.62) : 0.2 + rand() * 0.45);
        const ty = binBot + ledgeH * 0.24;
        const sale = rand() < 0.16;
        ledges.push(
          <g key={`${t}:${c}:${j}tag`}>
            <rect x={r1(tx)} y={r1(ty)} width={r1(tw)} height={r1(th)} rx="1" fill={sale ? '#F6D34A' : '#F3F0E6'} />
            <rect x={r1(tx + tw * 0.07)} y={r1(ty + th * 0.22)} width={r1(tw * 0.32)} height={r1(th * 0.14)} fill="rgba(40,40,40,0.35)" />
            <rect x={r1(tx + tw * 0.07)} y={r1(ty + th * 0.52)} width={r1(tw * 0.22)} height={r1(th * 0.12)} fill="rgba(40,40,40,0.25)" />
            <text
              x={r1(tx + tw * 0.93)}
              y={r1(ty + th * 0.74)}
              textAnchor="end"
              fontSize={r1(fs)}
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
              fill={sale ? '#B3261E' : '#2A2A26'}
            >
              ${PRICES[Math.floor(rand() * PRICES.length)]}
            </text>
          </g>,
        );
      }
    }
  }

  out.push(...ledges);

  // ceiling, fluorescent strip and its glow
  out.push(<rect key="ceil" x="0" y="0" width={W} height={r1(topH)} fill="url(#ccCeil)" />);
  out.push(<rect key="ceilLip" x="0" y={r1(topH - 3)} width={W} height="3" fill="#5A5E56" />);
  const tubeY = topH * 0.44;
  const tubeH = Math.max(4, topH * 0.075);
  out.push(<rect key="glow" x="0" y={r1(tubeY)} width={W} height={r1(tierH * 0.9)} fill="url(#ccGlow)" />);
  const seg = Math.max(260, W / 2.4);
  out.push(<rect key="halo" x="0" y={r1(tubeY - tubeH * 1.6)} width={W} height={r1(tubeH * 4.2)} fill="rgba(255,244,214,0.12)" />);
  for (let x = -((W / 2) % seg) - seg, n = 0; x < W; x += seg, n++) {
    out.push(<rect key={`tube${n}`} x={r1(x + 10)} y={r1(tubeY)} width={r1(seg - 20)} height={r1(tubeH)} rx={r1(tubeH / 2)} fill="url(#ccTube)" />);
    out.push(<rect key={`clip${n}`} x={r1(x - 7)} y={r1(tubeY - 2)} width="14" height={r1(tubeH + 4)} rx="2" fill="#4B4E47" />);
  }

  // hanging aisle sign
  if (sign) {
    const sw = Math.max(150, Math.min(210, cw * 0.95));
    const sh = sw * 0.2;
    const sx0 = W * 0.5 - sw / 2;
    const sy0 = topH * 0.62;
    out.push(
      <g key="sign">
        <path d={`M${r1(sx0 + sw * 0.15)} 0 V${r1(sy0)} M${r1(sx0 + sw * 0.85)} 0 V${r1(sy0)}`} stroke="#5A5E56" strokeWidth="1.5" />
        <rect x={r1(sx0 + 2)} y={r1(sy0 + 4)} width={r1(sw)} height={r1(sh)} rx={r1(sh * 0.22)} fill="rgba(0,0,0,0.35)" />
        <rect x={r1(sx0)} y={r1(sy0)} width={r1(sw)} height={r1(sh)} rx={r1(sh * 0.22)} fill="#1E6A45" />
        <rect x={r1(sx0 + 3)} y={r1(sy0 + 3)} width={r1(sw - 6)} height={r1(sh - 6)} rx={r1(sh * 0.16)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        <circle cx={r1(sx0 + sh * 0.62)} cy={r1(sy0 + sh / 2)} r={r1(sh * 0.32)} fill="#F7C978" />
        <text x={r1(sx0 + sh * 0.62)} y={r1(sy0 + sh * 0.64)} textAnchor="middle" fontSize={r1(sh * 0.42)} fontWeight="800" fontFamily="system-ui, sans-serif" fill="#1E3A2A">
          1
        </text>
        <text
          x={r1(sx0 + sw * 0.56)}
          y={r1(sy0 + sh * 0.66)}
          textAnchor="middle"
          fontSize={r1(sh * 0.44)}
          fontWeight="800"
          letterSpacing={r1(sh * 0.09)}
          fontFamily="system-ui, sans-serif"
          fill="#FFFFFF"
        >
          PRODUCE
        </text>
      </g>,
    );
  }

  return out;
}
