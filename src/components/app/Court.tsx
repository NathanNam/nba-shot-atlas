import { useMemo } from 'react';
import type { ShotData } from '@/services/staticData';

// Half court in tenths of a foot, like xLegacy/yLegacy: 50 ft wide, 47 ft deep,
// hoop 5.25 ft from the baseline. Shot (x, y) is drawn at (HOOP_X + x, HOOP_Y - y).
const W = 500;
const H = 470;
const HOOP_X = 250;
const HOOP_Y = H - 52.5;
const SQRT3 = Math.sqrt(3);
/** Points-per-shot difference from the league that gets the strongest colour. */
const PPS_RANGE = 0.45;

export type CourtMode = 'hex' | 'dots';

interface Bin {
  cx: number;
  cy: number;
  shots: number;
  made: number;
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
      bin = { cx: r * SQRT3 * (q + rr / 2), cy: r * 1.5 * rr, shots: 0, made: 0, points: 0 };
      bins.set(key, bin);
    }
    bin.shots++;
    if (s.shotResult === 'Made') {
      bin.made++;
      bin.points += s.shotValue;
    }
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

/** Diverging colour from the theme: --hex-cold below the league, --hex-mid at it, --hex-hot above. */
function ppsColor(pps: number, league: number): string {
  const t = Math.max(-1, Math.min(1, (pps - league) / PPS_RANGE));
  const end = t < 0 ? '--hex-cold' : '--hex-hot';
  return `color-mix(in srgb, rgb(var(${end})) ${Math.round(Math.abs(t) * 100)}%, rgb(var(--hex-mid)))`;
}

function CourtLines() {
  return (
    <g fill="none" style={{ stroke: 'rgb(var(--court-line))' }} strokeWidth={2}>
      <rect x={HOOP_X - 80} y={H - 190} width={160} height={190} />
      <path d={`M ${HOOP_X - 60} ${H - 190} A 60 60 0 0 1 ${HOOP_X + 60} ${H - 190}`} />
      <path d={`M ${HOOP_X - 40} ${HOOP_Y} A 40 40 0 0 1 ${HOOP_X + 40} ${HOOP_Y}`} />
      <path d={`M ${HOOP_X - 220} ${H} L ${HOOP_X - 220} ${H - 140} A 237.5 237.5 0 0 1 ${HOOP_X + 220} ${H - 140} L ${HOOP_X + 220} ${H}`} />
      <line x1={HOOP_X - 30} y1={H - 40} x2={HOOP_X + 30} y2={H - 40} strokeWidth={4} />
      <circle cx={HOOP_X} cy={HOOP_Y} r={7.5} />
      <line x1={0} y1={H - 1} x2={W} y2={H - 1} />
    </g>
  );
}

interface CourtProps {
  shots: ShotData[];
  mode?: CourtMode;
  /** League points per shot, the neutral colour. */
  leaguePps: number;
  /** Hexagon radius in court units (tenths of a foot). */
  hexRadius?: number;
  /** Bins with fewer shots are drawn small and grey (too few to judge). */
  minShots?: number;
  /** How far from the baseline to show, in feet (the back court is empty). */
  depthFt?: number;
  /** Hover tooltips on each hexagon. */
  tooltips?: boolean;
  label?: string;
  className?: string;
}

export function Court({
  shots, mode = 'hex', leaguePps, hexRadius = 16, minShots = 5, depthFt = 35, tooltips = true, label, className,
}: CourtProps) {
  const hexes = useMemo(() => {
    if (mode !== 'hex') return [];
    const bins = binShots(shots, hexRadius);
    // Size by volume relative to the busiest bins (95th percentile), colour by points per shot.
    const counts = bins.map(b => b.shots).sort((a, b) => a - b);
    const cap = counts[Math.floor(counts.length * 0.95)] || 1;
    return bins.map(b => {
      const thin = b.shots < minShots;
      const pps = b.points / b.shots;
      return {
        d: hexPath(b.cx, b.cy, hexRadius * (0.3 + 0.7 * Math.sqrt(Math.min(1, b.shots / cap)))),
        fill: thin ? 'rgb(var(--hex-thin))' : ppsColor(pps, leaguePps),
        opacity: thin ? 0.6 : 1,
        title: `${b.shots} shot${b.shots === 1 ? '' : 's'}, ${b.made} made (${Math.round((b.made / b.shots) * 100)}%) · ${pps.toFixed(2)} points per shot${thin ? ' · too few to judge' : ''}`,
      };
    });
  }, [shots, mode, hexRadius, leaguePps, minShots]);

  const dots = useMemo(() => {
    if (mode !== 'dots') return { made: '', missed: '' };
    let made = '', missed = '';
    for (const s of shots) {
      const x = Math.round(HOOP_X + s.xLegacy);
      const y = Math.round(HOOP_Y - s.yLegacy);
      if (s.shotResult === 'Made') made += `M${x} ${y}h0`;
      else missed += `M${x - 3} ${y - 3}l6 6m0 -6l-6 6`;
    }
    return { made, missed };
  }, [shots, mode]);

  return (
    <svg
      viewBox={`0 ${H - depthFt * 10} ${W} ${depthFt * 10}`}
      role="img"
      aria-label={label ?? `Shot chart, ${shots.length} shots`}
      className={className}
      style={{ background: 'rgb(var(--court-bg))', borderRadius: 'var(--radius)', display: 'block' }}
    >
      <CourtLines />
      {mode === 'hex' ? (
        <g>
          {hexes.map((h, i) => (
            <path key={i} d={h.d} style={{ fill: h.fill }} opacity={h.opacity}>
              {tooltips && <title>{h.title}</title>}
            </path>
          ))}
        </g>
      ) : (
        <g strokeLinecap="round" fill="none">
          <path d={dots.missed} style={{ stroke: 'rgb(var(--missed) / 0.6)' }} strokeWidth={1.6} />
          <path d={dots.made} style={{ stroke: 'rgb(var(--made) / 0.8)' }} strokeWidth={6} />
        </g>
      )}
    </svg>
  );
}

export function HexLegend({ leaguePps }: { leaguePps: number }) {
  const stops = [-1, -0.5, 0, 0.5, 1];
  return (
    <div className="font-ui flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-2">
      <span className="flex items-center gap-2">
        <span className="flex" aria-hidden>
          {stops.map(s => (
            <span key={s} className="h-2.5 w-4" style={{ background: ppsColor(leaguePps + s * PPS_RANGE, leaguePps) }} />
          ))}
        </span>
        <span>
          <b className="font-semibold" style={{ color: 'rgb(var(--hex-hot))' }}>Red</b>: scores more per shot than the league average ·{' '}
          <b className="font-semibold" style={{ color: 'rgb(var(--hex-cold))' }}>blue</b>: less
        </span>
      </span>
      <span>Bigger = more shots from there · grey = too few to judge · hover for numbers</span>
    </div>
  );
}

export function DotLegend() {
  return (
    <div className="font-ui flex items-center gap-4 text-xs text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'rgb(var(--made))' }} /> Made
      </span>
      <span className="flex items-center gap-1.5">
        <span aria-hidden className="font-bold leading-none" style={{ color: 'rgb(var(--missed))' }}>×</span> Missed
      </span>
    </div>
  );
}
