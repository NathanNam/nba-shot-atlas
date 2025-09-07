import { useState, useEffect, useRef } from 'react';
import { SupabaseDataService, ShotData } from '@/services/supabaseDataService';
import { tracer, logger } from '../otel-client';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { trackAPIResponse, trackError } from '@/components/PerformanceMonitor';
import { SpanStatusCode } from '@opentelemetry/api';
import { structuredLogger } from '@/utils/structuredLogger';

// Singleton data manager to prevent duplicate fetches
class ShotDataManager {
  private static instance: ShotDataManager;
  private cache = new Map<string, {
    data: ShotData[];
    loading: boolean;
    error: string | null;
    progress: { loaded: number; total?: number; isProcessing?: boolean } | null;
    subscribers: Set<(data: { shotData: ShotData[], loading: boolean, error: string | null, progress: { loaded: number; total?: number; isProcessing?: boolean } | null }) => void>;
    fetchPromise?: Promise<ShotData[]>;
    timestamp: number;
  }>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private static readonly TTL = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), ShotDataManager.TTL);
  }

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
    callback: (data: { shotData: ShotData[], loading: boolean, error: string | null, progress: { loaded: number; total?: number; isProcessing?: boolean } | null }) => void
  ) {
    this.cleanup();
    const key = this.getKey(season, entityId, viewMode);
    const now = Date.now();

    const existing = this.cache.get(key);
    if (existing && now - existing.timestamp > ShotDataManager.TTL) {
      this.cache.delete(key);
    }

    if (!this.cache.has(key)) {
      this.cache.set(key, {
        data: [],
        loading: true,
        error: null,
        progress: null,
        subscribers: new Set(),
        timestamp: now,
      });

      // Start fetching data
      this.fetchData(key, season, entityId, viewMode);
    }

    const entry = this.cache.get(key)!;
    entry.timestamp = now;
    entry.subscribers.add(callback);

    // Immediately call back with current state
    callback({
      shotData: entry.data,
      loading: entry.loading,
      error: entry.error,
      progress: entry.progress
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
    entry.timestamp = Date.now();
    
    // Prevent duplicate fetches
    if (entry.fetchPromise) {
      return entry.fetchPromise;
    }

    console.log(`🔐 ShotDataManager: Starting single fetch for ${key}`, {
      currentCacheKeys: Array.from(this.cache.keys()),
      subscriberCount: entry.subscribers.size
    });

    const span = tracer.startSpan('singleton_shot_data.load', {
      attributes: { 
        season, 
        entity_id: entityId, 
        view_mode: viewMode,
        cache_key: key,
        subscriber_count: entry.subscribers.size,
      },
    });

    entry.fetchPromise = (async () => {
      const startTime = Date.now();
      
      try {
        if (!entityId && viewMode !== 'league') {
          console.log(`🔐 ShotDataManager: No entityId for ${viewMode}, skipping`);
          span.setAttributes({
            'data.empty_result': true,
            'data.reason': 'no_entity_id',
          });
          return [];
        }

        // Create child span for data service call
        const dataSpan = tracer.startSpan('supabase_data_service.get_shot_data', {
          attributes: { 
            season, 
            entity_id: entityId, 
            view_mode: viewMode,
            service: 'supabase',
          },
        });

        structuredLogger.logDataLoading(
          'shot_data_fetch_start',
          viewMode,
          entityId,
          season,
          undefined, // no duration yet
          undefined, // no error
        );

        try {
          const data = await SupabaseDataService.getShotData(
          season,
          entityId,
          viewMode,
          (loaded, total) => {
            // Update progress and notify subscribers
            entry.progress = { loaded, total, isProcessing: true };
            entry.subscribers.forEach(callback => {
              callback({
                shotData: entry.data,
                loading: entry.loading,
                error: entry.error,
                progress: entry.progress
              });
            });
          }
        );

        const safeData = Array.isArray(data) ? data : [];
        const responseTime = Date.now() - startTime;

        console.log(`🔐 ShotDataManager: Fetched ${safeData.length} shots for ${key}`, {
          dataHash: JSON.stringify(safeData.slice(0, 3)),
          subscriberCount: entry.subscribers.size
        });

        entry.data = safeData;
        entry.loading = false;
        entry.error = null;
        entry.progress = null; // Clear progress when complete
        entry.timestamp = Date.now();

        // Track successful API response
        trackAPIResponse(`supabase.getShotData.${viewMode}`, responseTime, true, 200);
        
        span.setAttributes({ 
          success: true, 
          result_count: safeData.length,
          response_time_ms: responseTime,
          'data.size_bytes': JSON.stringify(safeData).length,
        });
        
        dataSpan.setAttributes({
          success: true,
          result_count: safeData.length,
          response_time_ms: responseTime,
        });
        dataSpan.setStatus({ code: SpanStatusCode.OK });
        dataSpan.end();

        structuredLogger.logDataLoading(
          'shot_data_fetch_success',
          viewMode,
          entityId,
          season,
          responseTime,
          undefined, // no error
        );

        // Notify all subscribers
        entry.subscribers.forEach(callback => {
          callback({
            shotData: safeData,
            loading: false,
            error: null,
            progress: null
          });
        });

        return safeData;
        
        } catch (dataErr) {
          const dataErrorMessage = dataErr instanceof Error ? dataErr.message : 'Supabase data service error';
          dataSpan.setStatus({ 
            code: SpanStatusCode.ERROR, 
            message: dataErrorMessage 
          });
          dataSpan.recordException(dataErr as Error);
          dataSpan.end();
          throw dataErr;
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load shot data';
        const responseTime = Date.now() - startTime;
        
        // Track failed API response
        trackAPIResponse(`supabase.getShotData.${viewMode}`, responseTime, false);
        trackError('data_loading_error', errorMessage, 'ShotDataManager', {
          season,
          entity_id: entityId,
          view_mode: viewMode,
          cache_key: key,
          response_time_ms: responseTime,
        });
        
        entry.data = [];
        entry.loading = false;
        entry.error = errorMessage;
        entry.progress = null;
        entry.timestamp = Date.now();

        span.setAttributes({ 
          success: false, 
          error: errorMessage,
          response_time_ms: responseTime,
        });
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: errorMessage 
        });
        span.recordException(err as Error);

        // Notify all subscribers of error
        entry.subscribers.forEach(callback => {
          callback({
            shotData: [],
            loading: false,
            error: errorMessage,
            progress: null
          });
        });

        structuredLogger.logDataLoading(
          'shot_data_fetch_error',
          viewMode,
          entityId,
          season,
          responseTime,
          err as Error,
        );

        throw err;
      } finally {
        span.end();
        entry.fetchPromise = undefined;
      }
    })();

    return entry.fetchPromise;
  }

  cleanup() {
    const now = Date.now();
    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > ShotDataManager.TTL) {
        console.log(`🔐 ShotDataManager: Pruning stale cache entry ${key}`);
        this.cache.delete(key);
      }
    });
  }

  // Clear cache for debugging
  clearCache() {
    console.log(`🔐 ShotDataManager: Clearing cache - had ${this.cache.size} entries`);
    this.cache.clear();
  }
}

export function useSingletonShotData(
  season: string,
  entityId: string,
  viewMode: 'player' | 'team' | 'league',
  enabled: boolean = true
) {
  const [state, setState] = useState<{
    shotData: ShotData[];
    loading: boolean;
    error: string | null;
    progress: { loaded: number; total?: number; isProcessing?: boolean } | null;
  }>({
    shotData: [],
    loading: enabled,
    error: null,
    progress: null
  });

  const manager = useRef(ShotDataManager.getInstance());

  useEffect(() => {
    if (!enabled) {
      console.log(`🔐 useSingletonShotData: Skipping subscription for ${season}_${entityId}_${viewMode}`);
      return;
    }

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
  }, [season, entityId, viewMode, enabled]);

  return state;
}