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

        const data = await SupabaseDataService.getShotData(season, entityId, viewMode, (loaded, total) => {
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
        });
        
        console.log(`🔐 ShotDataManager: Fetched ${data.length} shots for ${key}`, {
          dataHash: JSON.stringify(data.slice(0, 3)),
          subscriberCount: entry.subscribers.size
        });
        
        entry.data = data;
        entry.loading = false;
        entry.error = null;
        entry.progress = null; // Clear progress when complete
        entry.timestamp = Date.now();

        span.setAttributes({ success: true, result_count: data.length });

        // Notify all subscribers
        entry.subscribers.forEach(callback => {
          callback({
            shotData: data,
            loading: false,
            error: null,
            progress: null
          });
        });

        return data;

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load shot data';
        
        entry.data = [];
        entry.loading = false;
        entry.error = errorMessage;
        entry.progress = null;
        entry.timestamp = Date.now();

        span.setAttributes({ success: false, error: errorMessage });

        // Notify all subscribers of error
        entry.subscribers.forEach(callback => {
          callback({
            shotData: [],
            loading: false,
            error: errorMessage,
            progress: null
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

export function useSingletonShotData(season: string, entityId: string, viewMode: 'player' | 'team' | 'league') {
  const [state, setState] = useState<{
    shotData: ShotData[];
    loading: boolean;
    error: string | null;
    progress: { loaded: number; total?: number; isProcessing?: boolean } | null;
  }>({
    shotData: [],
    loading: true,
    error: null,
    progress: null
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