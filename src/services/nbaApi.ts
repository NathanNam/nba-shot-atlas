// NBA.com API service for fetching player information
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

interface PlayerInfo {
  playerId: string;
  displayName: string;
}

interface NBAApiResponse {
  resultSets: Array<{
    name: string;
    headers: string[];
    rowSet: any[][];
  }>;
}

export class NBAApiService {
  private static cache = new Map<string, PlayerInfo>();
  private static readonly BASE_URL = 'https://stats.nba.com/stats';

  // Metrics
  private static readonly apiRequestCounter = meter.createCounter('nba_api_requests_total', {
    description: 'Total number of NBA API requests',
  });

  private static readonly apiRequestDuration = meter.createHistogram('nba_api_request_duration_ms', {
    description: 'Duration of NBA API requests in milliseconds',
  });

  private static readonly cacheHitCounter = meter.createCounter('nba_api_cache_hits_total', {
    description: 'Total number of cache hits',
  });

  private static readonly cacheSize = meter.createUpDownCounter('nba_api_cache_size', {
    description: 'Current size of the player info cache',
  });
  
  // Headers required by NBA.com API
  private static readonly HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Host': 'stats.nba.com',
    'Origin': 'https://www.nba.com',
    'Referer': 'https://www.nba.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true'
  };

  static async getPlayerInfo(playerId: string): Promise<PlayerInfo | null> {
    const span = tracer.startSpan('nba_api.get_player_info', {
      attributes: {
        'nba.player_id': playerId,
        'nba.operation': 'get_player_info',
      },
    });

    const startTime = Date.now();

    try {
      // Check cache first
      if (this.cache.has(playerId)) {
        this.cacheHitCounter.add(1, { player_id: playerId });

        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: 'Player info cache hit',
          attributes: {
            player_id: playerId,
            cache_size: this.cache.size,
          },
        });

        span.setAttributes({
          'nba.cache_hit': true,
          'nba.cache_size': this.cache.size,
        });

        return this.cache.get(playerId)!;
      }

      span.setAttributes({
        'nba.cache_hit': false,
      });

      const url = `${this.BASE_URL}/commonplayerinfo?PlayerID=${playerId}`;

      this.apiRequestCounter.add(1, {
        player_id: playerId,
        endpoint: 'commonplayerinfo',
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Making NBA API request',
        attributes: {
          player_id: playerId,
          url: url,
          method: 'GET',
        },
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: this.HEADERS,
        mode: 'cors'
      });

      span.setAttributes({
        'http.status_code': response.status,
        'http.url': url,
        'http.method': 'GET',
      });

      if (!response.ok) {
        const errorMessage = `Failed to fetch player info for ID ${playerId}: ${response.status}`;

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: errorMessage,
          attributes: {
            player_id: playerId,
            http_status: response.status,
            url: url,
          },
        });

        console.warn(errorMessage);
        return null;
      }

      const data: NBAApiResponse = await response.json();

      span.setAttributes({
        'nba.response_result_sets': data.resultSets.length,
      });

      // Find the CommonPlayerInfo result set
      const playerInfoSet = data.resultSets.find(rs => rs.name === 'CommonPlayerInfo');
      if (!playerInfoSet || playerInfoSet.rowSet.length === 0) {
        const errorMessage = `No player info found for ID ${playerId}`;

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: errorMessage,
          attributes: {
            player_id: playerId,
            result_sets_count: data.resultSets.length,
          },
        });

        console.warn(errorMessage);
        return null;
      }

      // Extract player name from the first row
      const headers = playerInfoSet.headers;
      const row = playerInfoSet.rowSet[0];

      const displayNameIndex = headers.indexOf('DISPLAY_FIRST_LAST');
      if (displayNameIndex === -1) {
        const errorMessage = `DISPLAY_FIRST_LAST not found in response for player ID ${playerId}`;

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: errorMessage,
          attributes: {
            player_id: playerId,
            available_headers: headers,
          },
        });

        console.warn(errorMessage);
        return null;
      }

      const displayName = row[displayNameIndex];
      if (!displayName) {
        const errorMessage = `Empty display name for player ID ${playerId}`;

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: errorMessage,
        });

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: errorMessage,
          attributes: {
            player_id: playerId,
          },
        });

        console.warn(errorMessage);
        return null;
      }

      const playerInfo: PlayerInfo = {
        playerId,
        displayName
      };

      // Cache the result
      this.cache.set(playerId, playerInfo);
      this.cacheSize.add(1);

      span.setAttributes({
        'nba.player_name': displayName,
        'nba.cache_size_after': this.cache.size,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Successfully fetched and cached player info',
        attributes: {
          player_id: playerId,
          player_name: displayName,
          cache_size: this.cache.size,
        },
      });

      return playerInfo;
    } catch (error) {
      const errorMessage = `Error fetching player info for ID ${playerId}`;

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errorMessage,
      });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: errorMessage,
        attributes: {
          player_id: playerId,
          error: (error as Error).message,
        },
      });

      console.error(`${errorMessage}:`, error);
      return null;
    } finally {
      const duration = Date.now() - startTime;
      this.apiRequestDuration.record(duration, {
        player_id: playerId,
        endpoint: 'commonplayerinfo',
      });

      span.setAttributes({
        'nba.request_duration_ms': duration,
      });

      span.end();
    }
  }

  static async getMultiplePlayerInfo(playerIds: string[]): Promise<Map<string, PlayerInfo>> {
    const span = tracer.startSpan('nba_api.get_multiple_player_info', {
      attributes: {
        'nba.operation': 'get_multiple_player_info',
        'nba.player_count': playerIds.length,
      },
    });

    const startTime = Date.now();
    const results = new Map<string, PlayerInfo>();

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Starting batch player info fetch',
      attributes: {
        player_count: playerIds.length,
        player_ids: playerIds.slice(0, 10), // Log first 10 IDs for debugging
      },
    });

    try {
      // Process in batches to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(playerIds.length / batchSize);

        span.addEvent('processing_batch', {
          batch_number: batchNumber,
          total_batches: totalBatches,
          batch_size: batch.length,
        });
      
        const promises = batch.map(async (playerId) => {
          const info = await this.getPlayerInfo(playerId);
          if (info) {
            results.set(playerId, info);
          }

          // Add delay between requests to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 100));
        });

        await Promise.allSettled(promises);

        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: 'Completed batch processing',
          attributes: {
            batch_number: batchNumber,
            total_batches: totalBatches,
            results_so_far: results.size,
          },
        });

        // Add delay between batches
        if (i + batchSize < playerIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      span.setAttributes({
        'nba.successful_fetches': results.size,
        'nba.success_rate': results.size / playerIds.length,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Completed batch player info fetch',
        attributes: {
          requested_count: playerIds.length,
          successful_count: results.size,
          success_rate: results.size / playerIds.length,
        },
      });

      return results;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Error in batch player info fetch',
      });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Error in batch player info fetch',
        attributes: {
          error: (error as Error).message,
          player_count: playerIds.length,
        },
      });

      throw error;
    } finally {
      const duration = Date.now() - startTime;
      span.setAttributes({
        'nba.batch_duration_ms': duration,
      });

      span.end();
    }
  }

  static clearCache(): void {
    const span = tracer.startSpan('nba_api.clear_cache', {
      attributes: {
        'nba.operation': 'clear_cache',
        'nba.cache_size_before': this.cache.size,
      },
    });

    try {
      const sizeBefore = this.cache.size;
      this.cache.clear();
      this.cacheSize.add(-sizeBefore); // Decrease counter by the previous size

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'NBA API cache cleared',
        attributes: {
          cache_size_before: sizeBefore,
          cache_size_after: this.cache.size,
        },
      });

      span.setAttributes({
        'nba.cache_size_after': this.cache.size,
        'nba.items_cleared': sizeBefore,
      });
    } finally {
      span.end();
    }
  }
}