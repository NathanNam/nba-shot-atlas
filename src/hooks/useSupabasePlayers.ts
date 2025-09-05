import { useState, useEffect } from 'react';
import { SupabaseDataService, Player } from '@/services/supabaseDataService';
import { tracer, logger } from '../otel-client';
import { SeverityNumber } from '@opentelemetry/api-logs';

export function useSupabasePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPlayers = async () => {
      const span = tracer.startSpan('use_supabase_players.load');

      try {
        setLoading(true);
        setError(null);

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Loading players from Supabase',
        });

        const data = await SupabaseDataService.getPlayers();
        
        setPlayers(data);

        span.setAttributes({
          success: true,
          player_count: data.length,
        });

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Successfully loaded players from Supabase',
          attributes: {
            player_count: data.length,
          },
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load players';
        
        setError(errorMessage);
        setPlayers([]);

        span.setAttributes({
          success: false,
          error: errorMessage,
        });

        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'Error loading players from Supabase',
          attributes: {
            error: errorMessage,
          },
        });

      } finally {
        setLoading(false);
        span.end();
      }
    };

    loadPlayers();
  }, []);

  return { players, loading, error };
}