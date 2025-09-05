import { supabase } from '@/integrations/supabase/client';
import { ShotData } from './supabaseDataService';

export class ParallelDataService {
  /**
   * Fetch data using parallel requests for better performance
   */
  static async getDataParallel(
    season: string,
    entityId?: string,
    viewMode: 'player' | 'team' | 'league' = 'league',
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    
    console.log(`🚀 ParallelDataService: Starting fetch for ${viewMode} - ${entityId || 'all'} (season: ${season})`);
    
    // For league mode, statistics should be calculated server-side via Edge Function
    if (viewMode === 'league') {
      throw new Error('League mode should use server-side calculation. Use LeagueStatsService instead.');
    }
    
    // Use parallel fetching for player/team modes to handle large datasets
    console.log(`🚀 ParallelDataService: Using parallel fetch for ${viewMode} data`);
    
    // Use deterministic single query for player/team data to ensure consistency
    console.log(`🚀 ParallelDataService: Using deterministic single query for ${viewMode} data`);
    
    let query = (supabase as any)
      .from(tableName)
      .select('*')
      .order('actionId', { ascending: true }); // Add consistent ordering

    // Apply filters
    if (viewMode === 'player' && entityId) {
      const numericEntityId = parseInt(entityId);
      if (!isNaN(numericEntityId)) {
        console.log(`🚀 ParallelDataService: Filtering by personId=${numericEntityId}`);
        query = query.eq('personId', numericEntityId);
      } else {
        console.error(`🚀 ParallelDataService: Invalid player ID: ${entityId}`);
        return [];
      }
    } else if (viewMode === 'team' && entityId) {
      console.log(`🚀 ParallelDataService: Filtering by teamTricode=${entityId}`);
      query = query.eq('teamTricode', entityId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error(`🚀 ParallelDataService: Query error:`, error);
      throw new Error(`Query failed: ${error.message}`);
    }

    console.log(`🚀 ParallelDataService: Single query got ${data?.length || 0} records for ${viewMode}`);

    if (progressCallback) {
      progressCallback(data?.length || 0, data?.length || 0);
    }

    // Transform data with strict type conversion for consistency
    const shots: ShotData[] = (data || []).map(row => ({
      personId: String(row.personId || ''),
      teamTricode: String(row.teamTricode || ''),
      xLegacy: Number(row.xLegacy) || 0,
      yLegacy: Number(row.yLegacy) || 0, 
      shotDistance: Number(row.shotDistance) || 0,
      shotResult: String(row.shotResult || ''),
      shotValue: Number(row.shotValue) || 2,
      description: String(row.description || ''),
      subType: String(row.subType || ''),
    }));

    // Sort results by actionId for deterministic ordering
    shots.sort((a, b) => {
      const aId = Number(data?.find(row => row.personId === a.personId)?.actionId || 0);
      const bId = Number(data?.find(row => row.personId === b.personId)?.actionId || 0);
      return aId - bId;
    });

    return shots;
  }

  /**
   * Direct data fetching for player/team modes (smaller datasets)
   */
  private static async getDirectData(
    season: string,
    entityId?: string,
    viewMode: 'player' | 'team' | 'league' = 'league',
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    
    console.log(`🚀 ParallelDataService: Direct fetch for ${viewMode} - ${entityId}`);
    
    let query = (supabase as any)
      .from(tableName)
      .select('*');

    // Apply filters
    if (viewMode === 'player' && entityId) {
      const numericEntityId = parseInt(entityId);
      if (!isNaN(numericEntityId)) {
        console.log(`🚀 ParallelDataService: Filtering by personId=${numericEntityId}`);
        query = query.eq('personId', numericEntityId);
      } else {
        console.error(`🚀 ParallelDataService: Invalid player ID: ${entityId}`);
        return [];
      }
    } else if (viewMode === 'team' && entityId) {
      console.log(`🚀 ParallelDataService: Filtering by teamTricode=${entityId}`);
      query = query.eq('teamTricode', entityId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error(`🚀 ParallelDataService: Direct fetch error:`, error);
      throw new Error(`Direct fetch failed: ${error.message}`);
    }

    console.log(`🚀 ParallelDataService: Direct fetch got ${data?.length || 0} records for ${viewMode}`);

    if (progressCallback) {
      progressCallback(data?.length || 0, data?.length || 0);
    }

    // Transform data
    const shots: ShotData[] = (data || []).map(row => ({
      personId: row.personId?.toString() || '',
      teamTricode: row.teamTricode || '',
      xLegacy: parseFloat(row.xLegacy?.toString() || '0'),
      yLegacy: parseFloat(row.yLegacy?.toString() || '0'),
      shotDistance: parseFloat(row.shotDistance?.toString() || '0'),
      shotResult: row.shotResult || '',
      shotValue: parseInt(row.shotValue?.toString() || '2'),
      description: row.description || '',
      subType: row.subType || '',
    }));

    return shots;
  }

  /**
   * Fallback method for when parallel fetching fails
   */
  private static async getFallbackData(
    season: string,
    entityId?: string,
    viewMode: 'player' | 'team' | 'league' = 'league'
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    
    let query = (supabase as any)
      .from(tableName)
      .select('*')
      .limit(10000); // Higher limit for fallback

    // Apply filters
    if (viewMode === 'player' && entityId) {
      const numericEntityId = parseInt(entityId);
      if (!isNaN(numericEntityId)) {
        query = query.eq('personId', numericEntityId);
      }
    } else if (viewMode === 'team' && entityId) {
      query = query.eq('teamTricode', entityId);
    }

    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Fallback query failed: ${error.message}`);
    }

    const shots: ShotData[] = (data || []).map(row => ({
      personId: row.personId?.toString() || '',
      teamTricode: row.teamTricode || '',
      xLegacy: parseFloat(row.xLegacy?.toString() || '0'),
      yLegacy: parseFloat(row.yLegacy?.toString() || '0'),
      shotDistance: parseFloat(row.shotDistance?.toString() || '0'),
      shotResult: row.shotResult || '',
      shotValue: parseInt(row.shotValue?.toString() || '2'),
      description: row.description || '',
      subType: row.subType || '',
    }));

    console.log(`🚀 ParallelDataService: Fallback fetch got ${shots.length} records`);
    return shots;
  }
}