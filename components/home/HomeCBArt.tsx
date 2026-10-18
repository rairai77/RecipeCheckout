/**
 * Hand-built flat-lay vector illustrations for home variant CB (web only: rendered as raw DOM <svg>).
 * Every item is drawn around (0,0) in its own viewBox; shared gradients live in <ArtDefs/>, rendered once.
 */
import type { ReactElement } from 'react';

type Pt = [number, number];

const r1 = (n: number) => Math.round(n * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (r: number, a: number): Pt => [r * Math.cos(a), r * Math.sin(a)];

/** Smooth closed (or open) path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: Pt[], closed = true): string {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** Deterministic wobble so organic outlines look hand-drawn but never change between renders. */
const wob = (seed: number, i: number) => Math.sin(seed * 12.9898 + i * 78.233) * 0.5 + Math.sin(seed * 3.1 + i * 1.7) * 0.5;

/** A slightly lumpy round outline (tomato, onion) with `lobes` gentle bulges. */
function blob(r: number, lobes: number, amp: number, phase: number, seed: number, sx = 1, sy = 1): string {
  const pts: Pt[] = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r + amp * Math.cos(lobes * (a - phase)) + wob(seed, i) * 1.2;
    pts.push([rr * Math.cos(a) * sx, rr * Math.sin(a) * sy]);
  }
  return smooth(pts);
}

/** Citrus / tomato chamber: a wedge from the core to the rind with rounded corners and a constant gap. */
function wedge(a0: number, a1: number, ri: number, ro: number, gap: number): string {
  const mid = (a0 + a1) / 2;
  const off = (r: number) => gap / 2 / r;
  const rA = ri + (ro - ri) * 0.42;
  const rB = ro - 6;
  const pts: Pt[] = [polar(ri, mid)];
  pts.push(polar(rA, a1 - off(rA)));
  pts.push(polar(rB, a1 - off(rB)));
  const steps = 4;
  const s0 = a1 - off(ro) - 0.04;
  const s1 = a0 + off(ro) + 0.04;
  for (let s = 0; s <= steps; s++) pts.push(polar(ro, s0 + ((s1 - s0) * s) / steps));
  pts.push(polar(rB, a0 + off(rB)));
  pts.push(polar(rA, a0 + off(rA)));
  return smooth(pts);
}

/** A pointed oval leaf lying along +x from the origin. */
function leafPath(len: number, wid: number): string {
  return `M0 0 C${r1(len * 0.18)} ${r1(-wid)} ${r1(len * 0.62)} ${r1(-wid * 1.12)} ${len} 0 C${r1(len * 0.62)} ${r1(wid * 0.92)} ${r1(len * 0.2)} ${r1(wid * 0.9)} 0 0Z`;
}
function leafUpper(len: number, wid: number): string {
  return `M0 0 C${r1(len * 0.18)} ${r1(-wid)} ${r1(len * 0.62)} ${r1(-wid * 1.12)} ${len} 0 Q${r1(len * 0.5)} ${r1(-wid * 0.1)} 0 0Z`;
}

/* ------------------------------------------------------------------ palette */

export const ART = {
  table: '#163A2B',
  tomato: '#D9472B',
  leaf: '#4E9A57',
  leafDeep: '#2C6B3C',
  cream: '#F6EEDC',
};

/* ------------------------------------------------------------------ shared gradients */

