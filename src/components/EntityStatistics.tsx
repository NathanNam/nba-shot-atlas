import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { useSupabaseShotData } from "@/hooks/useSupabaseShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useMemo } from "react";

interface EntityStatisticsProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function EntityStatistics({ entityName, selectedSeason, viewMode }: EntityStatisticsProps) {
  const { players, loading: playersLoading } = useAvailablePlayers(selectedSeason);
  
  // Convert player name to player ID for data fetching
  const getEntityId = () => {
    if (viewMode === 'player') {
      if (playersLoading) {
        // Return undefined while loading to prevent data fetching with incorrect ID
        return undefined;
      }
      const player = players.find(p => p.name === entityName);
      console.log(`🔍 EntityStatistics: Looking for "${entityName}", found player:`, player);
      return player?.id || entityName;
    }
    return entityName; // For teams, use the name directly
  };
  
  const entityId = getEntityId();
  const { shotData, loading, error } = useSupabaseShotData(selectedSeason, entityId || '', viewMode);
  
  const calculatedStats = useMemo(() => {
  if (!shotData || shotData.length === 0 || playersLoading || !entityId) {
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

    console.log(`📊 Statistics calculation for ${entityName}:`, {
      totalShots: shotData.length,
      actualDataLength: shotData.length,
      sampleShots: shotData.slice(0, 10).map(s => ({ 
        result: s.shotResult, 
        value: s.shotValue,
        distance: s.shotDistance 
      })),
      // Check for different shot result values in the data
      uniqueResults: [...new Set(shotData.slice(0, 100).map(s => s.shotResult))],
      // Add more debugging info
      isExactly1000: shotData.length === 1000,
      lastFewShots: shotData.slice(-5).map(s => ({ 
        personId: s.personId,
        shotResult: s.shotResult,
        shotValue: s.shotValue
      }))
    });

    const totalShots = shotData.length;
    
    // More robust shot result checking - check both parsed and raw formats
    const madeShots = shotData.filter(shot => {
      const result = shot.shotResult;
      // Check for various formats: 'Made', 'MADE', '1'
      return result === 'Made' || result === 'MADE' || result === '1';
    }).length;
    
    console.log(`📊 Made shots calculation: ${madeShots} of ${totalShots}`);
    
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
  }, [shotData, entityName, playersLoading, entityId]);

  if (loading || playersLoading || !entityId) {
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

  return <StatisticsPanel entityName={entityName} stats={calculatedStats} />;
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