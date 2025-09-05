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
  id: string;
  name: string;
  team: string;
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

      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name');

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
        id: row.id,
        name: row.name,
        team: row.team || '',
      }));

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

      let query = supabase
        .from('shots')
        .select('*')
        .eq('season', season);

      // Apply filters based on view mode
      if (viewMode === 'player' && entityId) {
        query = query.eq('person_id', entityId);
      } else if (viewMode === 'team' && entityId) {
        query = query.eq('team_tricode', entityId);
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
        personId: row.person_id,
        teamTricode: row.team_tricode,
        xLegacy: parseFloat(row.x_legacy.toString()),
        yLegacy: parseFloat(row.y_legacy.toString()),
        shotResult: row.shot_result,
        shotDistance: parseFloat(row.shot_distance.toString()),
        description: row.description || '',
        subType: row.sub_type || '',
        shotValue: row.shot_value,
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

      let query = supabase
        .from('shots')
        .select('team_tricode');

      if (season) {
        query = query.eq('season', season);
      }

      const { data, error } = await query;

      if (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw new Error(`Failed to fetch teams: ${error.message}`);
      }

      const uniqueTeams = [...new Set(data.map(row => row.team_tricode))].sort();

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

      const { data, error } = await supabase
        .from('shots')
        .select('season');

      if (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw new Error(`Failed to fetch seasons: ${error.message}`);
      }

      const uniqueSeasons = [...new Set(data.map(row => row.season))].sort();

      span.setAttributes({
        season_count: uniqueSeasons.length,
      });

      return uniqueSeasons;
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