import { useMultiSeasonData } from "@/hooks/useMultiSeasonData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useNBAAnalyticsTracking } from "@/hooks";
import { useComponentPerformance } from "@/hooks";
import { useErrorTracking } from "@/hooks";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEffect, useRef } from "react";

interface ComparisonStatisticsProps {
  entityName: string;
  entityName2?: string; // For comparing two different players
  season1: string;
  season2: string;
  viewMode: "player" | "team" | "league";
}

export function ComparisonStatistics({ entityName, entityName2, season1, season2, viewMode }: ComparisonStatisticsProps) {
  // OpenTelemetry instrumentation hooks
  const { trackComparisonView, trackStatisticsView, trackViewModeChange } = useNBAAnalyticsTracking();
  const { metrics, recordCustomMetric, startOperation } = useComponentPerformance('ComparisonStatistics', {
    slowRenderThreshold: 100,
    memoryLeakThreshold: 25,
    trackMemory: true,
  });
  const { trackError } = useErrorTracking();
  
  // Performance tracking refs
  const dataLoadStart = useRef<number>(Date.now());
  const calculationStart = useRef<number>(Date.now());
  
  // Always call hooks but only use results in player mode
  const { players: rawPlayers1, loading: rawLoading1 } = useAvailablePlayers();
  const { players: rawPlayers2, loading: rawLoading2 } = useAvailablePlayers();
  
  const players1 = viewMode === "player" ? rawPlayers1 : [];
  const loading1 = viewMode === "player" ? rawLoading1 : false;
  const players2 = viewMode === "player" ? rawPlayers2 : [];
  const loading2 = viewMode === "player" ? rawLoading2 : false;
  
  const getEntityId = (entityName: string, season: string, isSecondSeason = false) => {
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
  
  // For player vs player comparison, use the same season for both players
  const isPlayerVsPlayer = entityName2 && entityName2 !== entityName;
  const actualSeason1 = season1;
  const actualSeason2 = isPlayerVsPlayer ? season1 : season2; // Use same season for player vs player
  
  const entityId1 = getEntityId(entityName, actualSeason1);
  const entityId2 = getEntityId(entityName2 || entityName, actualSeason2, !isPlayerVsPlayer);
  
  console.log(`🔍 ComparisonStatistics: entityName="${entityName}", entityId1="${entityId1}", entityId2="${entityId2}", loading1=${loading1}, loading2=${loading2}`);
  
  // Always call useMultiSeasonData hook - never conditionally call hooks
  const multiSeasonData = useMultiSeasonData(actualSeason1, actualSeason2, entityId1 || '', entityId2 || '', viewMode);

  // Track comparison view when data changes
  useEffect(() => {
    if (entityName && (entityName2 || season2 !== season1) && !loading1 && !loading2) {
      const dataLoadTime = Date.now() - dataLoadStart.current;
      recordCustomMetric('data_load_time', dataLoadTime, {
        view_mode: viewMode,
        has_second_entity: entityName2 ? 'true' : 'false',
      });
      
      trackComparisonView(season1, season2, viewMode, entityName, entityName2);
    }
  }, [entityName, entityName2, season1, season2, viewMode, loading1, loading2, trackComparisonView, recordCustomMetric]);

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
    const errorMessage = multiSeasonData.season1.error?.message || multiSeasonData.season2?.error?.message || 'Unknown error';
    
    // Track the error
    trackError({
      message: `Comparison data loading failed: ${errorMessage}`,
      name: 'ComparisonDataError',
      severity: 'medium',
    }, {
      componentName: 'ComparisonStatistics',
      additionalContext: {
        entity_name: entityName,
        entity_name2: entityName2,
        season1,
        season2,
        view_mode: viewMode,
      },
    });
    
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
    calculationStart.current = Date.now();
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

    const calculationTime = Date.now() - calculationStart.current;
    recordCustomMetric('stats_calculation_time', calculationTime, {
      data_size: totalShots.toString(),
      calculation_complexity: totalShots > 1000 ? 'high' : totalShots > 500 ? 'medium' : 'low',
    });

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
  
  // Calculate differences
  const fgDiff = laterStats.fieldGoalPercentage - earlierStats.fieldGoalPercentage;
  const twoPtDiff = laterStats.twoPointPercentage - earlierStats.twoPointPercentage;
  const threePtDiff = laterStats.threePointPercentage - earlierStats.threePointPercentage;
  const shotsDiff = laterStats.totalShots - earlierStats.totalShots;

  // For display purposes
  const comparisonTitle = isPlayerVsPlayer 
    ? `${entityName} vs ${entityName2} (${actualSeason1})`
    : `${entityName} Season Comparison: ${earlierSeason} → ${laterSeason}`;
  
  const firstLabel = isPlayerVsPlayer ? entityName : `${entityName} (${earlierSeason})`;
  const secondLabel = isPlayerVsPlayer ? entityName2 : `${entityName} (${laterSeason})`;
  
  // For player vs player, show difference as Player2 - Player1
  const actualStats1 = isPlayerVsPlayer ? stats1 : earlierStats;
  const actualStats2 = isPlayerVsPlayer ? stats2 : laterStats;

  const getTrendIcon = (diff: number) => {
    if (Math.abs(diff) < 0.001) return <Minus className="h-4 w-4" />;
    return diff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getTrendColor = (diff: number) => {
    if (Math.abs(diff) < 0.001) return "text-muted-foreground";
    return diff > 0 ? "text-green-500" : "text-red-500";
  };

  // Track rendering performance
  useEffect(() => {
    if (metrics.isSlowRender) {
      recordCustomMetric('slow_render_detected', 1, {
        render_time: metrics.renderTime.toString(),
        data_size: (data1.length + data2.length).toString(),
      });
    }
  }, [metrics.isSlowRender, metrics.renderTime, data1.length, data2.length, recordCustomMetric]);

  return (
    <div className="space-y-6">
      {/* Comparison Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {comparisonTitle}
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
              {isPlayerVsPlayer && <div className="text-xs text-muted-foreground">{entityName2} vs {entityName}</div>}
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">2PT%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(twoPtDiff)}`}>
                {getTrendIcon(twoPtDiff)}
                <span>{twoPtDiff >= 0 ? '+' : ''}{(twoPtDiff * 100).toFixed(1)}%</span>
              </div>
              {isPlayerVsPlayer && <div className="text-xs text-muted-foreground">{entityName2} vs {entityName}</div>}
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">3PT%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(threePtDiff)}`}>
                {getTrendIcon(threePtDiff)}
                <span>{threePtDiff >= 0 ? '+' : ''}{(threePtDiff * 100).toFixed(1)}%</span>
              </div>
              {isPlayerVsPlayer && <div className="text-xs text-muted-foreground">{entityName2} vs {entityName}</div>}
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">Total Shots</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(shotsDiff)}`}>
                {getTrendIcon(shotsDiff)}
                <span>{shotsDiff >= 0 ? '+' : ''}{shotsDiff}</span>
              </div>
              {isPlayerVsPlayer && <div className="text-xs text-muted-foreground">{entityName2} vs {entityName}</div>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}