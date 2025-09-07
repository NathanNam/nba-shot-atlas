import { ShotData } from './supabaseDataService';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

export interface CacheEntry {
  data: ShotData[];
  timestamp: number;
  season: string;
  entityId: string;
  viewMode: 'player' | 'team' | 'league';
}

export interface PreloadedEntry {
  key: string;
  data: ShotData[];
  season: string;
  entityId: string;
  viewMode: 'player' | 'team' | 'league';
  label: string;
}

class DataCacheService {
  private cache = new Map<string, CacheEntry>();
  private preloadedData = new Map<string, PreloadedEntry>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private readonly CACHE_VERSION = 'v2'; // Increment to invalidate old cache

  // OpenTelemetry metrics
  private readonly cacheHitCounter = meter.createCounter('data_cache_operations_total', {
    description: 'Total cache operations (hits/misses)',
  });

  private readonly cacheSize = meter.createUpDownCounter('data_cache_entries_count', {
    description: 'Current number of entries in the data cache',
  });

  private readonly cacheSizeBytes = meter.createUpDownCounter('data_cache_size_bytes', {
    description: 'Estimated size of the data cache in bytes',
  });

  // Generate cache key with version
  private getCacheKey(season: string, entityId: string, viewMode: string): string {
    return `${this.CACHE_VERSION}_${season}_${viewMode}_${entityId || 'all'}`;
  }

  // Check if cache entry is valid
  private isValidCache(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  }

  // Get from cache
  get(season: string, entityId: string, viewMode: 'player' | 'team' | 'league'): ShotData[] | null {
    const span = tracer.startSpan('data_cache.get', {
      attributes: {
        'cache.operation': 'get',
        'cache.key': this.getCacheKey(season, entityId, viewMode),
        'cache.season': season,
        'cache.entity_id': entityId,
        'cache.view_mode': viewMode,
      },
    });

    try {
      const key = this.getCacheKey(season, entityId, viewMode);
      const entry = this.cache.get(key);
      
      if (entry && this.isValidCache(entry)) {
        this.cacheHitCounter.add(1, {
          operation: 'get',
          result: 'hit',
          view_mode: viewMode,
        });

        span.setAttributes({
          'cache.hit': true,
          'cache.data_size': entry.data.length,
          'cache.age_ms': Date.now() - entry.timestamp,
        });

        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: 'Cache hit',
          attributes: {
            cache_key: key,
            data_size: entry.data.length,
            cache_age_ms: Date.now() - entry.timestamp,
          },
        });

        console.log(`🚀 DataCache: Cache hit for ${key}`);
        return entry.data;
      }
      
      if (entry) {
        this.cacheHitCounter.add(1, {
          operation: 'get',
          result: 'expired',
          view_mode: viewMode,
        });

        span.setAttributes({
          'cache.hit': false,
          'cache.expired': true,
          'cache.age_ms': Date.now() - entry.timestamp,
        });

        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: 'Cache entry expired',
          attributes: {
            cache_key: key,
            cache_age_ms: Date.now() - entry.timestamp,
            max_age_ms: this.CACHE_DURATION,
          },
        });

        console.log(`🚀 DataCache: Cache expired for ${key}, removing`);
        this.cache.delete(key);
        this.cacheSize.add(-1);
      } else {
        this.cacheHitCounter.add(1, {
          operation: 'get',
          result: 'miss',
          view_mode: viewMode,
        });

        span.setAttributes({
          'cache.hit': false,
          'cache.expired': false,
        });
      }
    
      return null;
    } finally {
      span.end();
    }
  }

  // Set cache
  set(season: string, entityId: string, viewMode: 'player' | 'team' | 'league', data: ShotData[]): void {
    const span = tracer.startSpan('data_cache.set', {
      attributes: {
        'cache.operation': 'set',
        'cache.season': season,
        'cache.entity_id': entityId,
        'cache.view_mode': viewMode,
        'cache.data_size': data.length,
      },
    });

    try {
      const key = this.getCacheKey(season, entityId, viewMode);
      const wasExisting = this.cache.has(key);
      
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        season,
        entityId,
        viewMode
      };
      
      this.cache.set(key, entry);
      
      // Update metrics
      if (!wasExisting) {
        this.cacheSize.add(1);
      }
      
      const estimatedSizeBytes = JSON.stringify(data).length * 2; // Rough UTF-16 estimate
      this.cacheSizeBytes.add(estimatedSizeBytes);

      this.cacheHitCounter.add(1, {
        operation: 'set',
        result: wasExisting ? 'update' : 'new',
        view_mode: viewMode,
      });

      span.setAttributes({
        'cache.key': key,
        'cache.was_existing': wasExisting,
        'cache.estimated_size_bytes': estimatedSizeBytes,
        'cache.total_entries': this.cache.size,
      });

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: wasExisting ? 'Cache entry updated' : 'New cache entry created',
        attributes: {
          cache_key: key,
          data_size: data.length,
          estimated_size_bytes: estimatedSizeBytes,
          total_cache_entries: this.cache.size,
        },
      });
      
      console.log(`🚀 DataCache: Cached ${data.length} shots for ${key}`);
    } finally {
      span.end();
    }
  }

  // Add preloaded data
  setPreloaded(key: string, season: string, entityId: string, viewMode: 'player' | 'team' | 'league', data: ShotData[], label: string): void {
    const preloadedEntry: PreloadedEntry = {
      key,
      data,
      season,
      entityId,
      viewMode,
      label
    };
    
    this.preloadedData.set(key, preloadedEntry);
    
    // Also add to regular cache
    this.set(season, entityId, viewMode, data);
    console.log(`🚀 DataCache: Preloaded ${data.length} shots for ${label} (${key})`);
  }

  // Get preloaded data
  getPreloaded(key: string): PreloadedEntry | null {
    return this.preloadedData.get(key) || null;
  }

  // Get all preloaded entries
  getAllPreloaded(): PreloadedEntry[] {
    return Array.from(this.preloadedData.values());
  }

  // Check if specific default data is preloaded (excluding league)
  isDefaultDataReady(): boolean {
    const defaultKeys = [
      'player_stephen_curry_2024-25',
      'team_gsw_2024-25'
      // League data excluded from default check
    ];
    
    return defaultKeys.every(key => this.preloadedData.has(key));
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
    console.log('🚀 DataCache: Cache cleared');
  }

  // Clear preloaded data
  clearPreloaded(): void {
    this.preloadedData.clear();
    console.log('🚀 DataCache: Preloaded data cleared');
  }

  // Get cache stats
  getStats(): { cacheSize: number; preloadedSize: number; validEntries: number } {
    const validEntries = Array.from(this.cache.values()).filter(entry => this.isValidCache(entry)).length;
    
    return {
      cacheSize: this.cache.size,
      preloadedSize: this.preloadedData.size,
      validEntries
    };
  }
}

export const dataCache = new DataCacheService();