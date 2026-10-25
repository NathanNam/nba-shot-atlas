// Data access for the app. Despite the name (kept so existing imports work),
// everything now comes from the static files in public/data/ (see staticData.ts).
import { dataCache } from './dataCache';
import { LeagueStatsService } from './leagueStatsService';
import { getShots, loadPlayers, loadSeason, loadSeasonIndex } from './staticData';

export interface ShotData {
  personId: string;
  teamTricode: string;
  xLegacy: number;
  yLegacy: number;
  shotDistance: number;
  shotResult: string;
  shotValue: number;
  description?: string;
  subType?: string;
}

export interface Player {
  personId: number;
  playerFullName: string;
  id: string;
  name: string;
  /** Season labels ('2025-26') in which the player took a shot. */
  seasons: string[];
}

class SupabaseDataService {
  private static playerCache: Player[] | null = null;

  static async getPlayers(): Promise<Player[]> {
    if (this.playerCache) return this.playerCache;
    const rows = await loadPlayers();
    this.playerCache = rows.map(([personId, name, years]) => ({
      personId,
      playerFullName: name,
      id: String(personId),
      name,
      seasons: years.map(y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`),
    }));
    return this.playerCache;
  }

  static async getShotData(
    season: string,
    entityId?: string,
    viewMode: 'player' | 'team' | 'league' = 'league',
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const cached = dataCache.get(season, entityId || '', viewMode);
    if (cached) return cached;

    const shots = await getShots(season, entityId, viewMode);
    progressCallback?.(shots.length, shots.length);
    dataCache.set(season, entityId || '', viewMode, shots);
    return shots;
  }

  static async getLeagueStatistics(season: string) {
    return LeagueStatsService.getLeagueStats(season);
  }

  static clearCache(): void {
    this.playerCache = null;
  }

  static async getTeams(season?: string): Promise<string[]> {
    const target = season ?? (await loadSeasonIndex()).default;
    const shots = await loadSeason(target);
    return [...new Set(shots.map(s => s.teamTricode))].sort();
  }

  /** Seasons available, newest first. */
  static async getSeasons(): Promise<string[]> {
    return (await loadSeasonIndex()).seasons;
  }
}

export { SupabaseDataService };
