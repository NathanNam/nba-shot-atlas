import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { useShotData } from "@/hooks/useShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useMemo } from "react";

interface EntityStatisticsProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function EntityStatistics({ entityName, selectedSeason, viewMode }: EntityStatisticsProps) {
  const { players } = useAvailablePlayers(selectedSeason);
  
  // Convert player name to player ID for data fetching
  const getEntityId = () => {
    if (viewMode === 'player') {
      const player = players.find(p => p.name === entityName);
      return player?.id || entityName;
    }
    return entityName; // For teams, use the name directly
  };
  
  const entityId = getEntityId();
  const { shotData, loading, error } = useShotData(selectedSeason, entityId, viewMode);
  
  const calculatedStats = useMemo(() => {
    if (!shotData || shotData.length === 0) {
      return {
        totalShots: 0,
        madeShots: 0,
        fieldGoalPercentage: 0,
        twoPointPercentage: 0,
        threePointPercentage: 0,
        hottestZone: "No data",
        coldestZone: "No data",
        favoriteSpot: "No data"
      };
    }

    const totalShots = shotData.length;
    const madeShots = shotData.filter(shot => shot.shotResult === 'Made').length;
    const fieldGoalPercentage = madeShots / totalShots;

    // Calculate 2PT and 3PT percentages
    const twoPointShots = shotData.filter(shot => shot.shotValue === 2);
    const threePointShots = shotData.filter(shot => shot.shotValue === 3);
    
    const twoPointMade = twoPointShots.filter(shot => shot.shotResult === 'Made').length;
    const threePointMade = threePointShots.filter(shot => shot.shotResult === 'Made').length;
    
    const twoPointPercentage = twoPointShots.length > 0 ? twoPointMade / twoPointShots.length : 0;
    const threePointPercentage = threePointShots.length > 0 ? threePointMade / threePointShots.length : 0;

    // Zone analysis based on shot distance and location
    const zones = analyzeZones(shotData);
    
    return {
      totalShots,
      madeShots,
      fieldGoalPercentage,
      twoPointPercentage,
      threePointPercentage,
      hottestZone: zones.hottest,
      coldestZone: zones.coldest,
      favoriteSpot: zones.favorite
    };
  }, [shotData]);

  if (loading) {
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
  
  // Define zones based on shot distance and location
  shotData.forEach(shot => {
    let zone = "Unknown";
    
    const distance = shot.shotDistance;
    const x = shot.xLegacy;
    const y = shot.yLegacy;
    
    // Classify zones
    if (distance <= 5) {
      zone = "Paint Area";
    } else if (distance <= 10 && Math.abs(x) < 80) {
      zone = "Close Range";
    } else if (distance <= 16) {
      zone = "Mid Range";
    } else if (shot.shotValue === 3) {
      if (Math.abs(x) > 220 && y < 100) {
        if (x < 0) zone = "Left Corner 3";
        else zone = "Right Corner 3";
      } else if (x > 100) {
        zone = "Right Wing 3";
      } else if (x < -100) {
        zone = "Left Wing 3";
      } else {
        zone = "Top of Arc 3";
      }
    } else {
      if (x > 100) zone = "Right Elbow";
      else if (x < -100) zone = "Left Elbow";
      else zone = "Free Throw Line";
    }
    
    if (!zoneStats.has(zone)) {
      zoneStats.set(zone, { made: 0, total: 0, percentage: 0 });
    }
    
    const zoneData = zoneStats.get(zone)!;
    zoneData.total += 1;
    if (shot.shotResult === 'Made') {
      zoneData.made += 1;
    }
    zoneData.percentage = zoneData.made / zoneData.total;
  });
  
  // Find hottest, coldest, and favorite zones
  let hottestZone = "No data";
  let coldestZone = "No data";
  let favoriteSpot = "No data";
  
  let highestPercentage = 0;
  let lowestPercentage = 1;
  let mostAttempts = 0;
  
  zoneStats.forEach((stats, zone) => {
    if (stats.total >= 5) { // Only consider zones with at least 5 attempts
      if (stats.percentage > highestPercentage) {
        highestPercentage = stats.percentage;
        hottestZone = zone;
      }
      if (stats.percentage < lowestPercentage) {
        lowestPercentage = stats.percentage;
        coldestZone = zone;
      }
    }
    
    if (stats.total > mostAttempts) {
      mostAttempts = stats.total;
      favoriteSpot = zone;
    }
  });
  
  return {
    hottest: hottestZone,
    coldest: coldestZone,
    favorite: favoriteSpot
  };
}