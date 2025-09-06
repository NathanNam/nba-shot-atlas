import { useMemo } from 'react';
import { useAvailablePlayers } from '@/hooks/useAvailablePlayers';
import { useBatchShotData, BatchResult } from '@/hooks/useBatchShotData';

interface Params {
  entity1: string;
  entity2: string;
  season1: string;
  season2: string;
  viewMode: 'player' | 'team';
  enabled?: boolean;
}

export function useComparisonBatchShotData({
  entity1,
  entity2,
  season1,
  season2,
  viewMode,
  enabled = true,
}: Params) {
  // Always call hook but only use results in player mode
  const { players: rawPlayers, loading: rawLoading } = useAvailablePlayers();
  
  const players = viewMode === 'player' ? rawPlayers : [];
  const playersLoading = viewMode === 'player' ? rawLoading : false;

  const getEntityId = (entityName: string) => {
    if (viewMode === 'team') {
      return entityName;
    }
    const cleanName = entityName.includes(' (') ? entityName.split(' (')[0] : entityName;
    const player = players.find((p) => p.name === cleanName);
    return player?.id?.toString();
  };

  const entity1Id = getEntityId(entity1);
  const entity2Id = getEntityId(entity2);

  const requests = useMemo(() => {
    if (!enabled || playersLoading || !entity1Id || !entity2Id) {
      return [];
    }
    return [
      { season: season1, entityId: entity1Id, viewMode, key: `${entity1}_${season1}` },
      { season: season1, entityId: entity2Id, viewMode, key: `${entity2}_${season1}` },
      { season: season2, entityId: entity1Id, viewMode, key: `${entity1}_${season2}` },
      { season: season2, entityId: entity2Id, viewMode, key: `${entity2}_${season2}` },
    ];
  }, [enabled, playersLoading, entity1Id, entity2Id, season1, season2, viewMode, entity1, entity2]);

  const batchResults: BatchResult = useBatchShotData(enabled ? requests : []);

  const isLoading =
    !enabled ||
    playersLoading ||
    requests.length === 0 ||
    Object.values(batchResults).some((r) => r?.loading);

  const hasError = Object.values(batchResults).some((r) => r?.error);

  return { batchResults, isLoading, hasError };
}
