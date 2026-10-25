import { useMemo } from 'react';
import type { ShotData } from '@/services/supabaseDataService';

// Half court in tenths of a foot, like xLegacy/yLegacy: 50 ft wide, 47 ft deep,
// hoop 5.25 ft from the baseline. Shot (x, y) is drawn at (HOOP_X + x, HOOP_Y - y).
const W = 500;
const H = 470;
const HOOP_X = 250;
const HOOP_Y = H - 52.5;
const SQRT3 = Math.sqrt(3);

export type CourtMode = 'hex' | 'dots';

interface Bin {
  cx: number;
  cy: number;
  shots: number;
  points: number;
}

// Pointy-top hexagons on a proper lattice (axial coordinates, cube rounding).
function binShots(shots: ShotData[], r: number): Bin[] {
  const bins = new Map<string, Bin>();
  for (const s of shots) {
    const px = HOOP_X + s.xLegacy;
    const py = HOOP_Y - s.yLegacy;
    const qf = ((SQRT3 / 3) * px - py / 3) / r;
    const rf = ((2 / 3) * py) / r;
    let q = Math.round(qf), rr = Math.round(rf);
    const sf = -qf - rf, sr = Math.round(sf);
    const dq = Math.abs(q - qf), dr = Math.abs(rr - rf), ds = Math.abs(sr - sf);
    if (dq > dr && dq > ds) q = -rr - sr;
    else if (dr > ds) rr = -q - sr;
    const key = `${q},${rr}`;
    let bin = bins.get(key);
    if (!bin) {
      bin = { cx: r * SQRT3 * (q + rr / 2), cy: r * 1.5 * rr, shots: 0, points: 0 };
      bins.set(key, bin);
    }
    bin.shots++;
    if (s.shotResult === 'Made') bin.points += s.shotValue;
  }
  return [...bins.values()];
}

function hexPath(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
}

// Points per shot -> colour on a diverging scale: blue below the league, grey
// at it, red above. (Interpolated in RGB so no greens appear in between.)
const COLD = [70, 130, 220];
const MID = [150, 150, 145];
const HOT = [235, 70, 60];
export function ppsColor(pps: number, league: number): string {
  const t = Math.max(-1, Math.min(1, (pps - league) / 0.45));
  const [a, b, k] = t < 0 ? [MID, COLD, -t] : [MID, HOT, t];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

function CourtLines() {
  const line = { fill: 'none', stroke: 'hsl(var(--court-lines) / 0.55)', strokeWidth: 2 };
  return (
    <g {...line}>
      <rect x={1} y={1} width={W - 2} height={H - 2} rx={6} />
      <rect x={HOOP_X - 80} y={H - 190} width={160} height={190} />
      <path d={`M ${HOOP_X - 60} ${H - 190} A 60 60 0 0 1 ${HOOP_X + 60} ${H - 190}`} />
      <path d={`M ${HOOP_X - 40} ${HOOP_Y} A 40 40 0 0 1 ${HOOP_X + 40} ${HOOP_Y}`} />
      <path d={`M ${HOOP_X - 220} ${H} L ${HOOP_X - 220} ${H - 140} A 237.5 237.5 0 0 1 ${HOOP_X + 220} ${H - 140} L ${HOOP_X + 220} ${H}`} />
      <path d={`M ${HOOP_X - 60} 0 A 60 60 0 0 0 ${HOOP_X + 60} 0`} />
      <line x1={HOOP_X - 30} y1={H - 40} x2={HOOP_X + 30} y2={H - 40} strokeWidth={4} />
      <circle cx={HOOP_X} cy={HOOP_Y} r={7.5} />
    </g>
  );
}

interface CourtProps {
  shots: ShotData[];
  mode?: CourtMode;
  /** League points per shot used as the neutral colour. */
  leaguePps: number;
  /** Hexagon radius in court units (tenths of a foot). */
  hexRadius?: number;
  label?: string;
  className?: string;
  /** Bins with fewer shots are drawn small and grey (too few to judge). */
  minShots?: number;
  /** How far from the baseline to show, in feet (the back court is empty). */
  depthFt?: number;
}

export function Court({
  shots, mode = 'hex', leaguePps, hexRadius = 16, label, className, minShots = 5, depthFt = 35,
}: CourtProps) {
  const hexes = useMemo(() => {
    if (mode !== 'hex') return [];
    const bins = binShots(shots, hexRadius);
    // Size by volume relative to the busiest bins (95th percentile), colour by points per shot.
    const counts = bins.map(b => b.shots).sort((a, b) => a - b);
    const cap = counts[Math.floor(counts.length * 0.95)] || 1;
    return bins.map(b => ({
      d: hexPath(b.cx, b.cy, hexRadius * (0.3 + 0.7 * Math.sqrt(Math.min(1, b.shots / cap)))),
      fill: b.shots < minShots ? 'rgb(110 115 125)' : ppsColor(b.points / b.shots, leaguePps),
      opacity: b.shots < minShots ? 0.35 : 0.95,
    }));
  }, [shots, mode, hexRadius, leaguePps, minShots]);

  const dots = useMemo(() => {
    if (mode !== 'dots') return { made: '', missed: '' };
    let made = '', missed = '';
    for (const s of shots) {
      const x = (HOOP_X + s.xLegacy).toFixed(0);
      const y = (HOOP_Y - s.yLegacy).toFixed(0);
      if (s.shotResult === 'Made') made += `M${x} ${y}h0`;
      else missed += `M${+x - 3} ${+y - 3}l6 6m0 -6l-6 6`;
    }
    return { made, missed };
  }, [shots, mode]);

  return (
    <svg
      viewBox={`0 ${H - depthFt * 10} ${W} ${depthFt * 10}`}
      role="img"
      aria-label={label ?? `Shot chart, ${shots.length} shots`}
      className={className}
      style={{ background: 'hsl(220 15% 13%)', borderRadius: 8 }}
    >
      <CourtLines />
      {mode === 'hex' ? (
        <g>
          {hexes.map((h, i) => (
            <path key={i} d={h.d} fill={h.fill} opacity={h.opacity} />
          ))}
        </g>
      ) : (
        <g strokeLinecap="round" fill="none">
          <path d={dots.missed} stroke="hsl(215 20% 62% / 0.55)" strokeWidth={1.6} />
          <path d={dots.made} stroke="hsl(var(--accent) / 0.85)" strokeWidth={6} />
        </g>
      )}
    </svg>
  );
}

export function HexLegend({ leaguePps }: { leaguePps: number }) {
  const stops = [-0.45, -0.2, 0, 0.2, 0.45];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Points per shot</span>
        <span className="flex">
          {stops.map(s => (
            <span key={s} className="h-3 w-5" style={{ background: ppsColor(leaguePps + s, leaguePps) }} />
          ))}
        </span>
        <span>
          {(leaguePps - 0.45).toFixed(2)} · league {leaguePps.toFixed(2)} · {(leaguePps + 0.45).toFixed(2)}
        </span>
      </div>
      <span>Bigger hexagon = more shots · grey = too few shots to judge</span>
    </div>
  );
}

export function DotLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--accent))' }} /> Made
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="font-bold leading-none" style={{ color: 'hsl(215 20% 62%)' }}>×</span> Missed
      </span>
    </div>
  );
}