export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="cbTomato" cx="0.36" cy="0.32" r="0.78">
          <stop offset="0" stopColor="#F5825C" />
          <stop offset="0.42" stopColor="#E04E2F" />
          <stop offset="1" stopColor="#A42D19" />
        </radialGradient>
        <radialGradient id="cbLemonSeg" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="72">
          <stop offset="0" stopColor="#FFF2B0" />
          <stop offset="0.55" stopColor="#FBDD5E" />
          <stop offset="1" stopColor="#F4C832" />
        </radialGradient>
        <radialGradient id="cbLimeSeg" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="72">
          <stop offset="0" stopColor="#E6F3B4" />
          <stop offset="0.55" stopColor="#BFDC6C" />
          <stop offset="1" stopColor="#97C247" />
        </radialGradient>
        <radialGradient id="cbAvo" gradientUnits="userSpaceOnUse" cx="0" cy="28" r="98">
          <stop offset="0" stopColor="#F1F2B8" />
          <stop offset="0.45" stopColor="#D6E585" />
          <stop offset="0.82" stopColor="#9CC452" />
          <stop offset="1" stopColor="#6E9E36" />
        </radialGradient>
        <radialGradient id="cbPit" gradientUnits="userSpaceOnUse" cx="-10" cy="26" r="38">
          <stop offset="0" stopColor="#C08A56" />
          <stop offset="0.65" stopColor="#8E5731" />
          <stop offset="1" stopColor="#653A1E" />
        </radialGradient>
        <linearGradient id="cbGarlic" x1="0" y1="0" x2="1" y2="0.25">
          <stop offset="0" stopColor="#FFFBF2" />
          <stop offset="0.55" stopColor="#F3E7CF" />
          <stop offset="1" stopColor="#D9C4A0" />
        </linearGradient>
        <linearGradient id="cbChili" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0603A" />
          <stop offset="0.55" stopColor="#D23A22" />
          <stop offset="1" stopColor="#9E2514" />
        </linearGradient>
        <linearGradient id="cbWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#DCA56B" />
          <stop offset="0.6" stopColor="#C88A4F" />
          <stop offset="1" stopColor="#B07440" />
        </linearGradient>
        <linearGradient id="cbSteel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4F7F6" />
          <stop offset="0.45" stopColor="#D4DBD8" />
          <stop offset="1" stopColor="#9EAAA6" />
        </linearGradient>
        <linearGradient id="cbHandle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A3B31" />
          <stop offset="1" stopColor="#1F1814" />
        </linearGradient>
        <linearGradient id="cbBasil" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2F7A40" />
          <stop offset="1" stopColor="#4FA25A" />
        </linearGradient>
        <radialGradient id="cbMush" gradientUnits="userSpaceOnUse" cx="0" cy="-10" r="90">
          <stop offset="0" stopColor="#FBF4E6" />
          <stop offset="1" stopColor="#EAD9BC" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ------------------------------------------------------------------ items */

export interface ArtItem {
  /** viewBox width / height; the art is centred on 0,0. */
  vw: number;
  vh: number;
  node: ReactElement;
}

const TOMATO_BODY = blob(80, 5, 2.6, 0.35, 3);

function tomato(): ArtItem {
  const sepals = [0, 1, 2, 3, 4].map((i) => {
    const a = -90 + i * 72 + wob(7, i) * 10;
    const s = 0.92 + wob(9, i) * 0.14;
    return (
      <g key={i} transform={`rotate(${r1(a)}) scale(${r1(s * 100) / 100})`}>
        <path d="M0 -6 C10 -11 23 -12 36 -4 C39 -2 39 1 35 2 C23 7 10 8 0 6Z" fill="#3E8D4E" />
        <path d="M5 0 C15 -2 25 -2 33 -1" stroke="#2A6A3A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
    );
  });
  const creases = [0, 1, 2, 3, 4].map((i) => {
    const a = 0.35 + ((i + 0.5) * Math.PI * 2) / 5;
    const p0 = polar(22, a);
    const pm = polar(42, a + 0.08);
    const p1 = polar(62, a + 0.04);
    return (
      <path
        key={i}
        d={`M${r1(p0[0])} ${r1(p0[1])} Q${r1(pm[0])} ${r1(pm[1])} ${r1(p1[0])} ${r1(p1[1])}`}
        stroke="#8E2412"
        strokeOpacity="0.16"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    );
  });
  return {
    vw: 200,
    vh: 200,
    node: (
      <>
        <path d={TOMATO_BODY} fill="url(#cbTomato)" />
        {creases}
        <path d="M-52 -30 C-46 -50 -30 -62 -12 -66" stroke="#FFE6D9" strokeOpacity="0.55" strokeWidth="7" strokeLinecap="round" fill="none" />
        <circle cx="-58" cy="-10" r="3.6" fill="#FFE6D9" opacity="0.5" />
        {sepals}
        <circle r="7.5" fill="#2C6B3C" />
        <circle cx="-1.5" cy="-1.5" r="3" fill="#6AAE72" />
      </>
    ),
  };
}

