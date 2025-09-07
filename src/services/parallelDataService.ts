/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from '@/integrations/supabase/client';
import { ShotData } from './supabaseDataService';

export class ParallelDataService {
  /**
   * Determine batch size based on total rows with bounds 500-1000
   */
  private static determineBatchSize(totalRows: number): number {
    if (!totalRows || totalRows <= 0) return 500;
    return Math.min(1000, Math.max(500, Math.ceil(totalRows / 10)));
  }
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
      console.log(`🚀 ParallelDataService: Using parallel player data fetch`);
      return await this.getPlayerDataParallel(season, entityId!, progressCallback);
    }
  }

  private static async getTeamDataOptimized(
    season: string,
    teamId: string,
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;
    console.log(`🚀 ParallelDataService: Starting optimized team fetch for ${teamId} (season: ${season})`);

    // Try server-side RPC first
    try {
      const { data } = await (supabase as any).rpc('fetch_team_shots', { season, team_id: teamId });
      if (data) {
        const shots: ShotData[] = data.map((row: any) => ({
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
    } catch {
      console.log('RPC fetch_team_shots failed, falling back to direct queries');
    }

    const { count } = await (supabase as any)
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('teamTricode', teamId);
    const total = count || 0;
    const batchSize = this.determineBatchSize(total);

    if (total > 0) {
      const { data: single } = await (supabase as any)
        .from(tableName)
        .select('*')
        .eq('teamTricode', teamId)
        .range(0, total - 1);
      if (single && single.length === total) {
        const shots: ShotData[] = single.map((row: any) => ({
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
        progressCallback?.(shots.length, shots.length);
        return shots;
      }
    }

    const promises: Promise<any>[] = [];
    for (let from = 0; from < total; from += batchSize) {
      const to = Math.min(total - 1, from + batchSize - 1);
      promises.push(
        (supabase as any)
          .from(tableName)
          .select('*')
          .eq('teamTricode', teamId)
          .range(from, to)
      );
    }
    const results = await Promise.all(promises);
    const allData: any[] = [];
    results.forEach(r => {
      const batch = r.data || [];
      allData.push(...batch);
      progressCallback?.(allData.length, total);
    });
    const shots: ShotData[] = allData.map((row: any) => ({
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
  private static async getPlayerDataParallel(
    season: string,
    playerId: string,
    progressCallback?: (loaded: number, total?: number) => void
  ): Promise<ShotData[]> {
    const tableName = `shots_${season}`;

    // Attempt RPC for single query fetch
    try {
      const numericId = parseInt(playerId);
      const { data } = await (supabase as any).rpc('fetch_player_shots', { season, player_id: numericId });
      if (data) {
        const shots: ShotData[] = data.map((row: any) => ({
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
    } catch {
      console.log('RPC fetch_player_shots failed, falling back to parallel queries');
    }

    const numericEntityId = parseInt(playerId);
    if (isNaN(numericEntityId)) {
      console.error(`🚀 ParallelDataService: Invalid player ID: ${playerId}`);
      return [];
    }

    const { count } = await (supabase as any)
      .from(tableName)
      .select('*', { count: 'exact', head: true })
      .eq('personId', numericEntityId);
    const total = count || 0;
    const batchSize = this.determineBatchSize(total);

    if (total > 0) {
      const { data: single } = await (supabase as any)
        .from(tableName)
        .select('*')
        .eq('personId', numericEntityId)
        .range(0, total - 1)
        .limit(total); // Explicitly set limit to total count
      if (single && single.length === total) {
        const shots: ShotData[] = single.map((row: any) => ({
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
        progressCallback?.(shots.length, shots.length);
        return shots;
      }
    }

    const promises: Promise<any>[] = [];
    for (let from = 0; from < total; from += batchSize) {
      const to = Math.min(total - 1, from + batchSize - 1);
      promises.push(
        (supabase as any)
          .from(tableName)
          .select('*')
          .eq('personId', numericEntityId)
          .range(from, to)
      );
    }
    const results = await Promise.all(promises);
    const allData: any[] = [];
    results.forEach(r => {
      const batch = r.data || [];
      allData.push(...batch);
      progressCallback?.(allData.length, total);
    });
    const shots: ShotData[] = allData.map((row: any) => ({
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
    const allData: ShotData[] = [];
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
            allData.push(...transformedData);
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