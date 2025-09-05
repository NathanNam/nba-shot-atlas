import { supabase } from '@/integrations/supabase/client';
import { SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { dataCache } from './dataCache';
import { ParallelDataService } from './parallelDataService';
import { LeagueStatsService } from './leagueStatsService';

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
}

// Metrics
const dbQueryCounter = meter.createCounter('supabase_queries_total', {
  description: 'Total number of Supabase queries executed',
});

const dbQueryDuration = meter.createHistogram('supabase_query_duration_ms', {
  description: 'Duration of Supabase queries in milliseconds',
});

class SupabaseDataService {
  // Cache for player data
  private static playerCache: Player[] | null = null;

  static async getPlayers(): Promise<Player[]> {
    if (this.playerCache) {
      console.log('🔍 SupabaseDataService: Using cached player data');
      return this.playerCache;
    }

    const span = tracer.startSpan('supabase.get_players');
    const startTime = Date.now();

    try {
      dbQueryCounter.add(1, { table: 'players', operation: 'select' });

      const { data, error } = await supabase
        .from('players')
        .select('*');

      if (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw new Error(`Failed to fetch players: ${error.message}`);
      }

      const players: Player[] = (data || []).map(player => ({
        personId: player.personId || 0,
        playerFullName: player.playerFullName || '',
        id: (player.personId || 0).toString(),
        name: player.playerFullName || ''
      }));

      this.playerCache = players;
      span.setAttributes({ success: true, player_count: players.length });

      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'players', operation: 'select' });

      console.log(`🔍 SupabaseDataService: Fetched ${players.length} players`);
      return players;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      throw err;
    } finally {
      span.end();
    }
  }

  static async getShotData(season: string, entityId?: string, viewMode: 'player' | 'team' | 'league' = 'league', progressCallback?: (loaded: number, total?: number) => void): Promise<ShotData[]> {
    const span = tracer.startSpan('supabase.get_shot_data', {
      attributes: {
        season,
        entity_id: entityId || 'none',
        view_mode: viewMode,
      },
    });
    const startTime = Date.now();

    try {
      console.log(`🔍 SupabaseDataService: Starting optimized fetch for ${season}_${viewMode}_${entityId || 'all'}`);
      
      // FORCE CLEAR ALL CACHE LAYERS FOR TESTING
      if (viewMode === 'league') {
        console.log(`🔍 SupabaseDataService: FORCE clearing dataCache for league mode`);
        dataCache.clear();
        dataCache.clearPreloaded();
      }
      
      span.setAttributes({ cache_hit: false });
      dbQueryCounter.add(1, { table: 'shots', operation: 'select' });

      // Use optimized parallel fetching for better performance
      const shots = await ParallelDataService.getDataParallel(
        season, 
        entityId, 
        viewMode, 
        progressCallback
      );

      span.setAttributes({ success: true, shots_count: shots.length });

      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'shots', operation: 'select' });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Successfully loaded shot data with optimized approach',
        attributes: { season, entity_id: entityId || 'all', view_mode: viewMode, shots_count: shots.length },
      });

      return shots;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load shot data';
      
      span.setAttributes({ success: false, error: errorMessage });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Error loading shot data with optimized approach',
        attributes: { season, entity_id: entityId || 'all', view_mode: viewMode, error: errorMessage },
      });

      console.error('Error in optimized getShotData, falling back to original method:', err);
      
      // Fallback to original method if optimized approach fails
      return this.getShotDataOriginal(season, entityId, viewMode, progressCallback);
    } finally {
      span.end();
    }
  }

  /**
   * Get league statistics efficiently using Edge Functions
   */
  static async getLeagueStatistics(season: string) {
    return LeagueStatsService.getLeagueStats(season);
  }

  /**
   * Original method as fallback
   */
  private static async getShotDataOriginal(season: string, entityId?: string, viewMode: 'player' | 'team' | 'league' = 'league', progressCallback?: (loaded: number, total?: number) => void): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    
    let allData: any[] = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;
    let batchCount = 0;

    console.log(`🔍 SupabaseDataService: Using fallback sequential pagination`);

    while (hasMore && batchCount < 10) { // Limit to 10 batches (10k records) for fallback
      let batchQuery = (supabase as any)
        .from(tableName)
        .select('*')
        .range(offset, offset + batchSize - 1);

      if (viewMode === 'player' && entityId) {
        const numericEntityId = parseInt(entityId);
        if (!isNaN(numericEntityId)) {
          batchQuery = batchQuery.eq('personId', numericEntityId);
        }
      } else if (viewMode === 'team' && entityId) {
        batchQuery = batchQuery.eq('teamTricode', entityId);
      }
      
      const { data: batchData, error: batchError } = await batchQuery;
      
      if (batchError) throw new Error(`Failed to fetch shot data: ${batchError.message}`);
      
      if (batchData && batchData.length > 0) {
        allData = allData.concat(batchData);
        offset += batchSize;
        batchCount++;
        hasMore = batchData.length === batchSize;
        
        if (progressCallback) {
          progressCallback(allData.length, undefined);
        }
      } else {
        hasMore = false;
      }
    }

    const shots: ShotData[] = allData.map(row => ({
      personId: row.personId?.toString() || '',
      teamTricode: row.teamTricode || '',
      xLegacy: parseFloat(row.xLegacy?.toString() || '0'),
      yLegacy: parseFloat(row.yLegacy?.toString() || '0'),
      shotDistance: parseFloat(row.shotDistance?.toString() || '0'),
      shotResult: row.shotResult || '',
      shotValue: parseInt(row.shotValue?.toString() || '2'),
      description: row.description || '',
      subType: row.subType || '',
    }));

    return shots;
  }

  static clearCache(): void {
    this.playerCache = null;
  }

  // Method to get unique teams from shots data
  static async getTeams(season?: string): Promise<string[]> {
    const span = tracer.startSpan('supabase.get_teams');
    const startTime = Date.now();

    try {
      dbQueryCounter.add(1, { table: 'shots', operation: 'select_distinct' });

      // Use the appropriate season table or default to 2024-25
      const tableName = season ? `shots_${season}` : 'shots_2024-25';
      
      const { data, error } = await (supabase as any)
        .from(tableName)
        .select('teamTricode');

      if (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw new Error(`Failed to fetch teams: ${error.message}`);
      }

      // Extract unique team tricodes
      const allTeamTriCodes = (data || [])
        .map((row: any) => row.teamTricode)
        .filter((code): code is string => Boolean(code) && typeof code === 'string');
      const teams = [...new Set(allTeamTriCodes)] as string[];
      
      span.setAttributes({ success: true, teams_count: teams.length });

      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'shots', operation: 'select_distinct' });

      console.log(`🔍 SupabaseDataService: Fetched ${teams.length} unique teams`);
      return teams;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      throw err;
    } finally {
      span.end();
    }
  }

  static async getSeasons(): Promise<string[]> {
    // Return hardcoded list of available seasons
    // This could be made dynamic by querying available shot tables
    return [
      '2013-14',
      '2014-15', 
      '2015-16',
      '2016-17',
      '2017-18',
      '2018-19',
      '2019-20',
      '2020-21',
      '2021-22',
      '2022-23',
      '2023-24',
      '2024-25'
    ];
  }
}

export { SupabaseDataService };