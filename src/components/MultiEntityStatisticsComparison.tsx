import { useSupabaseShotData } from "@/hooks/useSupabaseShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Target, Zap, Heart } from "lucide-react";

interface MultiEntityStatisticsComparisonProps {
  entities: string[];
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function MultiEntityStatisticsComparison({ entities, selectedSeason, viewMode }: MultiEntityStatisticsComparisonProps) {
  const { players, loading: playersLoading } = viewMode === "player" ? useAvailablePlayers() : { players: [], loading: false };
  
  // Get entity data for all entities
  const entityData = entities.map(entityName => {
    const getEntityId = () => {
      if (viewMode === 'player') {
        if (playersLoading || !players.length) return undefined;
        const player = players.find(p => p.name === entityName);
        return player?.id || entityName;
      }
      return entityName;
    };

    const entityId = getEntityId();
    const { shotData, loading, error } = useSupabaseShotData(selectedSeason, entityId || '', viewMode);
    
    return {
      name: entityName,
      entityId,
      shotData,
      loading,
      error
    };
  });

  // Helper function to analyze shooting zones
  const analyzeZones = (shotData: any[]) => {
    const zoneStats = new Map<string, { made: number; total: number; percentage: number }>();
    
    if (shotData.length === 0) {
      return {
        hottestZone: "No data",
        hottestZoneStats: { made: 0, total: 0, percentage: 0 },
        coldestZone: "No data", 
        coldestZoneStats: { made: 0, total: 0, percentage: 0 },
        favoriteSpot: "No data",
        favoriteSpotStats: { made: 0, total: 0, percentage: 0 }
      };
    }
    
    // Define zones based on NBA court coordinates
    shotData.forEach(shot => {
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
      
      if (!zoneStats.has(zone)) {
        zoneStats.set(zone, { made: 0, total: 0, percentage: 0 });
      }
      
      const zoneData = zoneStats.get(zone)!;
      zoneData.total += 1;
      
      const result = shot.shotResult;
      if (result === 'Made' || result === 'MADE' || result === '1') {
        zoneData.made += 1;
      }
      zoneData.percentage = zoneData.total > 0 ? zoneData.made / zoneData.total : 0;
    });
    
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
      hottestZone,
      hottestZoneStats,
      coldestZone,
      coldestZoneStats,
      favoriteSpot,
      favoriteSpotStats
    };
  };

  // Calculate statistics for each entity
  const calculateStats = (data: any[]) => {
    const totalShots = data.length;
    
    const madeShots = data.filter(shot => {
      const result = shot.shotResult;
      return result === 'Made' || result === 'MADE' || result === '1';
    }).length;
    
    const threePointers = data.filter(shot => shot.shotValue === 3);
    const twoPointers = data.filter(shot => shot.shotValue === 2);
    
    const made3PT = threePointers.filter(shot => {
      const result = shot.shotResult;
      return result === 'Made' || result === 'MADE' || result === '1';
    }).length;
    
    const made2PT = twoPointers.filter(shot => {
      const result = shot.shotResult;
      return result === 'Made' || result === 'MADE' || result === '1';
    }).length;

    const zoneAnalysis = analyzeZones(data);

    return {
      fieldGoalPercentage: totalShots > 0 ? (madeShots / totalShots) : 0,
      twoPointPercentage: twoPointers.length > 0 ? (made2PT / twoPointers.length) : 0,
      twoPointMade: made2PT,
      twoPointAttempted: twoPointers.length,
      threePointPercentage: threePointers.length > 0 ? (made3PT / threePointers.length) : 0,
      threePointMade: made3PT,
      threePointAttempted: threePointers.length,
      totalShots,
      madeShots,
      ...zoneAnalysis
    };
  };

  // Check if still loading
  if (entityData.some(entity => entity.loading) || (viewMode === 'player' && playersLoading)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statistics Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading comparison data...</div>
        </CardContent>
      </Card>
    );
  }

  // Check for errors
  if (entityData.some(entity => entity.error)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statistics Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading comparison data</p>
        </CardContent>
      </Card>
    );
  }

  const statsData = entityData.map(entity => ({
    name: entity.name,
    stats: calculateStats(entity.shotData)
  }));

  if (statsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statistics Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available for comparison</p>
        </CardContent>
      </Card>
    );
  }

  const getComparisonIcon = (value1: number, value2: number) => {
    const diff = Math.abs(value1 - value2);
    if (diff < 0.001) return <Minus className="h-4 w-4" />;
    return value1 > value2 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getComparisonColor = (value1: number, value2: number) => {
    const diff = Math.abs(value1 - value2);
    if (diff < 0.001) return "text-muted-foreground";
    return value1 > value2 ? "text-green-500" : "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Head-to-Head Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Head-to-Head Comparison ({selectedSeason})
            <Badge variant="secondary" className="text-xs">
              {statsData.map(s => s.name).join(' vs ')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Field Goal Percentage */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Field Goal %</div>
              {statsData.map((entity, index) => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {(entity.stats.fieldGoalPercentage * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.madeShots}/{entity.stats.totalShots}
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Two Point Percentage */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">2PT %</div>
              {statsData.map((entity, index) => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {(entity.stats.twoPointPercentage * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.twoPointMade}/{entity.stats.twoPointAttempted}
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Three Point Percentage */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">3PT %</div>
              {statsData.map((entity, index) => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {(entity.stats.threePointPercentage * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.threePointMade}/{entity.stats.threePointAttempted}
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Shots */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Total Shots</div>
              {statsData.map((entity, index) => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {entity.stats.totalShots.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    This Season
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zone Analysis Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {statsData.map((entity) => (
          <Card key={entity.name}>
            <CardHeader>
              <CardTitle className="text-lg">
                {entity.name} - Zone Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Hottest Zone */}
                <div className="text-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="flex items-center justify-center mb-2">
                    <Zap className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Hottest Zone</div>
                  <div className="font-semibold text-sm text-red-600">
                    {entity.stats.hottestZone}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.hottestZoneStats.made}/{entity.stats.hottestZoneStats.total} ({(entity.stats.hottestZoneStats.percentage * 100).toFixed(1)}%)
                  </div>
                </div>

                {/* Coldest Zone */}
                <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingDown className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Coldest Zone</div>
                  <div className="font-semibold text-sm text-blue-600">
                    {entity.stats.coldestZone}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.coldestZoneStats.made}/{entity.stats.coldestZoneStats.total} ({(entity.stats.coldestZoneStats.percentage * 100).toFixed(1)}%)
                  </div>
                </div>

                {/* Favorite Spot */}
                <div className="text-center p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="flex items-center justify-center mb-2">
                    <Heart className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Favorite Spot</div>
                  <div className="font-semibold text-sm text-amber-600">
                    {entity.stats.favoriteSpot}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.favoriteSpotStats.made}/{entity.stats.favoriteSpotStats.total} ({(entity.stats.favoriteSpotStats.percentage * 100).toFixed(1)}%)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}