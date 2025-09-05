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
    
    // First, get total count with filters applied
    let totalCount = 0;
    try {
      let countQuery = (supabase as any)
        .from(tableName)
        .select('*', { count: 'estimated', head: true });
        
      // Apply filters for count estimation
      if (viewMode === 'player' && entityId) {
        const numericEntityId = parseInt(entityId);
        if (!isNaN(numericEntityId)) {
          countQuery = countQuery.eq('personId', numericEntityId);
        }
      } else if (viewMode === 'team' && entityId) {
        countQuery = countQuery.eq('teamTricode', entityId);
      }
      
      const { count } = await countQuery;
      totalCount = count || 0;
      console.log(`🚀 ParallelDataService: Estimated ${totalCount} total records for ${viewMode} - ${entityId || 'all'}`);
    } catch (error) {
      console.log('Could not get count estimate:', error);
      totalCount = 10000; // Fallback estimate for player/team
    }

    // Use parallel fetching for all datasets - no sampling
    console.log(`🚀 ParallelDataService: Using parallel fetching for ${totalCount} records`);
    
    const batchSize = 1000;
    const maxConcurrent = 8; // Increased concurrent requests for better performance
    const totalBatches = Math.ceil(totalCount / batchSize);
    
    console.log(`🚀 ParallelDataService: Will fetch ${totalBatches} batches of ${batchSize} records each`);

    const allData: any[] = [];
    let processedBatches = 0;

    // Process batches in chunks to limit concurrent requests
    for (let chunkStart = 0; chunkStart < totalBatches; chunkStart += maxConcurrent) {
      const chunkEnd = Math.min(chunkStart + maxConcurrent, totalBatches);
      const batchPromises = [];

      // Create promises for this chunk of batches
      for (let batchIndex = chunkStart; batchIndex < chunkEnd; batchIndex++) {
        const offset = batchIndex * batchSize;
        
        let query = (supabase as any)
          .from(tableName)
          .select('*')
          .range(offset, offset + batchSize - 1);

        // Apply filters for player/team modes
        if (viewMode === 'player' && entityId) {
          const numericEntityId = parseInt(entityId);
          if (!isNaN(numericEntityId)) {
            query = query.eq('personId', numericEntityId);
          }
        } else if (viewMode === 'team' && entityId) {
          query = query.eq('teamTricode', entityId);
        }

        batchPromises.push(
          query.then((result: any) => ({
            batchIndex,
            data: result.data || [],
            error: result.error
          }))
        );
      }

      // Wait for this chunk to complete
      const chunkResults = await Promise.all(batchPromises);
      
      // Process results
      for (const result of chunkResults) {
        if (result.error) {
          console.error(`Error in batch ${result.batchIndex}:`, result.error);
        } else {
          allData.push(...result.data);
          processedBatches++;
          
          // Report progress
          if (progressCallback) {
            progressCallback(allData.length, totalCount);
          }
          
          console.log(`🚀 ParallelDataService: Completed batch ${result.batchIndex + 1}/${totalBatches}, total records: ${allData.length}`);
        }
      }
    }

    console.log(`🚀 ParallelDataService: Parallel fetch complete. Got ${allData.length} total records`);

    // Transform data
    const shots: ShotData[] = allData.map(row => ({
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