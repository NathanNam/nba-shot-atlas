import { loadSeason } from './staticData';

export interface LeagueStats {
  totalShots: number;
  madeShots: number;
  fieldGoalPercentage: number;
  twoPointMade: number;
  twoPointAttempted: number;
  twoPointPercentage: number;
  threePointMade: number;
  threePointAttempted: number;
  threePointPercentage: number;
  hottestZone: string;
  coldestZone: string;
  favoriteSpot: string;
}

// Same zones as the former get-league-stats edge function.
function zoneOf(x: number, y: number): string {
  const distance = Math.sqrt(x * x + y * y);
  if (distance <= 40) return 'Restricted Area';
  if (distance <= 80) return 'Paint';
  if (distance <= 140) return 'Mid Range';
  if (y > 140) {
    if (x < -80) return 'Left Corner 3';
    if (x > 80) return 'Right Corner 3';
    return 'Above the Break 3';
  }
  return 'Long 2';
}

const cache = new Map<string, Promise<LeagueStats>>();

export class LeagueStatsService {
  /**
   * League statistics computed in the browser from the season's static shot file.
   */
  static getLeagueStats(season: string): Promise<LeagueStats> {
    let stats = cache.get(season);
    if (!stats) {
      stats = this.compute(season).catch(error => {
        console.error('Error computing league stats:', error);
        cache.delete(season);
        return this.getFallbackStats();
      });
      cache.set(season, stats);
    }
    return stats;
  }

  private static async compute(season: string): Promise<LeagueStats> {
    const shots = await loadSeason(season);
    let made = 0, twoMade = 0, twoAtt = 0, threeMade = 0, threeAtt = 0;
    const zones = new Map<string, { made: number; total: number }>();

    for (const shot of shots) {
      const isMade = shot.shotResult === 'Made';
      if (isMade) made++;
      if (shot.shotValue === 3) {
        threeAtt++;
        if (isMade) threeMade++;
      } else {
        twoAtt++;
        if (isMade) twoMade++;
      }
      const zone = zoneOf(shot.xLegacy, shot.yLegacy);
      const z = zones.get(zone) ?? { made: 0, total: 0 };
      z.total++;
      if (isMade) z.made++;
      zones.set(zone, z);
    }

    const ranked = [...zones.entries()]
      .filter(([, z]) => z.total >= 100)
      .map(([zone, z]) => ({ zone, pct: z.made / z.total }))
      .sort((a, b) => b.pct - a.pct);
    const hottest = ranked[0];
    const coldest = ranked[ranked.length - 1];
    const favorite = [...zones.entries()].sort((a, b) => b[1].total - a[1].total)[0];

    const total = shots.length;
    return {
      totalShots: total,
      madeShots: made,
      fieldGoalPercentage: total ? made / total : 0,
      twoPointMade: twoMade,
      twoPointAttempted: twoAtt,
      twoPointPercentage: twoAtt ? twoMade / twoAtt : 0,
      threePointMade: threeMade,
      threePointAttempted: threeAtt,
      threePointPercentage: threeAtt ? threeMade / threeAtt : 0,
      hottestZone: hottest ? `${hottest.zone} (${(hottest.pct * 100).toFixed(1)}%)` : 'N/A',
      coldestZone: coldest ? `${coldest.zone} (${(coldest.pct * 100).toFixed(1)}%)` : 'N/A',
      favoriteSpot: favorite ? `${favorite[0]} (${favorite[1].total} shots)` : 'N/A',
    };
  }

  private static getFallbackStats(): LeagueStats {
    return {
      totalShots: 0,
      madeShots: 0,
      fieldGoalPercentage: 0,
      twoPointMade: 0,
      twoPointAttempted: 0,
      twoPointPercentage: 0,
      threePointMade: 0,
      threePointAttempted: 0,
      threePointPercentage: 0,
      hottestZone: 'No data',
      coldestZone: 'No data',
      favoriteSpot: 'No data',
    };
  }
}
