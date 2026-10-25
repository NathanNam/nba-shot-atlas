import { SupabaseDataService } from './supabaseDataService';
import { dataCache } from './dataCache';

export class DataPreloader {
  private static isPreloading = false;
  private static preloadingPromise: Promise<void> | null = null;

  static async preloadDefaultData(): Promise<void> {
    if (this.isPreloading || this.preloadingPromise) {
      return this.preloadingPromise || Promise.resolve();
    }

    this.isPreloading = true;
    console.log('🚀 DataPreloader: Starting preload of default data...');
    
    // Only clear cache if we don't already have default data ready
    if (!dataCache.isDefaultDataReady()) {
      console.log('🚀 DataPreloader: Clearing cache for fresh preload...');
      dataCache.clear();
      dataCache.clearPreloaded();
    } else {
      console.log('🚀 DataPreloader: Default data already available, skipping cache clear');
    }

    this.preloadingPromise = this.performPreload();
    
    try {
      await this.preloadingPromise;
      console.log('🚀 DataPreloader: Default data preload completed');
    } catch (error) {
      console.error('🚀 DataPreloader: Error during preload:', error);
    } finally {
      this.isPreloading = false;
      this.preloadingPromise = null;
    }
  }

  private static async performPreload(): Promise<void> {
    const defaultSeason = '2025-26';
    
    // Define default data to preload (excluding league to avoid stale sampled data)
    const preloadTasks = [
      {
        key: 'player_stephen_curry_2025-26',
        season: defaultSeason,
        entityId: '201939', // Stephen Curry's ID
        viewMode: 'player' as const,
        label: 'Stephen Curry (2025-26)'
      },
      {
        key: 'team_gsw_2025-26',
        season: defaultSeason,
        entityId: 'GSW',
        viewMode: 'team' as const,
        label: 'Golden State Warriors (2025-26)'
      }
      // Note: League data excluded from preload to ensure fresh full dataset loading
    ];

    // Preload all default data concurrently
    const promises = preloadTasks.map(async (task) => {
      try {
        console.log(`🚀 DataPreloader: Loading ${task.label}...`);
        const data = await SupabaseDataService.getShotData(task.season, task.entityId, task.viewMode);
        
        dataCache.setPreloaded(
          task.key,
          task.season,
          task.entityId,
          task.viewMode,
          data,
          task.label
        );
        
        console.log(`🚀 DataPreloader: Preloaded ${data.length} shots for ${task.label}`);
      } catch (error) {
        console.error(`🚀 DataPreloader: Failed to preload ${task.label}:`, error);
      }
    });

    await Promise.all(promises);
  }

  static getPreloadStatus(): {
    isPreloading: boolean;
    isDefaultDataReady: boolean;
    stats: ReturnType<typeof dataCache.getStats>;
  } {
    return {
      isPreloading: this.isPreloading,
      isDefaultDataReady: dataCache.isDefaultDataReady(),
      stats: dataCache.getStats()
    };
  }

  static clearCache(): void {
    dataCache.clear();
    dataCache.clearPreloaded();
  }
}