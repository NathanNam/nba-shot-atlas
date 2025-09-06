import { useState, useEffect, useMemo } from 'react';
import { ShotData } from '@/services/supabaseDataService';
import { ParallelDataService } from '@/services/parallelDataService';

export interface BatchRequest {
  season: string;
  entityId: string;
  viewMode: 'player' | 'team' | 'league';
  key: string;
}

export interface BatchResult {
  [key: string]: {
    data: ShotData[];
    loading: boolean;
    error: string | null;
  };
}

export function useBatchShotData(requests: BatchRequest[]) {
  const [results, setResults] = useState<BatchResult>({});
  
  // Create a stable key for the requests to prevent unnecessary re-fetches
  const requestsKey = useMemo(() => {
    return requests.map(r => r.key).sort().join('|');
  }, [requests]);

  useEffect(() => {
    if (requests.length === 0) {
      setResults({});
      return;
    }

    console.log(`🚀 useBatchShotData: Starting batch fetch for ${requests.length} requests`);

    // Initialize all results as loading
    const initialResults: BatchResult = {};
    requests.forEach(req => {
      initialResults[req.key] = {
        data: [],
        loading: true,
        error: null
      };
    });
    setResults(initialResults);

    // Create parallel promises for all requests
    const fetchPromises = requests.map(async (req) => {
      try {
        console.log(`🚀 useBatchShotData: Fetching ${req.key}`);
        const data = await ParallelDataService.getDataParallel(
          req.season,
          req.entityId,
          req.viewMode
        );
        
        return {
          key: req.key,
          data,
          loading: false,
          error: null
        };
      } catch (error) {
        console.error(`❌ useBatchShotData: Error fetching ${req.key}:`, error);
        return {
          key: req.key,
          data: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch data'
        };
      }
    });

    // Execute all requests in parallel
    Promise.allSettled(fetchPromises).then((results) => {
      const newResults: BatchResult = {};
      
      results.forEach((result, index) => {
        const request = requests[index];
        
        if (result.status === 'fulfilled') {
          newResults[result.value.key] = result.value;
        } else {
          newResults[request.key] = {
            data: [],
            loading: false,
            error: result.reason?.message || 'Failed to fetch data'
          };
        }
      });

      console.log(`✅ useBatchShotData: Completed batch fetch`, {
        successful: Object.values(newResults).filter(r => !r.error).length,
        failed: Object.values(newResults).filter(r => r.error).length
      });

      setResults(newResults);
    });

  }, [requestsKey]); // Only re-run when the requests actually change

  return results;
}