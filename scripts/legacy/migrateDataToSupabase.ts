// Migration script disabled - data has been migrated to Supabase directly
// This file is kept for reference but all functions are disabled to avoid TypeScript conflicts

export class DataMigrator {
  static async migratePlayersToSupabase(): Promise<void> {
    console.log('⚠️ Migration disabled - data already migrated to Supabase');
  }

  static async migrateShotDataToSupabase(seasons: string[]): Promise<void> {
    console.log('⚠️ Migration disabled - data already migrated to Supabase');
  }

  static async migrateAllData(): Promise<void> {
    console.log('⚠️ Migration disabled - data already migrated to Supabase');
  }

  static async migratePlayersFromText(csvText: string): Promise<void> {
    console.log('⚠️ Migration disabled - data already migrated to Supabase');
  }

  static async migrateShotDataFromText(csvText: string, season: string): Promise<void> {
    console.log('⚠️ Migration disabled - data already migrated to Supabase');
  }
}

// Helper function to run migration from browser console
(window as any).migrateData = DataMigrator.migrateAllData;
