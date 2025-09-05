import { supabase } from "@/integrations/supabase/client";
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

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
  private static shotCache = new Map<string, ShotData[]>();

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

      const { data, error } = await (supabase as any)
        .from('players')
        .select('*')
        .order('"playerFullName"');

      console.log('🔍 SupabaseDataService.getPlayers: Raw response data:', data);
      console.log('🔍 SupabaseDataService.getPlayers: Raw response error:', error);

      if (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'Error fetching players from Supabase',
          attributes: { error: error.message },
        });
        throw new Error(`Failed to fetch players: ${error.message}`);
      }

      const players: Player[] = data.map(row => ({
        personId: row.personId?.toString() || '',
        playerFullName: row.playerFullName || '',
      })).filter(player => player.personId && player.playerFullName);

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

  static async getShotData(season: string, entityId?: string, viewMode: 'player' | 'team' | 'league' = 'league'): Promise<ShotData[]> {
    const span = tracer.startSpan('supabase.get_shot_data', {
      attributes: {
        season,
        entity_id: entityId || 'none',
        view_mode: viewMode,
      },
    });
    const startTime = Date.now();

    try {
      const cacheKey = `${season}_${viewMode}_${entityId || 'all'}`;
      
      // Check cache first
      if (this.shotCache.has(cacheKey)) {
        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: 'Shot data cache hit',
          attributes: { cache_key: cacheKey },
        });
        span.setAttributes({ cache_hit: true });
        return this.shotCache.get(cacheKey)!;
      }

      dbQueryCounter.add(1, { table: 'shots', operation: 'select' });

      // Determine the correct table name based on season
      const tableName = `shots_${season}`;
      
      let query = (supabase as any)
        .from(tableName)
        .select('*');

      // Apply filters based on view mode - using new column names
      if (viewMode === 'player' && entityId) {
        query = query.eq('personId', entityId);
      } else if (viewMode === 'team' && entityId) {
        query = query.eq('teamTricode', entityId);
      }
      // For league mode, no additional filter needed

      const { data, error } = await query;

      if (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'Error fetching shot data from Supabase',
          attributes: { 
            error: error.message,
            season,
            view_mode: viewMode,
            entity_id: entityId || 'none',
          },
        });
        throw new Error(`Failed to fetch shot data: ${error.message}`);
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

      // Cache the result
      this.shotCache.set(cacheKey, shots);

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
    this.shotCache.clear();
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Cleared Supabase data cache',
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