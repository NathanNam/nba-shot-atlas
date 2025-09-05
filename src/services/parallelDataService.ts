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
    
    // Use league-specific parallel fetching for league mode
    if (viewMode === 'league') {
      return await this.getLeagueDataParallel(season, progressCallback);
    }
    
    // Use parallel fetching for player/team modes to handle large datasets
    console.log(`🚀 ParallelDataService: Using parallel fetch for ${viewMode} data`);
    
    // Use cursor-based pagination for complete data retrieval
    console.log(`🚀 ParallelDataService: Using cursor-based pagination for ${viewMode} data`);
    
    const batchSize = 1000;
    let allData: any[] = [];
    let hasMore = true;
    let lastActionNumber: number | null = null;
    let lastGameId: number | null = null;
    let batchCount = 0;

    while (hasMore) {
      let query = (supabase as any)
        .from(tableName)
        .select('*')
        .order('gameId', { ascending: true })
        .order('actionNumber', { ascending: true })
        .limit(batchSize);

      // Apply entity filters
      if (viewMode === 'player' && entityId) {
        const numericEntityId = parseInt(entityId);
        if (!isNaN(numericEntityId)) {
          query = query.eq('personId', numericEntityId);
        } else {
          console.error(`🚀 ParallelDataService: Invalid player ID: ${entityId}`);
          return [];
        }
      } else if (viewMode === 'team' && entityId) {
        query = query.eq('teamTricode', entityId);
      }

      // Apply cursor pagination
      if (lastGameId !== null && lastActionNumber !== null) {
        query = query.or(`gameId.gt.${lastGameId},and(gameId.eq.${lastGameId},actionNumber.gt.${lastActionNumber})`);
      }

      const { data: batchData, error } = await query;
      
      if (error) {
        console.error(`🚀 ParallelDataService: Cursor query error:`, error);
        throw new Error(`Cursor query failed: ${error.message}`);
      }

      if (batchData && batchData.length > 0) {
        allData.push(...batchData);
        batchCount++;
        
        // Update cursor to last record
        const lastRecord = batchData[batchData.length - 1];
        lastGameId = lastRecord.gameId;
        lastActionNumber = lastRecord.actionNumber;
        
        console.log(`🚀 ParallelDataService: Cursor batch ${batchCount} - got ${batchData.length} records (total: ${allData.length})`);
        
        // Check if we got a full batch (indicates more data might be available)
        hasMore = batchData.length === batchSize;
        
        if (progressCallback) {
          progressCallback(allData.length, undefined);
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`🚀 ParallelDataService: Cursor pagination complete. Got ${allData.length} total records`);

    // Transform data with strict type conversion for consistency
    const shots: ShotData[] = allData.map(row => ({
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

    // Data is already ordered by gameId, actionNumber from the query
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

  /**
   * Parallel data fetching for league mode
   */
  private static async getLeagueDataParallel(
    season: string,
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const batchSize = 5000;
    let allData: ShotData[] = [];
    let hasMoreData = true;
    let currentGameId: string | null = null;
    let currentActionNumber: number | null = null;
    let totalLoaded = 0;
    let batchCount = 0;

    console.log(`🚀 Starting sequential league data fetch for ${season}`);

    while (hasMoreData) {
      batchCount++;
      const result = await this.fetchLeagueBatch(season, batchSize, currentGameId, currentActionNumber);
      
      if (result.data.length > 0) {
        // Transform the data to ShotData format
        const transformedData = result.data.map(shot => ({
          personId: String(shot.personId || ''),
          teamTricode: String(shot.teamTricode || ''),
          xLegacy: Number(shot.xLegacy) || 0,
          yLegacy: Number(shot.yLegacy) || 0, 
          shotDistance: Number(shot.shotDistance) || 0,
          shotResult: String(shot.shotResult || ''),
          shotValue: Number(shot.shotValue) || 2,
          description: String(shot.description || ''),
          subType: String(shot.subType || ''),
        }));
        allData = allData.concat(transformedData);
        totalLoaded += result.data.length;
        
        // Update cursor for next batch
        currentGameId = result.lastGameId;
        currentActionNumber = result.lastActionNumber;
        
        progressCallback?.(totalLoaded);
        console.log(`📊 Batch ${batchCount}: Loaded ${result.data.length} shots (total: ${totalLoaded} league shots)`);
      }
      
      // Continue if we got a full batch (indicates more data available)
      hasMoreData = result.hasMore && result.data.length === batchSize;
    }

    console.log(`✅ League fetch complete: ${allData.length} shots loaded in ${batchCount} batches`);
    return allData;
  }

  /**
   * Fetch a single batch of league data
   */
  private static async fetchLeagueBatch(
    season: string,
    batchSize: number,
    gameId: string | null,
    actionNumber: number | null
  ): Promise<{ data: any[]; hasMore: boolean; lastGameId: string | null; lastActionNumber: number | null }> {
    
    let query = supabase
      .from(`shots_${season}` as any)
      .select('*')
      .order('gameId', { ascending: true })
      .order('actionNumber', { ascending: true })
      .limit(batchSize);

    // Apply cursor if provided
    if (gameId && actionNumber !== null) {
      query = query.or(`gameId.gt.${gameId},and(gameId.eq.${gameId},actionNumber.gt.${actionNumber})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error fetching league batch:', error);
      throw error;
    }

    const hasMore = data && data.length === batchSize;
    let lastGameId: string | null = null;
    let lastActionNumber: number | null = null;

    if (data && data.length > 0) {
      const lastShot = data[data.length - 1] as any;
      lastGameId = lastShot.gameId?.toString() || null;
      lastActionNumber = lastShot.actionNumber || null;
    }

    return {
      data: data || [],
      hasMore: hasMore || false,
      lastGameId,
      lastActionNumber
    };
  }
}