import { useState, useEffect } from 'react';
import { SupabaseDataService, ShotData } from '@/services/supabaseDataService';
import { dataCache } from '@/services/dataCache';
import { tracer, logger } from '../otel-client';
import { SeverityNumber } from '@opentelemetry/api-logs';

export function useSupabaseShotData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league', sampleSize?: number) {
  const [shotData, setShotData] = useState<ShotData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadShotData = async () => {
      // Add detailed logging to track what entityId is being passed
      console.log(`🔍 useSupabaseShotData: Called with season="${season}", entityId="${entityId}", viewMode="${viewMode}"`);
      
      if (!entityId && viewMode !== 'league') {
        console.log(`🔍 useSupabaseShotData: No entityId provided for ${viewMode} mode, skipping data fetch`);
        setShotData([]);
        return;
      }

      // Check cache first for immediate response
      const cachedData = dataCache.get(season, entityId, viewMode);
      if (cachedData) {
        console.log(`🚀 useSupabaseShotData: Using cached data for ${season}_${viewMode}_${entityId}`);
        setShotData(cachedData);
        setLoading(false);
        setError(null);
        return;
      }

      const span = tracer.startSpan('use_supabase_shot_data.load', {
        attributes: {
          season,
          entity_id: entityId,
          view_mode: viewMode,
        },
      });

      try {
        setLoading(true);
        setError(null);

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Loading shot data from Supabase',
          attributes: {
            season,
            entity_id: entityId,
            view_mode: viewMode,
          },
        });

        const data = await SupabaseDataService.getShotData(season, entityId, viewMode, sampleSize);
        
        setShotData(data);

        span.setAttributes({
          success: true,
          result_count: data.length,
        });

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Successfully loaded shot data from Supabase',
          attributes: {
            season,
            entity_id: entityId,
            view_mode: viewMode,
            result_count: data.length,
          },
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load shot data';
        
        setError(errorMessage);
        setShotData([]);

        span.setAttributes({
          success: false,
          error: errorMessage,
        });

        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'Error loading shot data from Supabase',
          attributes: {
            season,
            entity_id: entityId,
            view_mode: viewMode,
            error: errorMessage,
          },
        });

      } finally {
        setLoading(false);
        span.end();
      }
    };

    loadShotData();
  }, [season, entityId, viewMode, sampleSize]);

  return { shotData, loading, error };
}