function tomatoSlice(): ArtItem {
  const chambers: ReactElement[] = [];
  const seeds: ReactElement[] = [];
  const cuts = [0, 92, 178, 268].map((d) => rad(d + 20));
  cuts.forEach((a0, i) => {
    const a1 = i === cuts.length - 1 ? cuts[0] + Math.PI * 2 : cuts[i + 1];
    chambers.push(<path key={i} d={wedge(a0, a1, 18, 60, 13)} fill="#F7976F" />);
    chambers.push(<path key={`g${i}`} d={wedge(a0, a1, 24, 52, 22)} fill="#FBB08C" opacity="0.7" />);
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      const a = a0 + (a1 - a0) * (0.18 + 0.64 * t);
      const rr = 36 + wob(i + 2, k) * 4;
      const [x, y] = polar(rr, a);
      seeds.push(
        <ellipse
          key={`${i}-${k}`}
          cx={r1(x)}
          cy={r1(y)}
          rx="5.2"
          ry="3.2"
          transform={`rotate(${r1((a * 180) / Math.PI)} ${r1(x)} ${r1(y)})`}
          fill="#FCE7A6"
          stroke="#E6B866"
          strokeWidth="1"
        />,
      );
    }
  });
  return {
    vw: 200,
    vh: 200,
    node: (
      <>
        <path d={blob(88, 5, 1.5, 0.2, 5)} fill="#B8301B" />
        <path d={blob(82, 5, 1.5, 0.2, 5)} fill="#E4502F" />
        <path d={blob(66, 4, 2, 0.4, 6)} fill="#EC6A47" />
        {chambers}
        {seeds}
        <circle r="15" fill="#F08260" />
        <circle r="8" fill="#F5A07F" />
        <path d="M-70 -24 A74 74 0 0 1 -30 -68" stroke="#fff" strokeOpacity="0.35" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </>
    ),
  };
}

