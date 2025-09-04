import { useState, useEffect } from 'react';
import { NBAApiService } from '@/services/nbaApi';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

interface PlayerNameMap {
  [playerId: string]: string;
}

// Metrics for usePlayerNames hook
const playerNamesHookCounter = meter.createCounter('use_player_names_hook_usage_total', {
  description: 'Total number of usePlayerNames hook invocations',
});

const playerNamesFetchDuration = meter.createHistogram('use_player_names_fetch_duration_ms', {
  description: 'Duration of player names fetching operations',
});

export function usePlayerNames(playerIds: string[]) {
  const [playerNames, setPlayerNames] = useState<PlayerNameMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const span = tracer.startSpan('use_player_names.fetch_player_names', {
      attributes: {
        'hook.operation': 'fetch_player_names',
        'hook.player_count': playerIds.length,
      },
    });

    const startTime = Date.now();

    try {
      playerNamesHookCounter.add(1, {
        player_count: playerIds.length.toString(),
      });

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: 'usePlayerNames hook invoked',
        attributes: {
          player_count: playerIds.length,
          player_ids: playerIds.slice(0, 5), // Log first 5 IDs
        },
      });

      if (playerIds.length === 0) {
        setPlayerNames({});
        span.setAttributes({
          'hook.early_return': true,
          'hook.reason': 'no_player_ids',
        });
        return;
      }

      const fetchPlayerNames = async () => {
        setLoading(true);
        setError(null);

        try {
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'Fetching player names',
            attributes: {
              player_count: playerIds.length,
            },
          });

          const playerInfoMap = await NBAApiService.getMultiplePlayerInfo(playerIds);

          const nameMap: PlayerNameMap = {};
          playerInfoMap.forEach((info, playerId) => {
            nameMap[playerId] = info.displayName;
          });

          span.setAttributes({
            'hook.successful_fetches': playerInfoMap.size,
            'hook.success_rate': playerInfoMap.size / playerIds.length,
          });

          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'Successfully fetched player names',
            attributes: {
              requested_count: playerIds.length,
              successful_count: playerInfoMap.size,
              success_rate: playerInfoMap.size / playerIds.length,
            },
          });

          setPlayerNames(nameMap);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to fetch player names';

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });

          logger.emit({
            severityNumber: SeverityNumber.ERROR,
            severityText: 'ERROR',
            body: 'Error fetching player names',
            attributes: {
              error: errorMessage,
              player_count: playerIds.length,
            },
          });

          setError(errorMessage);
          console.error('Error fetching player names:', err);
        } finally {
          setLoading(false);

          const duration = Date.now() - startTime;
          playerNamesFetchDuration.record(duration, {
            player_count: playerIds.length.toString(),
          });

          span.setAttributes({
            'hook.fetch_duration_ms': duration,
          });
        }
      };

      fetchPlayerNames();
    } catch (outerError) {
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Error in usePlayerNames hook setup',
        attributes: {
          error: (outerError as Error).message,
        },
      });
    } finally {
      span.end();
    }
  }, [playerIds.join(',')]); // Use join to create a stable dependency

  return {
    playerNames,
    loading,
    error,
    getPlayerName: (playerId: string) => playerNames[playerId] || `Player ${playerId}`
  };
}