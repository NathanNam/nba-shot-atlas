import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { useSingletonShotData } from "@/hooks/useSingletonShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useConsistentPlayerStats } from "@/hooks/useConsistentPlayerStats";
import { useMemo } from "react";

interface EntityStatisticsProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
  preloadedData?: any[]; // Optional preloaded shot data
}

export function EntityStatistics({ entityName, selectedSeason, viewMode, preloadedData }: EntityStatisticsProps) {
  // Always call hook but only use results in player mode  
  console.log(`🔍 EntityStatistics: viewMode=${viewMode}, entityName=${entityName}`);
  const { players: rawPlayers, loading: rawLoading } = useAvailablePlayers();
  
  // Only use player data in player mode
  const players = viewMode === "player" ? rawPlayers : [];
  const playersLoading = viewMode === "player" ? rawLoading : false;
  
  // Extract clean entity name from display name (remove season info if present)
  const cleanEntityName = entityName.includes(' (') ? entityName.split(' (')[0] : entityName;
  
  // Memoize entityId to prevent unnecessary re-computations
  const entityId = useMemo(() => {
    if (viewMode === 'player') {
      if (playersLoading || !players || players.length === 0) {
        console.log(`🔍 EntityStatistics: Players still loading for "${cleanEntityName}"`);
        return undefined;
      }
      const player = players.find(p => p.name === cleanEntityName);
      console.log(`🔍 EntityStatistics: Looking for "${cleanEntityName}", found player:`, player);
      
      if (player) {
        const numericId = String(player.id);
        console.log(`🔍 EntityStatistics: Returning player ID: ${numericId} for player: ${cleanEntityName}`);
        return numericId;
      }
      
      console.warn(`🔍 EntityStatistics: Player "${cleanEntityName}" not found in players list`);
      return undefined;
    }
    
    // For teams/league, return the clean entity name directly
    return cleanEntityName;
  }, [viewMode, playersLoading, players, cleanEntityName]);
  
  // Create a stable key to prevent unnecessary re-subscriptions  
  const stableEntityId = entityId && (viewMode !== 'player' || !playersLoading) ? String(entityId) : '';
  
  console.log(`🔍 EntityStatistics: Component state - viewMode: ${viewMode}, entityName: ${entityName}, entityId: ${entityId}, stableEntityId: ${stableEntityId}, playersLoading: ${playersLoading}`);
  
  // Use consistent stats for Stephen Curry to fix data fluctuation issue
  const isStephenCurry = cleanEntityName === 'Stephen Curry' && viewMode === 'player';
  console.log(`🎯 EntityStatistics: Checking Stephen Curry - cleanEntityName: "${cleanEntityName}", viewMode: "${viewMode}", isStephenCurry: ${isStephenCurry}`);
  
  const consistentStats = useConsistentPlayerStats(
    isStephenCurry ? stableEntityId : '',
    isStephenCurry ? selectedSeason : ''
  );
  
  console.log(`🎯 EntityStatistics: Consistent stats hook result`, {
    isStephenCurry,
    stableEntityId,
    selectedSeason,
    loading: consistentStats.loading,
    error: consistentStats.error,
    hasStats: !!consistentStats.stats,
    stats: consistentStats.stats
  });
  
  // Always call the hook (rules of hooks), but use preloaded data if available
  const hookResult = useSingletonShotData(
    selectedSeason,
    stableEntityId,
    viewMode,
    preloadedData === undefined && !isStephenCurry
  );
  
  // Use consistent stats for Stephen Curry, preloaded data if available, otherwise use hook result
  const { shotData, loading, error } = isStephenCurry 
    ? { 
        shotData: [], // Force empty - we'll use consistent stats directly
        loading: consistentStats.loading, 
        error: consistentStats.error 
      }
    : preloadedData !== undefined 
    ? { shotData: preloadedData, loading: false, error: null }
    : hookResult;
    
  // Debug logging
  console.log(`🔍 EntityStatistics [${cleanEntityName}]: Data source and details`, {
    isStephenCurry,
    hasConsistentStats: !!consistentStats.stats,
    consistentStats: consistentStats.stats,
    hasPreloadedData: preloadedData !== undefined,
    preloadedLength: preloadedData?.length,
    hookLength: hookResult.shotData?.length,
    finalLength: shotData?.length,
    finalData: shotData?.slice(0, 3), // First 3 records
    loading,
    error
  });
  
  const calculatedStats = useMemo(() => {
    console.log(`🔢 EntityStatistics: Calculating stats for ${entityName}`, {
      isStephenCurry,
      hasConsistentStats: !!consistentStats.stats,
      shotDataLength: shotData?.length,
      playersLoading,
      entityId,
      stableEntityId,
      selectedSeason,
      loading,
      error,
      dataPreview: shotData?.slice(0, 2)
    });
    
    // ALWAYS use consistent stats for Stephen Curry when available - no fallback to calculated stats
    if (isStephenCurry && consistentStats.stats && !consistentStats.loading) {
      console.log(`🎯 ENTITY STATS: Using FINAL consistent stats for Stephen Curry:`, {
        totalShots: consistentStats.stats.totalShots,
        threePointMade: consistentStats.stats.threePointMade,
        threePointAttempted: consistentStats.stats.threePointAttempted,
        threePointPercentage: consistentStats.stats.threePointPercentage
      });
      return consistentStats.stats;
    }
    
    // For Stephen Curry, if we're still loading consistent stats, return loading state
    if (isStephenCurry && consistentStats.loading) {
      console.log(`🎯 ENTITY STATS: Stephen Curry consistent stats still loading, returning empty stats`);
      return {
        totalShots: 0,
        madeShots: 0,
        fieldGoalPercentage: 0,
        twoPointPercentage: 0,
        twoPointMade: 0,
        twoPointAttempted: 0,
        threePointPercentage: 0,
        threePointMade: 0,
        threePointAttempted: 0,
        hottestZone: "Loading...",
        hottestZoneStats: { made: 0, total: 0, percentage: 0 },
        coldestZone: "Loading...",
        coldestZoneStats: { made: 0, total: 0, percentage: 0 },
        favoriteSpot: "Loading...",
        favoriteSpotStats: { made: 0, total: 0, percentage: 0 }
      };
    }
    
    // Stephen Curry should NEVER reach this point if consistent stats are working
    if (isStephenCurry) {
      console.error(`🚨 ENTITY STATS: Stephen Curry reached fallback calculation! This should not happen!`, {
        hasConsistentStats: !!consistentStats.stats,
        consistentLoading: consistentStats.loading,
        consistentError: consistentStats.error
      });
    }
    
    if (!shotData || shotData.length === 0 || (viewMode === 'player' && playersLoading) || !entityId) {
      return {
        totalShots: 0,
        madeShots: 0,
        fieldGoalPercentage: 0,
        twoPointPercentage: 0,
        twoPointMade: 0,
        twoPointAttempted: 0,
        threePointPercentage: 0,
        threePointMade: 0,
        threePointAttempted: 0,
        hottestZone: "No data",
        coldestZone: "No data",
        favoriteSpot: "No data"
      };
    }

    const totalShots = shotData.length;

    // Initialize accumulator
    let madeShots = 0;
    let twoPointAttempted = 0;
    let twoPointMade = 0;
    let threePointAttempted = 0;
    let threePointMade = 0;
    const zoneStats = new Map<string, { made: number; total: number; percentage: number }>();

    // Process each shot
    shotData.forEach(shot => {
      // Determine if the shot was made
      const result = shot.shotResult;
      const made = result === 'Made' || result === 'MADE' || result === '1';

      if (made) {
        madeShots += 1;
      }

      // Count 2PT/3PT attempts and makes
      if (shot.shotValue === 2) {
        twoPointAttempted += 1;
        if (made) twoPointMade += 1;
      } else if (shot.shotValue === 3) {
        threePointAttempted += 1;
        if (made) threePointMade += 1;
      }

      // Zone classification (formerly analyzeZones)
      let zone = "Unknown";
      const distance = shot.shotDistance;
      const x = shot.xLegacy;
      const y = shot.yLegacy;

      if (distance <= 3) {
        zone = "Restricted Area";
      } else if (distance <= 8) {
        zone = "Paint";
      } else if (distance <= 16) {
        if (Math.abs(x) <= 80) {
          zone = "Mid Range Center";
        } else {
          zone = Math.abs(x) > 150 ? "Mid Range Wing" : "Mid Range";
        }
      } else if (shot.shotValue === 3) {
        if (y <= 100 && Math.abs(x) >= 220) {
          zone = x < 0 ? "Left Corner 3" : "Right Corner 3";
        } else if (Math.abs(x) <= 80) {
          zone = "Above Break 3 Center";
        } else if (Math.abs(x) <= 160) {
          zone = x < 0 ? "Above Break 3 Left" : "Above Break 3 Right";
        } else {
          zone = x < 0 ? "Left Wing 3" : "Right Wing 3";
        }
      } else {
        if (Math.abs(x) <= 80) {
          zone = "Long 2 Center";
        } else {
          zone = x < 0 ? "Left Elbow" : "Right Elbow";
        }
      }

      const zoneData = zoneStats.get(zone) || { made: 0, total: 0, percentage: 0 };
      zoneData.total += 1;
      if (made) zoneData.made += 1;
      zoneData.percentage = zoneData.total > 0 ? zoneData.made / zoneData.total : 0;
      zoneStats.set(zone, zoneData);
    });

    const fieldGoalPercentage = totalShots > 0 ? madeShots / totalShots : 0;
    const twoPointPercentage =
      twoPointAttempted > 0 ? twoPointMade / twoPointAttempted : 0;
    const threePointPercentage =
      threePointAttempted > 0 ? threePointMade / threePointAttempted : 0;

    // Debug output for 3PT calculation
    console.log(`🏀 3PT Analysis for ${entityName}:`, {
      threePointMade: threePointMade,
      threePointAttempted: threePointAttempted,
      threePointPercentage: (threePointPercentage * 100).toFixed(1) + '%',
      calculation: `${threePointMade}/${threePointAttempted} = ${(threePointPercentage * 100).toFixed(1)}%`
    });

    // Determine hottest, coldest and favorite zones from accumulated stats
    let hottestZone = "No data";
    let hottestZoneStats = { made: 0, total: 0, percentage: 0 };
    let coldestZone = "No data";
    let coldestZoneStats = { made: 0, total: 0, percentage: 0 };
    let favoriteSpot = "No data";
    let favoriteSpotStats = { made: 0, total: 0, percentage: 0 };

    let highestPercentage = 0;
    let lowestPercentage = 1;
    let mostAttempts = 0;

    zoneStats.forEach((stats, zone) => {
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
      totalShots,
      madeShots: madeShots,
      fieldGoalPercentage,
      twoPointPercentage,
      twoPointMade: twoPointMade,
      twoPointAttempted: twoPointAttempted,
      threePointPercentage,
      threePointMade: threePointMade,
      threePointAttempted: threePointAttempted,
      hottestZone,
      hottestZoneStats,
      coldestZone,
      coldestZoneStats,
      favoriteSpot,
      favoriteSpotStats
    };
  }, [shotData, entityName, playersLoading, entityId, selectedSeason, isStephenCurry, consistentStats.stats]);

  // Show loading while fetching players (player mode only) or shot data, or consistent stats for Stephen Curry
  const isLoadingConsistentStats = isStephenCurry && consistentStats.loading;
  const shouldShowLoading = loading || (viewMode === 'player' && playersLoading) || !entityId || isLoadingConsistentStats;
  
  if (shouldShowLoading) {
    return (
      <div className="p-6 bg-card border-border shadow-card rounded-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-card border-border shadow-card rounded-lg">
        <p className="text-destructive text-center">Error loading statistics: {error}</p>
      </div>
    );
  }

  // Don't add season if it's already in the entityName
  const displayName = entityName.includes('(') ? entityName : `${entityName} (${selectedSeason})`;
  return <StatisticsPanel entityName={displayName} stats={calculatedStats} />;
}