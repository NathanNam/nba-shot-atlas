import { useState, useEffect } from 'react';
import { SupabaseDataService, ShotData } from '@/services/supabaseDataService';
import { dataCache } from '@/services/dataCache';
import { tracer, logger } from '../otel-client';
import { SeverityNumber } from '@opentelemetry/api-logs';

export function useSupabaseShotData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const [shotData, setShotData] = useState<ShotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total?: number } | null>(null);

  useEffect(() => {
    const loadShotData = async () => {
      // Add detailed logging to track what entityId is being passed
      console.log(`🔍 useSupabaseShotData: Called with season="${season}", entityId="${entityId}", viewMode="${viewMode}"`);
      
      if (!entityId && viewMode !== 'league') {
        console.log(`🔍 useSupabaseShotData: No entityId provided for ${viewMode} mode, skipping data fetch`);
        setShotData([]);
        return;
      }

      // For league mode, always force a fresh fetch to get full dataset (no sampling)
      if (viewMode === 'league') {
        console.log(`🚀 useSupabaseShotData: League mode - forcing fresh fetch for full dataset`);
        // Clear any existing league cache to prevent old sampled data
        dataCache.clear();
        dataCache.clearPreloaded();
      } else {
        // Check preloaded data first for instant loading of defaults (non-league only)
        const defaultKeys = {
          'player': entityId === '201939' && season === '2024-25' ? 'player_stephen_curry_2024-25' : null,
          'team': entityId === 'GSW' && season === '2024-25' ? 'team_gsw_2024-25' : null
        };
        
        const preloadedKey = defaultKeys[viewMode];
        if (preloadedKey) {
          const preloadedData = dataCache.getPreloaded(preloadedKey);
          if (preloadedData) {
            console.log(`🚀 useSupabaseShotData: Using preloaded data for ${preloadedKey}, length: ${preloadedData.data.length}`);
            setShotData(preloadedData.data);
            setLoading(false);
            setError(null);
            return;
          }
        }

        // Check cache for other data
        const cachedData = dataCache.get(season, entityId, viewMode);
        if (cachedData) {
          console.log(`🚀 useSupabaseShotData: Using cached data for ${season}_${viewMode}_${entityId}, length: ${cachedData.length}`);
          setShotData(cachedData);
          setLoading(false);
          setError(null);
          return;
        }
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

        const progressCallback = viewMode === 'league' ? 
          (loaded: number, total?: number) => setProgress({ loaded, total }) : undefined;
        
        const data = await SupabaseDataService.getShotData(season, entityId, viewMode, progressCallback);
        
        setShotData(data);
        setProgress(null); // Clear progress when complete

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
        span.end();
      }
    };

    loadShotData();
  }, [season, entityId, viewMode]);

  return { shotData, loading, error, progress };
}