import type { ShotData } from '@/services/staticData';
import type { LeagueSeason } from '@/services/staticData';

export interface ShootingLine {
  shots: number;
  made: number;
  threes: number;
  threesMade: number;
  /** Fractions (0–1); null when there are no attempts to divide by. */
  fgPct: number | null;
  fg3Pct: number | null;
  threeShare: number | null;
  efgPct: number | null;
  pointsPerShot: number | null;
}

const ratio = (a: number, b: number) => (b ? a / b : null);

export function shootingLine(shots: ShotData[]): ShootingLine {
  let made = 0, threes = 0, threesMade = 0, points = 0;
  for (const shot of shots) {
    const isMade = shot.shotResult === 'Made';
    if (isMade) {
      made++;
      points += shot.shotValue;
    }
    if (shot.shotValue === 3) {
      threes++;
      if (isMade) threesMade++;
    }
  }
  const n = shots.length;
  return {
    shots: n,
    made,
    threes,
    threesMade,
    fgPct: ratio(made, n),
    fg3Pct: ratio(threesMade, threes),
    threeShare: ratio(threes, n),
    efgPct: ratio(made + 0.5 * threesMade, n),
    pointsPerShot: ratio(points, n),
  };
}

// Court zones; the same rules as zone_of() in scripts/build_data.py, so league
// averages per zone (seasons.json) line up. Coordinates: tenths of a foot from the hoop.
export const ZONES = [
  'Restricted area',
  'In the paint',
  'Mid-range',
  'Left corner 3',
  'Right corner 3',
  'Above the break 3',
] as const;

export function zoneOf(x: number, y: number, value: number): number {
  if (value === 3) {
    if (y <= 90 && x <= -220) return 3;
    if (y <= 90 && x >= 220) return 4;
    return 5;
  }
  if (Math.hypot(x, y) <= 40) return 0;
  if (Math.abs(x) < 80 && y < 137.5) return 1;
  return 2;
}

export interface ZoneRow {
  zone: string;
  shots: number;
  made: number;
  share: number;
  fgPct: number | null;
  leagueFgPct: number | null;
  leagueShare: number | null;
}

export function zoneTable(shots: ShotData[], league?: LeagueSeason): ZoneRow[] {
  const counts = ZONES.map(() => [0, 0]);
  for (const s of shots) {
    const c = counts[zoneOf(s.xLegacy, s.yLegacy, s.shotValue)];
    c[0]++;
    if (s.shotResult === 'Made') c[1]++;
  }
  const leagueTotal = league ? league.zones.reduce((a, z) => a + z[0], 0) : 0;
  return ZONES.map((zone, i) => {
    const [n, m] = counts[i];
    const lz = league?.zones[i];
    return {
      zone,
      shots: n,
      made: m,
      share: shots.length ? n / shots.length : 0,
      fgPct: ratio(m, n),
      leagueFgPct: lz ? ratio(lz[1], lz[0]) : null,
      leagueShare: lz && leagueTotal ? lz[0] / leagueTotal : null,
    };
  });
}

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? '–' : `${(v * 100).toFixed(digits)}%`;

/** Difference of two fractions in percentage points, signed: "+4.1" / "−0.3". */
export function ppDiff(a: number | null | undefined, b: number | null | undefined, digits = 1): string {
  if (a == null || b == null) return '–';
  const d = (a - b) * 100;
  const s = Math.abs(d).toFixed(digits);
  if (Number(s) === 0) return `±${s}`;
  return `${d > 0 ? '+' : '−'}${s}`;
}

/** 'Stephen Curry' -> 'Curry'; team names stay whole. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  // Keep suffixes with the surname: 'Jaren Jackson Jr.' -> 'Jackson Jr.'
  if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(last) && parts.length > 2) return `${parts[parts.length - 2]} ${last}`;
  return last;
}