function citrusHalf(kind: 'lemon' | 'lime'): ArtItem {
  const lime = kind === 'lime';
  const n = lime ? 9 : 10;
  const segs = Array.from({ length: n }, (_, i) => {
    const a0 = rad(-90 + (360 / n) * i + wob(lime ? 4 : 2, i) * 3);
    const a1 = rad(-90 + (360 / n) * (i + 1) + wob(lime ? 4 : 2, i + 1) * 3);
    const mid = (a0 + a1) / 2;
    const p = polar(30, mid);
    const q = polar(55, mid + 0.05);
    return (
      <g key={i}>
        <path d={wedge(a0, a1, 7, 68, 5)} fill={lime ? 'url(#cbLimeSeg)' : 'url(#cbLemonSeg)'} />
        <path d={`M${r1(p[0])} ${r1(p[1])} L${r1(q[0])} ${r1(q[1])}`} stroke="#fff" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  });
  const dots = Array.from({ length: 16 }, (_, i) => {
    const [x, y] = polar(84.5, (i / 16) * Math.PI * 2 + wob(1, i) * 0.1);
    return <circle key={i} cx={r1(x)} cy={r1(y)} r="1.3" fill={lime ? '#4F8A2A' : '#E0A51C'} opacity="0.7" />;
  });
  return {
    vw: 200,
    vh: 200,
    node: (
      <>
        <circle r="89" fill={lime ? '#4F8F2C' : '#E7B21F'} />
        <circle r="86" fill={lime ? '#6EAA3A' : '#F6C935'} />
        {dots}
        <circle r="77" fill={lime ? '#EEF5D2' : '#FFF6D9'} />
        {segs}
        <circle r="6" fill={lime ? '#EEF5D2' : '#FFF6D9'} />
        <path d="M-80 -22 A83 83 0 0 1 -40 -73" stroke="#fff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ),
  };
}

const AVO_OUTER =
  'M0 -94 C30 -94 44 -64 50 -32 C57 4 76 28 71 60 C64 94 32 102 0 102 C-32 102 -64 94 -71 60 C-76 28 -57 4 -50 -32 C-44 -64 -30 -94 0 -94Z';
const AVO_INNER =
  'M0 -84 C24 -84 36 -58 41 -30 C48 4 65 28 61 56 C55 86 28 92 0 92 C-28 92 -55 86 -61 56 C-65 28 -48 4 -41 -30 C-36 -58 -24 -84 0 -84Z';

function avocado(): ArtItem {
  return {
    vw: 160,
    vh: 210,
    node: (
      <>
        <path d={AVO_OUTER} fill="#2A4F27" />
        <path d={AVO_OUTER} fill="none" stroke="#3F6E33" strokeWidth="3" transform="scale(0.97)" />
        <path d={AVO_INNER} fill="url(#cbAvo)" />
        <circle cx="0" cy="34" r="33" fill="#C2D46E" opacity="0.6" />
        <circle cx="0" cy="34" r="29" fill="url(#cbPit)" />
        <ellipse cx="-10" cy="22" rx="9" ry="6" fill="#E0B07E" opacity="0.55" transform="rotate(-30 -10 22)" />
        <path d="M-30 -52 C-24 -66 -14 -74 -4 -76" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ),
  };
}

const GARLIC_BODY =
  'M0 -94 C5 -72 13 -60 30 -48 C62 -26 79 4 75 34 C71 64 44 82 0 82 C-44 82 -71 64 -75 34 C-79 4 -62 -26 -30 -48 C-13 -60 -5 -72 0 -94Z';

function garlic(): ArtItem {
  const roots = [-16, -10, -4, 2, 8, 14, 19].map((x, i) => (
    <path
      key={i}
      d={`M${x} 82 q${r1(wob(3, i) * 5)} 7 ${r1(wob(5, i) * 6)} ${r1(12 + wob(8, i) * 4)}`}
      stroke="#BFA57A"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
  ));
  return {
    vw: 180,
    vh: 210,
    node: (
      <>
        <path d={GARLIC_BODY} fill="url(#cbGarlic)" />
        {/* clove seams */}
        <g stroke="#D3BE97" strokeWidth="2.4" fill="none" strokeLinecap="round">
          <path d="M-6 -66 C-36 -40 -50 20 -30 80" />
          <path d="M6 -66 C36 -40 50 20 30 80" />
          <path d="M-2 -62 C-14 -20 -14 40 -6 81" />
          <path d="M-22 -46 C-60 -20 -70 30 -54 70" />
          <path d="M22 -46 C60 -20 70 30 54 70" />
        </g>
        {/* faint purple streaks */}
        <g stroke="#B98AA6" strokeOpacity="0.45" strokeWidth="3.4" fill="none" strokeLinecap="round">
          <path d="M-40 -8 C-44 14 -42 38 -36 56" />
          <path d="M20 -18 C24 4 24 30 20 54" />
          <path d="M52 6 C56 24 54 40 48 54" />
        </g>
        <path d="M-50 -20 C-58 0 -60 20 -56 40" stroke="#fff" strokeOpacity="0.7" strokeWidth="4" strokeLinecap="round" fill="none" />
        <ellipse cx="0" cy="81" rx="22" ry="5.5" fill="#CDB58A" />
        {roots}
        <path d="M0 -94 C1 -100 3 -104 6 -106" stroke="#CDB58A" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ),
  };
}

function clove(): ArtItem {
  return {
    vw: 70,
    vh: 100,
    node: (
      <>
        <path d="M2 -44 C16 -32 27 -6 25 18 C23 36 12 44 0 44 C-8 44 -13 37 -11 24 C-9 2 -9 -24 2 -44Z" fill="url(#cbGarlic)" />
        <path d="M2 -40 C6 -14 10 14 4 40" stroke="#D3BE97" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-6 -6 C-7 8 -6 22 -3 32" stroke="#fff" strokeOpacity="0.8" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M-6 41 C-2 44 6 45 12 41" stroke="#C5AA7E" strokeWidth="3" fill="none" strokeLinecap="round" />
      </>
    ),
  };
}

function basil(): ArtItem {
  const leaf = (key: string, x: number, y: number, ang: number, len: number, wid: number, tone = 0) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${ang})`}>
      <path d={leafPath(len, wid)} fill={tone ? '#317C42' : 'url(#cbBasil)'} />
      <path d={leafUpper(len, wid)} fill="#fff" opacity="0.09" />
      <path d={`M3 0 Q${r1(len * 0.5)} ${r1(-wid * 0.08)} ${r1(len * 0.9)} 0`} stroke="#86C47F" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {[0.22, 0.42, 0.62].map((t) => (
        <g key={t} stroke="#7DBE78" strokeOpacity="0.6" strokeWidth="1.1" fill="none" strokeLinecap="round">
          <path d={`M${r1(len * t)} ${r1(-wid * 0.04)} q${r1(len * 0.07)} ${r1(-wid * 0.3)} ${r1(len * 0.14)} ${r1(-wid * (0.62 - t * 0.35))}`} />
          <path d={`M${r1(len * t)} ${r1(wid * 0.03)} q${r1(len * 0.07)} ${r1(wid * 0.3)} ${r1(len * 0.14)} ${r1(wid * (0.56 - t * 0.35))}`} />
        </g>
      ))}
    </g>
  );
  return {
    vw: 200,
    vh: 280,
    node: (
      <>
        <path d="M8 134 C4 80 -4 20 0 -96" stroke="#2F6E3D" strokeWidth="5" strokeLinecap="round" fill="none" />
        {leaf('l1', 5, 74, -158, 82, 30, 1)}
        {leaf('r1', 5, 74, -24, 86, 31)}
        {leaf('l2', 1, 22, -146, 68, 26)}
        {leaf('r2', 1, 22, -34, 66, 25, 1)}
        {leaf('l3', -1, -34, -132, 50, 19, 1)}
        {leaf('r3', -1, -34, -48, 52, 20)}
        {leaf('l4', 0, -84, -116, 32, 12)}
        {leaf('r4', 0, -84, -64, 32, 12, 1)}
        {leaf('t', 0, -92, -90, 22, 8)}
      </>
    ),
  };
}

function rosemary(): ArtItem {
  const needles: ReactElement[] = [];
  for (let i = 0; i < 26; i++) {
    const y = 110 - i * 8.6;
    const side = i % 2 ? 1 : -1;
    const len = 30 - i * 0.6;
    const ang = side === 1 ? -62 + i * 0.6 + wob(2, i) * 6 : -118 - i * 0.6 + wob(3, i) * 6;
    const x = (y / 120) * -3;
    needles.push(
      <g key={i} transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(ang)})`}>
        <path d={`M0 0 C${r1(len * 0.25)} -3.6 ${r1(len * 0.75)} -3.6 ${r1(len)} 0 C${r1(len * 0.75)} 3.4 ${r1(len * 0.25)} 3.4 0 0Z`} fill={i % 3 ? '#4F7F5D' : '#5D8F6B'} />
        <path d={`M2 0 L${r1(len - 3)} 0`} stroke="#A9CBB1" strokeWidth="1.1" strokeLinecap="round" />
      </g>,
    );
  }
  return {
    vw: 90,
    vh: 280,
    node: (
      <>
        <path d="M3 134 C1 60 -2 0 0 -124" stroke="#6B5A34" strokeWidth="3.6" strokeLinecap="round" fill="none" />
        {needles}
      </>
    ),
  };
}

