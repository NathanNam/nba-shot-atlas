import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlayerStats {
  totalShots: number;
  madeShots: number;
  fieldGoalPercentage: number;
  twoPointMade: number;
  twoPointAttempted: number;
  twoPointPercentage: number;
  threePointMade: number;
  threePointAttempted: number;
  threePointPercentage: number;
}

interface ZoneStats {
  made: number;
  total: number;
  percentage: number;
}

interface ZoneAnalysis {
  hottestZone: string;
  hottestZoneStats: ZoneStats;
  coldestZone: string;
  coldestZoneStats: ZoneStats;
  favoriteSpot: string;
  favoriteSpotStats: ZoneStats;
}

interface FullPlayerStats extends PlayerStats, ZoneAnalysis {}

/**
 * Hook for consistent, direct database queries that bypass all caching layers
 * to ensure accurate, non-fluctuating statistics
 */
export function useConsistentPlayerStats(playerId: string, season: string) {
  const [stats, setStats] = useState<FullPlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConsistentStats() {
      if (!playerId || !season) return;

      try {
        setLoading(true);
        setError(null);

        console.log(`🎯 Direct database query for player ${playerId} season ${season}`);

        // Direct database query with no caching
        const { data: shots, error: dbError } = await (supabase as any)
          .from(`shots_${season}`)
          .select('*')
          .eq('personId', parseInt(playerId));

        if (dbError) {
          throw new Error(`Database error: ${dbError.message}`);
        }

        if (!shots) {
          throw new Error('No data returned from database');
        }

        console.log(`🎯 Direct query returned ${shots.length} shots for consistency check`);

        // Calculate stats directly from raw data
        const calculatedStats = calculateStatsFromRawData(shots);
        setStats(calculatedStats);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch stats';
        console.error('🎯 Consistent stats fetch error:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchConsistentStats();
  }, [playerId, season]);

  return { stats, loading, error };
}

function calculateStatsFromRawData(shots: any[]): FullPlayerStats {
  const totalShots = shots.length;
  let madeShots = 0;
  let twoPointMade = 0;
  let twoPointAttempted = 0;
  let threePointMade = 0;
  let threePointAttempted = 0;

  // Zone tracking
  const zoneStats = new Map<string, { made: number; total: number }>();

  shots.forEach(shot => {
    const made = shot.shotResult === 'Made' || shot.shotResult === 'MADE' || shot.shotResult === '1';
    if (made) madeShots++;

    const shotValue = parseInt(shot.shotValue) || 2;
    if (shotValue === 3) {
      threePointAttempted++;
      if (made) threePointMade++;
    } else {
      twoPointAttempted++;
      if (made) twoPointMade++;
    }

    // Zone analysis
    const zone = determineZone(shot);
    if (!zoneStats.has(zone)) {
      zoneStats.set(zone, { made: 0, total: 0 });
    }
    const zs = zoneStats.get(zone)!;
    zs.total++;
    if (made) zs.made++;
  });

  // Calculate percentages
  const fieldGoalPercentage = totalShots > 0 ? madeShots / totalShots : 0;
  const twoPointPercentage = twoPointAttempted > 0 ? twoPointMade / twoPointAttempted : 0;
  const threePointPercentage = threePointAttempted > 0 ? threePointMade / threePointAttempted : 0;

  // Analyze zones
  const zoneAnalysis = analyzeZones(zoneStats);

  console.log(`🎯 Calculated stats - Total: ${totalShots}, Made: ${madeShots}, 3PT: ${threePointMade}/${threePointAttempted}`);

  return {
    totalShots,
    madeShots,
    fieldGoalPercentage,
    twoPointMade,
    twoPointAttempted,
    twoPointPercentage,
    threePointMade,
    threePointAttempted,
    threePointPercentage,
    ...zoneAnalysis
  };
}

function determineZone(shot: any): string {
  const distance = parseFloat(shot.shotDistance) || 0;
  const x = parseFloat(shot.xLegacy) || 0;
  const y = parseFloat(shot.yLegacy) || 0;
  const shotValue = parseInt(shot.shotValue) || 2;

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
  } else if (shotValue === 3) {
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

function analyzeZones(zoneStats: Map<string, { made: number; total: number }>): ZoneAnalysis {
  let hottestZone = 'No data';
  let hottestZoneStats: ZoneStats = { made: 0, total: 0, percentage: 0 };
  let coldestZone = 'No data';
  let coldestZoneStats: ZoneStats = { made: 0, total: 0, percentage: 0 };
  let favoriteSpot = 'No data';
  let favoriteSpotStats: ZoneStats = { made: 0, total: 0, percentage: 0 };

  let highestPercentage = 0;
  let lowestPercentage = 1;
  let mostAttempts = 0;

  zoneStats.forEach((stats, zone) => {
    const percentage = stats.total > 0 ? stats.made / stats.total : 0;
    
    // Hottest zone (minimum 3 attempts)
    if (stats.total >= 3 && percentage > highestPercentage) {
      highestPercentage = percentage;
      hottestZone = zone;
      hottestZoneStats = { ...stats, percentage };
    }
    
    // Coldest zone (minimum 3 attempts)
    if (stats.total >= 3 && percentage < lowestPercentage) {
      lowestPercentage = percentage;
      coldestZone = zone;
      coldestZoneStats = { ...stats, percentage };
    }
    
    // Favorite spot (most attempts)
    if (stats.total > mostAttempts) {
      mostAttempts = stats.total;
      favoriteSpot = zone;
      favoriteSpotStats = { ...stats, percentage };
    }
  });

  return {
    hottestZone,
    hottestZoneStats,
    coldestZone,
    coldestZoneStats,
    favoriteSpot,
    favoriteSpotStats
  };
}