import { ShotData } from './supabaseDataService';
import { getShots } from './staticData';

export class ParallelDataService {
  /**
   * Shots for a player, a team or the whole league, from the season's static file.
   * The whole season arrives in one request, so progress is reported once at the end.
   */
  static async getDataParallel(
    season: string,
    entityId?: string,
    viewMode: 'player' | 'team' | 'league' = 'league',
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const shots = await getShots(season, entityId, viewMode);
    progressCallback?.(shots.length, shots.length);
    return shots;
  }
}
