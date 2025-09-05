import { useState, useEffect } from 'react';
import { useSupabaseShotData } from './useSupabaseShotData';

export interface MultiSeasonData {
  season1: {
    season: string;
    data: any[];
    loading: boolean;
    error: string | null;
  };
  season2?: {
    season: string;
    data: any[];
    loading: boolean;
    error: string | null;
  };
}

export function useMultiSeasonData(
  season1: string,
  season2: string | null,
  entityId1: string,
  entityId2: string,
  viewMode: 'player' | 'team' | 'league'
) {
  const season1Data = useSupabaseShotData(season1, entityId1, viewMode);
  const season2Data = useSupabaseShotData(season2 || '', entityId2, viewMode);

  const [multiSeasonData, setMultiSeasonData] = useState<MultiSeasonData>({
    season1: {
      season: season1,
      data: [],
      loading: true,
      error: null
    }
  });

  useEffect(() => {
    const newData: MultiSeasonData = {
      season1: {
        season: season1,
        data: season1Data.shotData,
        loading: season1Data.loading,
        error: season1Data.error
      }
    };

    if (season2) {
      newData.season2 = {
        season: season2,
        data: season2Data.shotData,
        loading: season2Data.loading,
        error: season2Data.error
      };
    }

    setMultiSeasonData(newData);
  }, [season1, season2, season1Data, season2Data]);

  return multiSeasonData;
}