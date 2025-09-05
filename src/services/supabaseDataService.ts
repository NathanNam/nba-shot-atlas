import { supabase } from '@/integrations/supabase/client';
import { SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { dataCache } from './dataCache';

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
      console.log(`🔍 SupabaseDataService: Starting fresh fetch for ${season}_${viewMode}_${entityId || 'all'}`);
      
      // FORCE CLEAR ALL CACHE LAYERS FOR TESTING
      if (viewMode === 'league') {
        console.log(`🔍 SupabaseDataService: FORCE clearing dataCache for league mode`);
        dataCache.clear();
        dataCache.clearPreloaded();
      }
      
      span.setAttributes({ cache_hit: false });

      dbQueryCounter.add(1, { table: 'shots', operation: 'select' });

      // Determine the correct table name based on season
      const tableName = `shots_${season}`;
      
      // Get total count for league mode to show progress
      let estimatedTotal = undefined;
      if (viewMode === 'league' && progressCallback) {
        try {
          const { count } = await (supabase as any)
            .from(tableName)
            .select('*', { count: 'estimated', head: true });
          estimatedTotal = count;
          console.log(`🔍 SupabaseDataService: League mode - estimated ${estimatedTotal} total shots`);
        } catch (error) {
          console.log('Could not get count estimate:', error);
        }
      }

      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;
      
      // Supabase/PostgREST has a 1000 row default limit, so we must use proper pagination
      const batchSize = 1000; // Use PostgREST's default limit as batch size
      let batchCount = 0;

      console.log(`🔍 SupabaseDataService: Using proper pagination with ${batchSize} rows per batch due to PostgREST limit`);

      while (hasMore) {
        console.log(`🔍 SupabaseDataService: Fetching batch ${batchCount + 1}, offset: ${offset}`);
        
        // Create a new query for each batch to avoid query builder issues
        let batchQuery = (supabase as any)
          .from(tableName)
          .select('*')
          .range(offset, offset + batchSize - 1);

        // Re-apply filters for each batch
        if (viewMode === 'player' && entityId) {
          console.log(`🔍 SupabaseDataService: Filtering by personId=${entityId} for player mode`);
          const numericEntityId = parseInt(entityId);
          if (isNaN(numericEntityId)) {
            throw new Error(`Invalid player ID: "${entityId}" is not numeric. Player names should be converted to IDs before calling this method.`);
          }
          batchQuery = batchQuery.eq('personId', numericEntityId);
        } else if (viewMode === 'team' && entityId) {
          console.log(`🔍 SupabaseDataService: Filtering by teamTricode=${entityId} for team mode`);
          batchQuery = batchQuery.eq('teamTricode', entityId);
        }
        
        const { data: batchData, error: batchError } = await batchQuery;
        
        if (batchError) throw new Error(`Failed to fetch shot data: ${batchError.message}`);
        
        if (batchData && batchData.length > 0) {
          allData = allData.concat(batchData);
          offset += batchSize;
          batchCount++;
          
          console.log(`🔍 SupabaseDataService: Batch ${batchCount} returned ${batchData.length} records. Total so far: ${allData.length}`);
          console.log(`🔍 SupabaseDataService: hasMore check: ${batchData.length} === ${batchSize} = ${batchData.length === batchSize}`);
          
          hasMore = batchData.length === batchSize; // Continue if we got a full batch
          
          // Report progress for league mode
          if (viewMode === 'league' && progressCallback) {
            progressCallback(allData.length, estimatedTotal);
            console.log(`🔍 SupabaseDataService: League progress - loaded ${allData.length} shots (batch ${batchCount}, batch returned: ${batchData.length})`);
          }
          
          // Add safety check for league mode to prevent infinite loops but allow large datasets
          if (viewMode === 'league' && allData.length > 2000000) { // 2M shots safety limit
            console.warn(`🔍 SupabaseDataService: Reached safety limit of 2M shots, stopping`);
            hasMore = false;
          }
        } else {
          console.log(`🔍 SupabaseDataService: No more data, stopping at ${allData.length} shots`);
          hasMore = false;
        }
      }

      console.log(`🔍 SupabaseDataService: Fetched ${allData.length} total rows using pagination`);

      const data = allData;
      if (!data) {
        throw new Error('No data returned from Supabase');
      }

      const shots: ShotData[] = data.map(row => ({
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

      span.setAttributes({ success: true, shots_count: shots.length });

      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'shots', operation: 'select' });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Successfully loaded shot data',
        attributes: { season, entity_id: entityId || 'all', view_mode: viewMode, shots_count: shots.length },
      });

      return shots;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load shot data';
      
      span.setAttributes({ success: false, error: errorMessage });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Error loading shot data',
        attributes: { season, entity_id: entityId || 'all', view_mode: viewMode, error: errorMessage },
      });

      throw err;
    } finally {
      span.end();
    }
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