import { useState, useEffect, useRef } from 'react';
import { SupabaseDataService, ShotData } from '@/services/supabaseDataService';
import { tracer, logger } from '../otel-client';
import { SeverityNumber } from '@opentelemetry/api-logs';

// Singleton data manager to prevent duplicate fetches
class ShotDataManager {
  private static instance: ShotDataManager;
  private cache = new Map<string, {
    data: ShotData[];
    loading: boolean;
    error: string | null;
    subscribers: Set<(data: { shotData: ShotData[], loading: boolean, error: string | null }) => void>;
    fetchPromise?: Promise<ShotData[]>;
  }>();

  static getInstance(): ShotDataManager {
    if (!ShotDataManager.instance) {
      ShotDataManager.instance = new ShotDataManager();
    }
    return ShotDataManager.instance;
  }

  private getKey(season: string, entityId: string, viewMode: string): string {
    return `${season}_${entityId}_${viewMode}`;
  }

  subscribe(
    season: string, 
    entityId: string, 
    viewMode: 'player' | 'team' | 'league',
    callback: (data: { shotData: ShotData[], loading: boolean, error: string | null }) => void
  ) {
    const key = this.getKey(season, entityId, viewMode);
    
    if (!this.cache.has(key)) {
      this.cache.set(key, {
        data: [],
        loading: true,
        error: null,
        subscribers: new Set(),
      });
      
      // Start fetching data
      this.fetchData(key, season, entityId, viewMode);
    }

    const entry = this.cache.get(key)!;
    entry.subscribers.add(callback);

    // Immediately call back with current state
    callback({
      shotData: entry.data,
      loading: entry.loading,
      error: entry.error
    });

    // Return unsubscribe function
    return () => {
      const entry = this.cache.get(key);
      if (entry) {
        entry.subscribers.delete(callback);
      }
    };
  }

  private async fetchData(key: string, season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
    const entry = this.cache.get(key)!;
    
    // Prevent duplicate fetches
    if (entry.fetchPromise) {
      return entry.fetchPromise;
    }

    console.log(`🔐 ShotDataManager: Starting single fetch for ${key}`);

    const span = tracer.startSpan('singleton_shot_data.load', {
      attributes: { season, entity_id: entityId, view_mode: viewMode },
    });

    entry.fetchPromise = (async () => {
      try {
        if (!entityId && viewMode !== 'league') {
          console.log(`🔐 ShotDataManager: No entityId for ${viewMode}, skipping`);
          return [];
        }

        logger.emit({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Loading shot data via singleton manager',
          attributes: { season, entity_id: entityId, view_mode: viewMode },
        });

        const data = await SupabaseDataService.getShotData(season, entityId, viewMode);
        
        console.log(`🔐 ShotDataManager: Fetched ${data.length} shots for ${key}`);
        
        entry.data = data;
        entry.loading = false;
        entry.error = null;

        span.setAttributes({ success: true, result_count: data.length });

        // Notify all subscribers
        entry.subscribers.forEach(callback => {
          callback({
            shotData: data,
            loading: false,
            error: null
          });
        });

        return data;

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load shot data';
        
        entry.data = [];
        entry.loading = false;
        entry.error = errorMessage;

        span.setAttributes({ success: false, error: errorMessage });

        // Notify all subscribers of error
        entry.subscribers.forEach(callback => {
          callback({
            shotData: [],
            loading: false,
            error: errorMessage
          });
        });

        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'Error loading shot data via singleton manager',
          attributes: { season, entity_id: entityId, view_mode: viewMode, error: errorMessage },
        });

        throw err;
      } finally {
        span.end();
        entry.fetchPromise = undefined;
      }
    })();

    return entry.fetchPromise;
  }

  // Clear cache for debugging
  clearCache() {
    this.cache.clear();
  }
}

export function useSingletonShotData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const [state, setState] = useState<{
    shotData: ShotData[];
    loading: boolean;
    error: string | null;
  }>({
    shotData: [],
    loading: true,
    error: null
  });

  const manager = useRef(ShotDataManager.getInstance());

  useEffect(() => {
    console.log(`🔐 useSingletonShotData: Subscribing to ${season}_${entityId}_${viewMode}`);
    
    const unsubscribe = manager.current.subscribe(
      season, 
      entityId, 
      viewMode, 
      (data) => {
        setState(data);
      }
    );

    return unsubscribe;
  }, [season, entityId, viewMode]);

  return state;
}