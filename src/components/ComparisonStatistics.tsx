import { useMultiSeasonData } from "@/hooks/useMultiSeasonData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ComparisonStatisticsProps {
  entityName: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team" | "league";
}

export function ComparisonStatistics({ entityName, season1, season2, viewMode }: ComparisonStatisticsProps) {
  const { players: players1, loading: loading1 } = useAvailablePlayers(season1);
  const { players: players2, loading: loading2 } = useAvailablePlayers(season2);
  
  const getEntityId = (season: string, isSecondSeason = false) => {
    if (viewMode === 'player') {
      const players = isSecondSeason ? players2 : players1;
      const loading = isSecondSeason ? loading2 : loading1;
      
      if (loading || !players.length) {
        console.log(`🔍 ComparisonStatistics: Players still loading for ${season}, returning undefined`);
        return undefined;
      }
      
      const player = players.find(p => p.name === entityName);
      console.log(`🔍 ComparisonStatistics: Found player for "${entityName}" in ${season}:`, player);
      return player?.id || entityName;
    }
    return entityName;
  };
  
  const entityId1 = getEntityId(season1);
  const entityId2 = getEntityId(season2, true);
  
  console.log(`🔍 ComparisonStatistics: entityName="${entityName}", entityId1="${entityId1}", entityId2="${entityId2}", loading1=${loading1}, loading2=${loading2}`);
  
  // Always call useMultiSeasonData hook - never conditionally call hooks
  const multiSeasonData = useMultiSeasonData(season1, season2, entityId1 || '', entityId2 || '', viewMode);

  // Handle loading states after hooks are called
  if (viewMode === 'player' && (!entityId1 || !entityId2 || loading1 || loading2)) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Statistics Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Season Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Helper function to analyze shooting zones (same as EntityStatistics)
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
    
    return {
      hottestZone: hottestZone,
      hottestZoneStats: hottestZoneStats,
      coldestZone: coldestZone,
      coldestZoneStats: coldestZoneStats,
      favoriteSpot: favoriteSpot,
      favoriteSpotStats: favoriteSpotStats
    };
  };
  
  if (multiSeasonData.season1.loading || multiSeasonData.season2?.loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Statistics Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Season Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (multiSeasonData.season1.error || multiSeasonData.season2?.error) {
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

  const data1 = multiSeasonData.season1.data;
  const data2 = multiSeasonData.season2?.data || [];
  
  // Calculate statistics for both seasons
  const calculateStats = (data: any[]) => {
    const totalShots = data.length;
    
    // More robust shot result checking
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

    // Analyze zones using the same logic as EntityStatistics
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
      hottestZone: zoneAnalysis.hottestZone,
      hottestZoneStats: zoneAnalysis.hottestZoneStats,
      coldestZone: zoneAnalysis.coldestZone,
      coldestZoneStats: zoneAnalysis.coldestZoneStats,
      favoriteSpot: zoneAnalysis.favoriteSpot,
      favoriteSpotStats: zoneAnalysis.favoriteSpotStats
    };
  };

  const stats1 = calculateStats(data1);
  const stats2 = calculateStats(data2);
  
  // Determine chronological order for proper comparison direction
  const getSeasonYear = (season: string) => {
    return parseInt(season.split('-')[0]);
  };
  
  const season1Year = getSeasonYear(season1);
  const season2Year = getSeasonYear(season2);
  
  // Always show progress from earlier season to later season
  const isChronological = season1Year < season2Year;
  const earlierSeason = isChronological ? season1 : season2;
  const laterSeason = isChronological ? season2 : season1;
  const earlierStats = isChronological ? stats1 : stats2;
  const laterStats = isChronological ? stats2 : stats1;
  
  // Calculate differences (later - earlier for chronological progress)
  const fgDiff = laterStats.fieldGoalPercentage - earlierStats.fieldGoalPercentage;
  const twoPtDiff = laterStats.twoPointPercentage - earlierStats.twoPointPercentage;
  const threePtDiff = laterStats.threePointPercentage - earlierStats.threePointPercentage;
  const shotsDiff = laterStats.totalShots - earlierStats.totalShots;

  const getTrendIcon = (diff: number) => {
    if (Math.abs(diff) < 0.001) return <Minus className="h-4 w-4" />;
    return diff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getTrendColor = (diff: number) => {
    if (Math.abs(diff) < 0.001) return "text-muted-foreground";
    return diff > 0 ? "text-green-500" : "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Individual Season Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatisticsPanel 
          entityName={`${entityName} (${season1})`}
          stats={stats1}
        />
        <StatisticsPanel 
          entityName={`${entityName} (${season2})`}
          stats={stats2}
        />
      </div>
      
      {/* Comparison Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Season Comparison: {earlierSeason} vs {laterSeason}
            <Badge variant="secondary" className="text-xs">
              {earlierSeason} → {laterSeason}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">FG%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(fgDiff)}`}>
                {getTrendIcon(fgDiff)}
                <span>{fgDiff >= 0 ? '+' : ''}{(fgDiff * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">2PT%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(twoPtDiff)}`}>
                {getTrendIcon(twoPtDiff)}
                <span>{twoPtDiff >= 0 ? '+' : ''}{(twoPtDiff * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">3PT%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(threePtDiff)}`}>
                {getTrendIcon(threePtDiff)}
                <span>{threePtDiff >= 0 ? '+' : ''}{(threePtDiff * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">Total Shots</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(shotsDiff)}`}>
                {getTrendIcon(shotsDiff)}
                <span>{shotsDiff >= 0 ? '+' : ''}{shotsDiff}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}