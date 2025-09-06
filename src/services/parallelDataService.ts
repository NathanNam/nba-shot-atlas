/* eslint-disable @typescript-eslint/no-explicit-any */
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
    
    // Use optimized fetching based on view mode
    if (viewMode === 'team') {
      console.log(`🚀 ParallelDataService: Using optimized team data fetch`);
      return await this.getTeamDataOptimized(season, entityId!, progressCallback);
    } else {
      console.log(`🚀 ParallelDataService: Using cursor-based pagination for ${viewMode} data`);
      return await this.getPlayerDataCursor(season, entityId!, progressCallback);
    }
  }

  /**
   * Optimized team data fetching with smaller batches, retry logic, and better timeout handling
   */
  private static async getTeamDataOptimized(
    season: string,
    teamId: string,
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    const batchSize = 100; // Smaller batch size for better performance
    const maxRetries = 3;
    const timeoutMs = 10000; // 10 second timeout per batch

    console.log(`🚀 ParallelDataService: Starting optimized team fetch for ${teamId} (season: ${season})`);

    // Use cursor-based pagination instead of offset for better performance
    const allData: ShotData[] = [];
    let hasMore = true;
    let lastGameId: number | null = null;
    let lastActionNumber: number | null = null;
    let batchCount = 0;

    while (hasMore && batchCount < 500) { // Safety limit
      batchCount++;
      let retryCount = 0;
      let success = false;
      
      while (!success && retryCount < maxRetries) {
        try {
          // Create query with timeout
          const queryPromise = this.fetchTeamBatchWithCursor(
            tableName, 
            teamId, 
            batchSize, 
            lastGameId, 
            lastActionNumber
          );
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
          );
          
          const result = await Promise.race([queryPromise, timeoutPromise]) as {
            data: any[];
            hasMore: boolean;
            lastGameId: number | null;
            lastActionNumber: number | null;
          };

          const batchData = result.data || [];
          const batchShots: ShotData[] = batchData.map(row => ({
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
          allData.push(...batchShots);

          // Update cursor
          lastGameId = result.lastGameId;
          lastActionNumber = result.lastActionNumber;

          console.log(
            `🚀 ParallelDataService: Team batch ${batchCount} - got ${batchShots.length} records (total: ${allData.length})`
          );

          progressCallback?.(allData.length, undefined);

          hasMore = result.hasMore && batchShots.length === batchSize;
          success = true;
          
        } catch (error: any) {
          retryCount++;
          const isTimeout = error.message.includes('timeout');
          
          console.warn(
            `⚠️ Team batch ${batchCount} failed (attempt ${retryCount}/${maxRetries}) - ${isTimeout ? 'timeout' : error.message}`
          );
          
          if (retryCount >= maxRetries) {
            // For older seasons that may have indexing issues, try fallback
            if (batchCount === 1 && allData.length === 0) {
              console.log(`🔄 Trying fallback method for ${teamId} in ${season}`);
              return await this.getTeamDataFallback(season, teamId, progressCallback);
            }
            
            console.error(`❌ Failed to fetch team data after ${maxRetries} attempts, returning partial data`);
            hasMore = false;
            success = true; // Stop trying but return what we have
          } else {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }
      }
    }

    console.log(`🚀 ParallelDataService: Team fetch complete. Got ${allData.length} total records`);

    return allData;
  }

  /**
   * Helper method to fetch a team batch with cursor pagination
   */
  private static async fetchTeamBatchWithCursor(
    tableName: string,
    teamId: string,
    batchSize: number,
    lastGameId: number | null,
    lastActionNumber: number | null
  ): Promise<{ data: any[]; hasMore: boolean; lastGameId: number | null; lastActionNumber: number | null }> {
    let query = (supabase as any)
      .from(tableName)
      .select('*')
      .eq('teamTricode', teamId)
      .order('gameId', { ascending: true })
      .order('actionNumber', { ascending: true })
      .limit(batchSize);

    // Apply cursor pagination
    if (lastGameId !== null && lastActionNumber !== null) {
      query = query.or(`gameId.gt.${lastGameId},and(gameId.eq.${lastGameId},actionNumber.gt.${lastActionNumber})`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Team batch query failed: ${error.message}`);
    }

    const batchData = data || [];
    const hasMore = batchData.length === batchSize;
    
    let newLastGameId: number | null = null;
    let newLastActionNumber: number | null = null;
    
    if (batchData.length > 0) {
      const lastRecord = batchData[batchData.length - 1];
      newLastGameId = lastRecord.gameId;
      newLastActionNumber = lastRecord.actionNumber;
    }

    return {
      data: batchData,
      hasMore,
      lastGameId: newLastGameId,
      lastActionNumber: newLastActionNumber
    };
  }

  /**
   * Fallback method for team data when optimized method fails
   */
  private static async getTeamDataFallback(
    season: string,
    teamId: string,
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    
    console.log(`🔄 ParallelDataService: Using fallback method for ${teamId} in ${season}`);
    
    try {
      const { data, error } = await (supabase as any)
        .from(tableName)
        .select('*')
        .eq('teamTricode', teamId)
        .limit(5000); // Conservative limit for fallback

      if (error) {
        throw new Error(`Fallback team query failed: ${error.message}`);
      }

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

      console.log(`🔄 ParallelDataService: Fallback got ${shots.length} records for ${teamId}`);
      progressCallback?.(shots.length, shots.length);
      
      return shots;
    } catch (error: any) {
      console.error(`❌ ParallelDataService: Fallback failed for ${teamId} in ${season}:`, error);
      throw error;
    }
  }

  /**
   * Player data fetching with cursor-based pagination
   */
  private static async getPlayerDataCursor(
    season: string,
    playerId: string,
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    const batchSize = 1000;
    
    const allData: any[] = [];
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

      // Apply player filter
      const numericEntityId = parseInt(playerId);
      if (!isNaN(numericEntityId)) {
        query = query.eq('personId', numericEntityId);
      } else {
        console.error(`🚀 ParallelDataService: Invalid player ID: ${playerId}`);
        return [];
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

    console.log(`🚀 ParallelDataService: Player cursor pagination complete. Got ${allData.length} total records`);

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
    const batchSize = 1000; // Smaller batch size to avoid timeouts
    let allData: ShotData[] = [];
    let hasMoreData = true;
    let currentGameId: string | null = null;
    let currentActionNumber: number | null = null;
    let totalLoaded = 0;
    let batchCount = 0;
    const maxRetries = 3;

    console.log(`🚀 Starting sequential league data fetch for ${season} with batch size ${batchSize}`);

    while (hasMoreData && batchCount < 100) { // Safety limit to prevent infinite loops
      batchCount++;
      let retryCount = 0;
      let success = false;
      
      while (!success && retryCount < maxRetries) {
        try {
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
            
            // Continue if we got a full batch (indicates more data available)
            hasMoreData = result.hasMore && result.data.length === batchSize;
            success = true;
          } else {
            hasMoreData = false;
            success = true;
          }
        } catch (error: any) {
          retryCount++;
          console.warn(`⚠️ Batch ${batchCount} failed (attempt ${retryCount}/${maxRetries}):`, error.message);
          
          if (retryCount >= maxRetries) {
            console.error(`❌ Failed to fetch batch ${batchCount} after ${maxRetries} attempts, stopping`);
            hasMoreData = false;
            success = true; // Stop trying
          } else {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
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