function chili(): ArtItem {
  return {
    vw: 230,
    vh: 100,
    node: (
      <>
        <path
          d="M-74 -24 C-38 -36 12 -32 52 -16 C74 -7 92 8 106 30 C86 20 62 14 40 12 C0 8 -40 10 -74 6 C-84 0 -84 -18 -74 -24Z"
          fill="url(#cbChili)"
        />
        <path d="M-60 -22 C-24 -28 18 -24 52 -10" stroke="#FFD9C9" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M-40 4 C0 2 40 6 80 18" stroke="#7E1A0D" strokeOpacity="0.25" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M-74 -24 C-86 -28 -95 -16 -93 -6 C-91 4 -82 8 -74 6 C-70 -2 -70 -16 -74 -24Z" fill="#3E8D4E" />
        <path d="M-90 -18 C-82 -14 -80 -4 -84 4" stroke="#2A6A3A" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-92 -10 C-102 -12 -108 -22 -105 -36" stroke="#2C6B3C" strokeWidth="6" strokeLinecap="round" fill="none" />
      </>
    ),
  };
}

function onionSlice(): ArtItem {
  const rings = [84, 72, 61, 50, 39, 28, 18];
  return {
    vw: 200,
    vh: 200,
    node: (
      <>
        <path d={blob(91, 3, 2, 0.6, 11, 1, 0.96)} fill="#6A1F4C" />
        <path d={blob(88, 3, 2, 0.6, 11, 1, 0.96)} fill="#8E3468" />
        {rings.map((r, i) => (
          <path
            key={r}
            d={blob(r, 3, 1.4, 0.6 + i * 0.3, 12 + i, 1, 0.96)}
            transform={`translate(${r1((84 - r) * 0.07)} ${r1((84 - r) * 0.05)})`}
            fill={i % 2 ? '#F7E7EF' : '#F2DCE7'}
            stroke="#A9467F"
            strokeWidth={r1(4.2 - i * 0.35)}
          />
        ))}
        <ellipse cx="6" cy="4" rx="5" ry="7" fill="#E9C6D8" />
        <path d="M-74 -30 A80 80 0 0 1 -34 -70" stroke="#fff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ),
  };
}

function mushroom(): ArtItem {
  return {
    vw: 180,
    vh: 180,
    node: (
      <>
        <path
          d="M-80 8 C-80 -50 -42 -78 0 -78 C42 -78 80 -50 80 8 C80 22 60 26 40 22 C30 20 24 24 22 36 L18 74 C16 84 -16 84 -18 74 L-22 36 C-24 24 -30 20 -40 22 C-60 26 -80 22 -80 8Z"
          fill="url(#cbMush)"
        />
        <path d="M-80 8 C-80 -50 -42 -78 0 -78 C42 -78 80 -50 80 8" stroke="#8C5D3B" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M-70 10 C-56 14 -44 12 -34 8 M70 10 C56 14 44 12 34 8" stroke="#D8C2A0" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M-64 4 C-60 -34 -36 -60 0 -62 C36 -60 60 -34 64 4" stroke="#E9D8BA" strokeWidth="2" fill="none" />
        <path d="M-6 40 L-8 70 M6 40 L8 70" stroke="#E2CFAE" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  };
}

function board(): ArtItem {
  const body =
    'M-186 -118 L118 -118 C134 -118 142 -110 144 -96 L146 -44 L190 -38 C210 -36 216 -20 216 0 C216 20 210 36 190 38 L146 44 L144 96 C142 110 134 118 118 118 L-186 118 C-202 118 -212 108 -212 92 L-212 -92 C-212 -108 -202 -118 -186 -118Z M192 -9 A9 9 0 1 0 192 9 A9 9 0 1 0 192 -9Z';
  return {
    vw: 440,
    vh: 250,
    node: (
      <>
        <path d={body} fill="#9E6532" fillRule="evenodd" transform="translate(3 4)" />
        <path d={body} fill="url(#cbWood)" fillRule="evenodd" />
        <g stroke="#A86C36" strokeOpacity="0.38" strokeWidth="2.2" fill="none" strokeLinecap="round">
          <path d="M-196 -86 C-120 -92 -40 -80 40 -88 C80 -92 110 -86 132 -88" />
          <path d="M-198 -50 C-140 -44 -80 -58 -10 -52 C50 -46 96 -56 134 -50" />
          <path d="M-196 -12 C-150 -18 -110 -4 -70 -10 C-40 -14 -20 -30 6 -28 C30 -26 40 -8 70 -10 C100 -12 120 -4 136 -6" />
          <path d="M-196 30 C-130 36 -70 22 0 28 C60 34 100 24 136 28" />
          <path d="M-198 70 C-120 64 -60 78 20 72 C70 68 110 76 134 72" />
          <path d="M150 -20 C170 -24 186 -26 204 -22 M150 22 C170 24 188 26 206 20" />
        </g>
        <ellipse cx="-8" cy="-22" rx="10" ry="4" fill="#A86C36" opacity="0.3" />
        <path d="M-200 -98 C-196 -110 -186 -112 -176 -112 L110 -112" stroke="#F0C48E" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ),
  };
}

function knife(): ArtItem {
  return {
    vw: 410,
    vh: 70,
    node: (
      <>
        <path d="M-198 12 C-150 -14 -60 -24 40 -24 L40 18 L-150 18 C-176 18 -190 17 -198 12Z" fill="url(#cbSteel)" />
        <path d="M-192 13 C-150 16 -60 17 38 16" stroke="#fff" strokeOpacity="0.85" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-140 -10 C-90 -19 -30 -22 38 -22" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.6" fill="none" />
        <rect x="40" y="-26" width="16" height="46" rx="4" fill="#9AA6A2" />
        <rect x="42" y="-24" width="4" height="42" rx="2" fill="#E1E7E5" />
        <path d="M56 -16 L182 -18 C196 -18 204 -10 204 -1 C204 8 196 14 182 14 L56 12Z" fill="url(#cbHandle)" />
        <path d="M62 -11 L180 -12" stroke="#fff" strokeOpacity="0.15" strokeWidth="2" strokeLinecap="round" />
        {[92, 128, 164].map((x) => (
          <g key={x}>
            <circle cx={x} cy="-2" r="4.6" fill="#C8CFCD" />
            <circle cx={x - 1} cy="-3" r="1.8" fill="#fff" />
          </g>
        ))}
      </>
    ),
  };
}

function groceryList(): ArtItem {
  const rows = [-50, -20, 10, 40, 70];
  const scrib = (y: number, end: number) =>
    `M-30 ${y} C-22 ${y - 5} -16 ${y + 4} -8 ${y} C0 ${y - 4} 6 ${y + 4} 14 ${y} C22 ${y - 4} ${end - 10} ${y + 3} ${end} ${y - 1}`;
  const ends = [52, 36, 56, 30, 46];
  return {
    vw: 170,
    vh: 220,
    node: (
      <>
        <rect x="-75" y="-100" width="150" height="200" rx="5" fill="#FBF6EA" />
        <path d="M-75 -70 L75 -70" stroke="#E9DFC9" strokeWidth="1.5" />
        <path d="M-52 -84 C-40 -90 -28 -80 -16 -86 C-4 -92 8 -82 22 -86" stroke="#1F6F4A" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        {rows.map((y, i) => {
          const done = i < 3;
          return (
            <g key={y}>
              <rect x="-58" y={y - 7} width="14" height="14" rx="3.5" fill="none" stroke="#1F7A4D" strokeWidth="2.4" />
              {done ? (
                <path d={`M-56 ${y} l5 5 l11 -13`} stroke="#E04E2F" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
              <path d={scrib(y, ends[i])} stroke={done ? '#A7B2AB' : '#4D5E55'} strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>
          );
        })}
        <rect x="-26" y="-110" width="52" height="20" rx="1.5" fill="#E9A23B" opacity="0.88" transform="rotate(-5)" />
      </>
    ),
  };
}

function peppercorns(): ArtItem {
  const pts: [number, number, number][] = [
    [-30, -8, 6.5], [-14, -20, 6], [0, -4, 7], [16, -16, 5.8], [24, 6, 6.4], [-18, 14, 6], [4, 20, 5.6], [36, -30, 5], [-40, 24, 5.2],
  ];
  return {
    vw: 100,
    vh: 80,
    node: (
      <>
        {pts.map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="#2B211C" />
            <path d={`M${x - r * 0.5} ${y - r * 0.1} q${r * 0.3} ${r * 0.4} ${r * 0.6} 0`} stroke="#4A3B33" strokeWidth="1.1" fill="none" />
            <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.28} fill="#8C7A6E" opacity="0.8" />
          </g>
        ))}
      </>
    ),
  };
}

/** Herb confetti and salt flakes: tiny texture between the big items. */
function scatter(seed: number): ArtItem {
  const bits: ReactElement[] = [];
  for (let i = 0; i < 9; i++) {
    const x = wob(seed, i) * 54;
    const y = wob(seed + 1, i * 3) * 54;
    const a = wob(seed + 2, i) * 180;
    if (i % 3 === 0) {
      bits.push(<rect key={i} x={r1(x)} y={r1(y)} width="4.5" height="4.5" rx="1" fill="#FBF6EA" opacity="0.85" transform={`rotate(${r1(a)} ${r1(x)} ${r1(y)})`} />);
    } else {
      bits.push(
        <path key={i} d={leafPath(13, 4.5)} fill={i % 2 ? '#5DAE62' : '#3E8D4E'} transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1(a)})`} />,
      );
    }
  }
  return { vw: 120, vh: 120, node: <>{bits}</> };
}

export const ITEMS = {
  tomato,
  tomatoSlice,
  lemon: () => citrusHalf('lemon'),
  lime: () => citrusHalf('lime'),
  avocado,
  garlic,
  clove,
  basil,
  rosemary,
  chili,
  onion: onionSlice,
  mushroom,
  board,
  knife,
  list: groceryList,
  pepper: peppercorns,
  scatterA: () => scatter(1),
  scatterB: () => scatter(4),
} satisfies Record<string, () => ArtItem>;

export type ItemKind = keyof typeof ITEMS;
