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
    
    // First, get total count
    let totalCount = 0;
    try {
      const { count } = await (supabase as any)
        .from(tableName)
        .select('*', { count: 'estimated', head: true });
      totalCount = count || 0;
      console.log(`🚀 ParallelDataService: Estimated ${totalCount} total records`);
    } catch (error) {
      console.log('Could not get count estimate:', error);
    }

    // For league mode with large datasets, use sampling instead
    if (viewMode === 'league' && totalCount > 50000) {
      console.log(`🚀 ParallelDataService: Large dataset detected (${totalCount}), using sampling approach`);
      return this.getSampledData(season, entityId, viewMode);
    }

    const batchSize = 1000;
    const maxConcurrent = 5; // Limit concurrent requests to avoid overwhelming the server
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

        // Apply filters
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
   * Get sampled data for large datasets (like league view)
   */
  private static async getSampledData(
    season: string,
    entityId?: string,
    viewMode: 'player' | 'team' | 'league' = 'league'
  ): Promise<ShotData[]> {
    try {
      const response = await fetch('https://icfqngdeohzzjvzcmawo.supabase.co/functions/v1/get-shot-samples', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZnFuZ2Rlb2h6emp2emNtYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjY3NTgsImV4cCI6MjA3MjYwMjc1OH0.NQfIrtGzH60IwDJ0VJEq4XyLq36HHI2y9CyWZ9aLmNE`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          season,
          sampleSize: 10000, // Get 10k representative samples
          entityId,
          viewMode
        }),
      });

      if (!response.ok) {
        throw new Error(`Edge function error: ${response.status}`);
      }

      const result = await response.json();
      console.log(`🚀 ParallelDataService: Got ${result.shots.length} sampled shots`);
      
      return result.shots;
    } catch (error) {
      console.error('Error getting sampled data:', error);
      // Fallback to regular fetching with a smaller limit
      return this.getFallbackData(season, entityId, viewMode);
    }
  }

  /**
   * Fallback method for when other approaches fail
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
      .limit(5000); // Limit to 5000 for fallback

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