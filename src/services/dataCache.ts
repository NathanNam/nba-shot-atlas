import { ShotData } from './supabaseDataService';

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

  // Generate cache key
  private getCacheKey(season: string, entityId: string, viewMode: string): string {
    return `${season}_${viewMode}_${entityId || 'all'}`;
  }

  // Check if cache entry is valid
  private isValidCache(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  }

  // Get from cache
  get(season: string, entityId: string, viewMode: 'player' | 'team' | 'league'): ShotData[] | null {
    const key = this.getCacheKey(season, entityId, viewMode);
    const entry = this.cache.get(key);
    
    if (entry && this.isValidCache(entry)) {
      console.log(`🚀 DataCache: Cache hit for ${key}`);
      return entry.data;
    }
    
    if (entry) {
      console.log(`🚀 DataCache: Cache expired for ${key}, removing`);
      this.cache.delete(key);
    }
    
    return null;
  }

  // Set cache
  set(season: string, entityId: string, viewMode: 'player' | 'team' | 'league', data: ShotData[]): void {
    const key = this.getCacheKey(season, entityId, viewMode);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      season,
      entityId,
      viewMode
    };
    
    this.cache.set(key, entry);
    console.log(`🚀 DataCache: Cached ${data.length} shots for ${key}`);
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

  // Check if specific default data is preloaded
  isDefaultDataReady(): boolean {
    const defaultKeys = [
      'player_stephen_curry_2024-25',
      'team_gsw_2024-25',
      'league_2024-25'
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