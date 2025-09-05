import { useState, useEffect } from 'react';
import { SupabaseDataService, ShotData } from '@/services/supabaseDataService';
import { tracer, logger } from '../otel-client';
import { SeverityNumber } from '@opentelemetry/api-logs';

export function useSupabaseShotData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const [shotData, setShotData] = useState<ShotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total?: number; isProcessing?: boolean } | null>(null);

  // Generate unique instance ID for debugging
  const instanceId = `${viewMode}_${entityId}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`🚀 useSupabaseShotData HOOK [${instanceId}]: Called with season="${season}", entityId="${entityId}", viewMode="${viewMode}"`);

  useEffect(() => {
    const loadShotData = async () => {
      console.log(`🔍 useSupabaseShotData [${instanceId}]: Starting fresh fetch for season="${season}", entityId="${entityId}", viewMode="${viewMode}"`);
      
      if (!entityId && viewMode !== 'league') {
        console.log(`🔍 useSupabaseShotData [${instanceId}]: No entityId provided for ${viewMode} mode, skipping data fetch`);
        setShotData([]);
        setLoading(false);
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
        console.log(`🚀 useSupabaseShotData [${instanceId}]: Starting fresh fetch`);
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

        const progressCallback = viewMode === 'league' ? 
          (loaded: number, total?: number) => {
            setProgress({ 
              loaded, 
              total, 
              isProcessing: total ? loaded >= total * 0.8 : false // Mark as processing when near completion
            });
          } : undefined;
        
        const data = await SupabaseDataService.getShotData(season, entityId, viewMode, progressCallback);
        
        console.log(`🚀 useSupabaseShotData [${instanceId}]: Fresh data loaded, length: ${data.length}`);
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
        setProgress(null);
        setLoading(false);
        span.end();
      }
    };

    loadShotData();
  }, [season, entityId, viewMode]);

  return { shotData, loading, error, progress };
}