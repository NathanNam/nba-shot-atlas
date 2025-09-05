import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { useSingletonShotData } from "@/hooks/useSingletonShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useMemo } from "react";

interface EntityStatisticsProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function EntityStatistics({ entityName, selectedSeason, viewMode }: EntityStatisticsProps) {
  // Only fetch players for player mode to improve performance
  const { players, loading: playersLoading } = useAvailablePlayers(viewMode === 'player' ? selectedSeason : '');
  
  // Extract clean entity name from display name (remove season info if present)
  const cleanEntityName = entityName.includes(' (') ? entityName.split(' (')[0] : entityName;
  
  // Memoize entityId to prevent unnecessary re-computations
  const entityId = useMemo(() => {
    if (viewMode === 'player') {
      if (playersLoading) {
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
  
  // Only call the hook when we have a valid entityId (after player loading is complete)
  const { shotData, loading, error } = useSingletonShotData(
    selectedSeason, 
    stableEntityId,
    viewMode
  );
  
  const calculatedStats = useMemo(() => {
    console.log(`🔢 EntityStatistics: Calculating stats for ${entityName}`, {
      shotDataLength: shotData?.length,
      playersLoading,
      entityId,
      stableEntityId,
      selectedSeason,
      loading,
      error,
      dataPreview: shotData?.slice(0, 2)
    });
    
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
    
    // More robust shot result checking - check both parsed and raw formats
    const madeShots = shotData.filter(shot => {
      const result = shot.shotResult;
      // Check for various formats: 'Made', 'MADE', '1'
      return result === 'Made' || result === 'MADE' || result === '1';
    }).length;
    
    const fieldGoalPercentage = totalShots > 0 ? madeShots / totalShots : 0;

    // Calculate 2PT and 3PT percentages
    const twoPointShots = shotData.filter(shot => shot.shotValue === 2);
    const threePointShots = shotData.filter(shot => shot.shotValue === 3);
    
    const twoPointMade = twoPointShots.filter(shot => {
      const result = shot.shotResult;
      return result === 'Made' || result === 'MADE' || result === '1';
    }).length;
    
    const threePointMade = threePointShots.filter(shot => {
      const result = shot.shotResult;
      return result === 'Made' || result === 'MADE' || result === '1';
    }).length;
    
    const twoPointPercentage = twoPointShots.length > 0 ? twoPointMade / twoPointShots.length : 0;
    const threePointPercentage = threePointShots.length > 0 ? threePointMade / threePointShots.length : 0;

    // Debug output for 3PT calculation
    console.log(`🏀 3PT Analysis for ${entityName}:`, {
      threePointMade,
      threePointAttempted: threePointShots.length,
      threePointPercentage: (threePointPercentage * 100).toFixed(1) + '%',
      calculation: `${threePointMade}/${threePointShots.length} = ${(threePointPercentage * 100).toFixed(1)}%`
    });

    // Zone analysis based on shot distance and location
    const zones = analyzeZones(shotData);
    
    return {
      totalShots,
      madeShots,
      fieldGoalPercentage,
      twoPointPercentage,
      twoPointMade,
      twoPointAttempted: twoPointShots.length,
      threePointPercentage,
      threePointMade,
      threePointAttempted: threePointShots.length,
      hottestZone: zones.hottestZone,
      hottestZoneStats: zones.hottestZoneStats,
      coldestZone: zones.coldestZone,
      coldestZoneStats: zones.coldestZoneStats,
      favoriteSpot: zones.favoriteSpot,
      favoriteSpotStats: zones.favoriteSpotStats
    };
  }, [shotData, entityName, playersLoading, entityId, selectedSeason]);

  // Show loading while fetching players (player mode only) or shot data
  if (loading || (viewMode === 'player' && playersLoading) || !entityId) {
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

  return <StatisticsPanel entityName={`${entityName} (${selectedSeason})`} stats={calculatedStats} />;
}

// Helper function to analyze shooting zones
function analyzeZones(shotData: any[]) {
  const zoneStats = new Map<string, { made: number; total: number; percentage: number }>();
  
  console.log(`🏀 Zone analysis for ${shotData.length} shots`);
  
  // Define zones based on NBA court coordinates (x: -250 to 250, y: -50 to 400+)
  shotData.forEach(shot => {
    let zone = "Unknown";
    
    const distance = shot.shotDistance;
    const x = shot.xLegacy; // Court width: -250 to 250
    const y = shot.yLegacy; // Court length: -50 to 400+
    
    // NBA court zone classification
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
      // 3-point zones
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
      // Long 2-pointers
      if (Math.abs(x) <= 80) {
        zone = "Long 2 Center";
      } else {
        zone = x < 0 ? "Left Elbow" : "Right Elbow";
      }
    }
    
    if (!zoneStats.has(zone)) {
      zoneStats.set(zone, { made: 0, total: 0, percentage: 0 });
    }
    
    const zoneData = zoneStats.get(zone)!;
    zoneData.total += 1;
    
    // More robust shot result checking
    const result = shot.shotResult;
    if (result === 'Made' || result === 'MADE' || result === '1') {
      zoneData.made += 1;
    }
    zoneData.percentage = zoneData.total > 0 ? zoneData.made / zoneData.total : 0;
  });
  
  // Debug zone statistics
  console.log('🏀 Zone breakdown:');
  Array.from(zoneStats.entries())
    .sort(([,a], [,b]) => b.total - a.total)
    .slice(0, 5)
    .forEach(([zone, stats]) => {
      console.log(`  ${zone}: ${stats.made}/${stats.total} (${(stats.percentage * 100).toFixed(1)}%)`);
    });
  
  // Find hottest, coldest, and favorite zones with detailed stats
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
    // Only consider zones with at least 3 attempts (lowered threshold)
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
  
  console.log(`🏀 Zone results: Hottest: ${hottestZone}, Coldest: ${coldestZone}, Favorite: ${favoriteSpot}`);
  
  return {
    hottestZone: hottestZone,
    hottestZoneStats: hottestZoneStats,
    coldestZone: coldestZone,
    coldestZoneStats: coldestZoneStats,
    favoriteSpot: favoriteSpot,
    favoriteSpotStats: favoriteSpotStats
  };
}