import { useState, useEffect } from 'react';
import { dataCache, PreloadedEntry } from '@/services/dataCache';

export function usePreloadedData() {
  const [preloadedEntries, setPreloadedEntries] = useState<PreloadedEntry[]>([]);
  const [isDefaultDataReady, setIsDefaultDataReady] = useState(false);

  useEffect(() => {
    // Check initial state
    const updateState = () => {
      setPreloadedEntries(dataCache.getAllPreloaded());
      setIsDefaultDataReady(dataCache.isDefaultDataReady());
    };

    updateState();

    // Set up periodic check for preloaded data
    const interval = setInterval(updateState, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    preloadedEntries,
    isDefaultDataReady,
    getPreloaded: (key: string) => dataCache.getPreloaded(key),
    cacheStats: dataCache.getStats()
  };
}