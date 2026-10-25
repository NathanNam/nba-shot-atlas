import type { ShotData } from '@/services/supabaseDataService';

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
  const ratio = (a: number, b: number) => (b ? a / b : null);
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

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? '–' : `${(v * 100).toFixed(digits)}%`;
