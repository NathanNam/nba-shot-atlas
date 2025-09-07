import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { SupabaseDataService, ShotData } from '@/services/supabaseDataService';
import { useAvailablePlayers } from './useAvailablePlayers';

interface ZoneStats {
  made: number;
  total: number;
  percentage: number;
}

interface EntityStats {
  fieldGoalPercentage: number;
  twoPointPercentage: number;
  twoPointMade: number;
  twoPointAttempted: number;
  threePointPercentage: number;
  threePointMade: number;
  threePointAttempted: number;
  totalShots: number;
  madeShots: number;
  hottestZone: string;
  hottestZoneStats: ZoneStats;
  coldestZone: string;
  coldestZoneStats: ZoneStats;
  favoriteSpot: string;
  favoriteSpotStats: ZoneStats;
}

interface ComparisonResult {
  name: string;
  stats: EntityStats;
}

export function useEntityComparisonData(
  entities: string[],
  selectedSeason: string,
  viewMode: 'player' | 'team' | 'league'
) {
  const { players, loading: playersLoading } = useAvailablePlayers();

  const entityIds = useMemo(() => {
    return entities.map(name => {
      if (viewMode === 'player') {
        const player = players.find(p => p.name === name);
        return player?.id;
      }
      return name;
    });
  }, [entities, players, viewMode]);

  const queries = useQueries({
    queries: entityIds.map(entityId => ({
      queryKey: ['entity-comparison', selectedSeason, viewMode, entityId],
      queryFn: () => SupabaseDataService.getShotData(selectedSeason, entityId!, viewMode),
      enabled: Boolean(entityId) && (viewMode !== 'player' || !playersLoading),
    })),
  });

  const isLoading =
    playersLoading || queries.some(q => q.isLoading || q.isPending);
  const isError = queries.some(q => q.isError);

  const statsData = useMemo<ComparisonResult[]>(() => {
    return queries.reduce<ComparisonResult[]>((acc, query, index) => {
      const shotData = (query.data as ShotData[]) || [];
      const stats = computeStats(shotData);
      acc.push({ name: entities[index], stats });
      return acc;
    }, []);
  }, [queries, entities]);

  return { statsData, isLoading, isError };
}

function computeStats(data: ShotData[]): EntityStats {
  const initial = {
    totalShots: 0,
    madeShots: 0,
    twoPointMade: 0,
    twoPointAttempted: 0,
    threePointMade: 0,
    threePointAttempted: 0,
    zoneStats: new Map<string, ZoneStats>(),
  };

  const result = data.reduce((acc, shot) => {
    acc.totalShots += 1;

    const made =
      shot.shotResult === 'Made' ||
      shot.shotResult === 'MADE' ||
      shot.shotResult === '1';
    if (made) acc.madeShots += 1;

    if (shot.shotValue === 3) {
      acc.threePointAttempted += 1;
      if (made) acc.threePointMade += 1;
    } else {
      acc.twoPointAttempted += 1;
      if (made) acc.twoPointMade += 1;
    }

    const zone = determineZone(shot);
    if (!acc.zoneStats.has(zone)) {
      acc.zoneStats.set(zone, { made: 0, total: 0, percentage: 0 });
    }
    const zs = acc.zoneStats.get(zone)!;
    zs.total += 1;
    if (made) zs.made += 1;
    return acc;
  }, initial);

  let hottestZone = 'No data';
  let hottestZoneStats: ZoneStats = { made: 0, total: 0, percentage: 0 };
  let coldestZone = 'No data';
  let coldestZoneStats: ZoneStats = { made: 0, total: 0, percentage: 0 };
  let favoriteSpot = 'No data';
  let favoriteSpotStats: ZoneStats = { made: 0, total: 0, percentage: 0 };
  let highestPercentage = 0;
  let lowestPercentage = 1;
  let mostAttempts = 0;

  result.zoneStats.forEach((stats, zone) => {
    stats.percentage = stats.total > 0 ? stats.made / stats.total : 0;
    if (stats.total >= 3) {
      if (stats.percentage > highestPercentage) {
        highestPercentage = stats.percentage;
        hottestZone = zone;
        hottestZoneStats = { ...stats };
      }
      if (stats.percentage < lowestPercentage) {
        lowestPercentage = stats.percentage;
        coldestZone = zone;
        coldestZoneStats = { ...stats };
      }
    }
    if (stats.total > mostAttempts) {
      mostAttempts = stats.total;
      favoriteSpot = zone;
      favoriteSpotStats = { ...stats };
    }
  });

  return {
    fieldGoalPercentage:
      result.totalShots > 0 ? result.madeShots / result.totalShots : 0,
    twoPointPercentage:
      result.twoPointAttempted > 0
        ? result.twoPointMade / result.twoPointAttempted
        : 0,
    twoPointMade: result.twoPointMade,
    twoPointAttempted: result.twoPointAttempted,
    threePointPercentage:
      result.threePointAttempted > 0
        ? result.threePointMade / result.threePointAttempted
        : 0,
    threePointMade: result.threePointMade,
    threePointAttempted: result.threePointAttempted,
    totalShots: result.totalShots,
    madeShots: result.madeShots,
    hottestZone,
    hottestZoneStats,
    coldestZone,
    coldestZoneStats,
    favoriteSpot,
    favoriteSpotStats,
  };
}

function determineZone(shot: ShotData): string {
  const distance = shot.shotDistance;
  const x = shot.xLegacy;
  const y = shot.yLegacy;

  if (distance <= 3) {
    return 'Restricted Area';
  } else if (distance <= 8) {
    return 'Paint';
  } else if (distance <= 16) {
    if (Math.abs(x) <= 80) {
      return 'Mid Range Center';
    } else {
      return Math.abs(x) > 150 ? 'Mid Range Wing' : 'Mid Range';
    }
  } else if (shot.shotValue === 3) {
    if (y <= 100 && Math.abs(x) >= 220) {
      return x < 0 ? 'Left Corner 3' : 'Right Corner 3';
    } else if (Math.abs(x) <= 80) {
      return 'Above Break 3 Center';
    } else if (Math.abs(x) <= 160) {
      return x < 0 ? 'Above Break 3 Left' : 'Above Break 3 Right';
    } else {
      return x < 0 ? 'Left Wing 3' : 'Right Wing 3';
    }
  } else {
    if (Math.abs(x) <= 80) {
      return 'Long 2 Center';
    } else {
      return x < 0 ? 'Left Elbow' : 'Right Elbow';
    }
  }
}

