import { supabase } from "@/integrations/supabase/client";
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { dataCache } from './dataCache';

export interface ShotData {
  personId: string;
  teamTricode: string;
  xLegacy: number;
  yLegacy: number;
  shotResult: string;
  shotDistance: number;
  description: string;
  subType: string;
  shotValue: number;
}

export interface Player {
  personId: string;
  playerFullName: string;
}

// Metrics
const dbQueryCounter = meter.createCounter('supabase_queries_total', {
  description: 'Total number of Supabase queries',
});

const dbQueryDuration = meter.createHistogram('supabase_query_duration_ms', {
  description: 'Duration of Supabase queries in milliseconds',
});

export class SupabaseDataService {
  private static playerCache = new Map<string, Player[]>();
  // Remove old shotCache to prevent conflicts with new cache system

  static async getPlayers(): Promise<Player[]> {
    const span = tracer.startSpan('supabase.get_players');
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = 'all_players';
      if (this.playerCache.has(cacheKey)) {
        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: 'Players cache hit',
        });
        span.setAttributes({ cache_hit: true });
        return this.playerCache.get(cacheKey)!;
      }

      dbQueryCounter.add(1, { table: 'players', operation: 'select' });

      // Use direct fetch since TypeScript types don't match our schema
      const response = await fetch(`https://icfqngdeohzzjvzcmawo.supabase.co/rest/v1/players`, {
        headers: {
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZnFuZ2Rlb2h6emp2emNtYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjY3NTgsImV4cCI6MjA3MjYwMjc1OH0.NQfIrtGzH60IwDJ0VJEq4XyLq36HHI2y9CyWZ9aLmNE',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZnFuZ2Rlb2h6emp2emNtYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjY3NTgsImV4cCI6MjA3MjYwMjc1OH0.NQfIrtGzH60IwDJ0VJEq4XyLq36HHI2y9CyWZ9aLmNE`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch players: ${response.status} ${response.statusText}`);
      }
      
      const rawData = await response.json();
      console.log('🔍 SupabaseDataService.getPlayers: Direct fetch data:', rawData);
      
      const players: Player[] = rawData.map((row: any) => ({
        personId: row.personId?.toString() || '',
        playerFullName: row.playerFullName || '',
      })).filter((player: Player) => player.personId && player.playerFullName);

      // Cache the result
      this.playerCache.set(cacheKey, players);

      span.setAttributes({
        cache_hit: false,
        player_count: players.length,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Successfully fetched players from Supabase',
        attributes: { player_count: players.length },
      });

      return players;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'players', operation: 'select' });
      span.setAttributes({ duration_ms: duration });
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
      
      let query = (supabase as any)
        .from(tableName)
        .select('*');

      // Apply filters based on view mode - using new column names
      if (viewMode === 'player' && entityId) {
        console.log(`🔍 SupabaseDataService: Filtering by personId=${entityId} for player mode`);
        // Ensure entityId is numeric for personId filter
        const numericEntityId = parseInt(entityId);
        if (isNaN(numericEntityId)) {
          throw new Error(`Invalid player ID: "${entityId}" is not numeric. Player names should be converted to IDs before calling this method.`);
        }
        query = query.eq('personId', numericEntityId);
      } else if (viewMode === 'team' && entityId) {
        console.log(`🔍 SupabaseDataService: Filtering by teamTricode=${entityId} for team mode`);
        query = query.eq('teamTricode', entityId);
      }
      // For league mode, no filter - load complete dataset with progress reporting
      
      // Override PostgREST's default 1000 row limit for league mode
      if (viewMode === 'league') {
        console.log(`🔍 SupabaseDataService: Setting headers to override PostgREST limit for league mode`);
        query = query.select('*', { 
          head: false, 
          count: 'exact',
        }).range(0, 500000); // Set a very high range to get all data
      }

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
      
      // For league mode, try to fetch all data directly with explicit range
      if (viewMode === 'league') {
        console.log(`🔍 SupabaseDataService: Attempting direct fetch of ALL league data with explicit range`);
        try {
          const { data: allLeagueData, error: allError, count } = await query;
          
          console.log(`🔍 SupabaseDataService: Direct fetch result - data length: ${allLeagueData?.length}, error:`, allError, 'count:', count);
          
          if (!allError && allLeagueData) {
            console.log(`🔍 SupabaseDataService: SUCCESS! Direct fetch returned ${allLeagueData.length} shots`);
            allData = allLeagueData;
            
            // Report progress
            if (progressCallback) {
              progressCallback(allData.length, allData.length);
            }
            
            // Skip pagination loop
            hasMore = false;
          } else {
            console.log(`🔍 SupabaseDataService: Direct fetch failed, error:`, allError);
            hasMore = true; // Fall back to pagination
          }
        } catch (err) {
          console.log(`🔍 SupabaseDataService: Direct fetch threw error:`, err);
          hasMore = true; // Fall back to pagination
        }
      }

      
      // Use batch processing for fallback if direct fetch doesn't work
      const batchSize = viewMode === 'league' ? 50000 : 1000;
      let batchCount = 0;

      while (hasMore) {
        console.log(`🔍 SupabaseDataService: Starting batch ${batchCount + 1}, offset: ${offset}, batchSize: ${batchSize}`);
        console.log(`🔍 SupabaseDataService: Range will be: ${offset} to ${offset + batchSize - 1}`);
        const batchQuery = query.range(offset, offset + batchSize - 1);
        
        // Log the actual query being executed
        console.log(`🔍 SupabaseDataService: Executing query for table: shots_${season}, viewMode: ${viewMode}, entityId: ${entityId || 'none'}`);
        
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
        shotResult: row.shotResult || '',
        shotDistance: parseFloat(row.shotDistance?.toString() || '0'),
        description: row.description || '',
        subType: row.subType || '',
        shotValue: row.shotValue || 0,
      }));

      // No caching - just return fresh data

      span.setAttributes({
        cache_hit: false,
        shot_count: shots.length,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Successfully fetched shot data from Supabase',
        attributes: { 
          season,
          view_mode: viewMode,
          entity_id: entityId || 'none',
          shot_count: shots.length,
        },
      });

      return shots;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'shots', operation: 'select' });
      span.setAttributes({ duration_ms: duration });
      span.end();
    }
  }

  static clearCache(): void {
    this.playerCache.clear();
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Cleared player cache',
    });
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

      const uniqueTeams = [...new Set(data.map((row: any) => row.teamTricode))].filter(Boolean).sort() as string[];

      span.setAttributes({
        team_count: uniqueTeams.length,
        season: season || 'all',
      });

      return uniqueTeams;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'shots', operation: 'select_distinct' });
      span.end();
    }
  }

  // Method to get available seasons
  static async getSeasons(): Promise<string[]> {
    const span = tracer.startSpan('supabase.get_seasons');
    const startTime = Date.now();

    try {
      dbQueryCounter.add(1, { table: 'shots', operation: 'select_distinct' });

      // Return the known seasons based on uploaded tables
      const availableSeasons = [
        '2013-14', '2014-15', '2015-16', '2016-17', '2017-18',
        '2018-19', '2019-20', '2020-21', '2021-22', '2022-23',
        '2023-24', '2024-25'
      ];

      span.setAttributes({
        season_count: availableSeasons.length,
      });

      return availableSeasons;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      dbQueryDuration.record(duration, { table: 'shots', operation: 'select_distinct' });
      span.end();
    }
  }
}